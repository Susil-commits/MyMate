package controllers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"mymate-backend/config"
	"mymate-backend/models"
	"mymate-backend/telemetry"
	"mymate-backend/utils"
)

type RequestPayoutInput struct {
	Amount        float64 `json:"amount" binding:"required,gt=0"`
	Method        string  `json:"method" binding:"required"` // "upi" or "bank_transfer"
	UPIID         string  `json:"upiId"`
	AccountNumber string  `json:"accountNumber"`
	IFSCCode      string  `json:"ifscCode"`
	AccountHolder string  `json:"accountHolder"`
}

var (
	upiRegex  = regexp.MustCompile(`^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$`)
	ifscRegex = regexp.MustCompile(`^[A-Z]{4}0[A-Z0-9]{6}$`)
	accRegex  = regexp.MustCompile(`^[0-9]{9,18}$`)
)

// ValidateUPI validates Indian Unified Payments Interface VPA format
func ValidateUPI(vpa string) bool {
	clean := strings.TrimSpace(vpa)
	return upiRegex.MatchString(clean)
}

// ValidateIFSC validates Reserve Bank of India 11-character IFSC code format
func ValidateIFSC(ifsc string) bool {
	clean := strings.ToUpper(strings.TrimSpace(ifsc))
	return ifscRegex.MatchString(clean)
}

// ValidateAccountNumber validates 9 to 18 digits Indian bank account number
func ValidateAccountNumber(acc string) bool {
	clean := strings.TrimSpace(acc)
	return accRegex.MatchString(clean)
}

// POST /api/v1/drivers/payout/request
func RequestDriverPayout(c *gin.Context) {
	var input RequestPayoutInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid payout input: " + err.Error()})
		return
	}

	method := strings.ToLower(strings.TrimSpace(input.Method))
	if method != "upi" && method != "bank_transfer" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Payout method must be either 'upi' or 'bank_transfer'"})
		return
	}

	if input.Amount < 100 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Minimum payout withdrawal amount is ₹100.00"})
		return
	}

	// Validate method-specific destination credentials
	if method == "upi" {
		if !ValidateUPI(input.UPIID) {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid UPI ID format (e.g., driver@okhdfcbank or 9876543210@paytm)"})
			return
		}
	} else {
		if !ValidateIFSC(input.IFSCCode) {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid Indian Bank IFSC code format (e.g., HDFC0001234)"})
			return
		}
		if !ValidateAccountNumber(input.AccountNumber) {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Bank account number must be between 9 and 18 digits"})
			return
		}
		if strings.TrimSpace(input.AccountHolder) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Account holder name is required for bank transfer"})
			return
		}
	}

	if config.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "Database is not connected"})
		return
	}

	driverObj, exists := c.Get("driver")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized driver credentials"})
		return
	}
	driver := driverObj.(*models.Driver)

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	// 1. Verify Driver KYC Status
	if driver.KycStatus != "approved" {
		c.JSON(http.StatusForbidden, gin.H{"message": "Driver account KYC must be approved before requesting earnings payouts"})
		return
	}

	amount := math.Round(input.Amount*100) / 100

	// 2. Atomic Compare-And-Swap: Deduct wallet balance only if sufficient balance exists
	res, err := config.DB.Collection("drivers").UpdateOne(
		ctx,
		bson.M{
			"_id":           driver.ID,
			"walletBalance": bson.M{"$gte": amount},
			"kycStatus":     "approved",
		},
		bson.M{
			"$inc": bson.M{"walletBalance": -amount},
			"$set": bson.M{"updatedAt": time.Now().UTC()},
		},
	)
	if err != nil || res.MatchedCount == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"message":       "Insufficient wallet balance or driver account ineligible",
			"walletBalance": driver.WalletBalance,
		})
		return
	}

	// 3. Generate unique disbursement Reference ID
	randBytes := make([]byte, 6)
	_, _ = rand.Read(randBytes)
	refID := fmt.Sprintf("pout_%d_%s", time.Now().Unix(), hex.EncodeToString(randBytes))

	now := time.Now().UTC()
	status := "processed"
	var processedAt *time.Time

	// Auto-disburse amounts up to ₹10,000; larger amounts queued as pending for administrative review
	if amount <= 10000 {
		status = "processed"
		processedAt = &now
	} else {
		status = "pending"
	}

	payout := models.PayoutRequest{
		DriverID:      driver.ID,
		DriverName:    driver.Name,
		DriverPhone:   driver.Phone,
		Amount:        amount,
		Method:        method,
		UPIID:         strings.ToLower(strings.TrimSpace(input.UPIID)),
		AccountNumber: strings.TrimSpace(input.AccountNumber),
		IFSCCode:      strings.ToUpper(strings.TrimSpace(input.IFSCCode)),
		AccountHolder: strings.TrimSpace(input.AccountHolder),
		ReferenceID:   refID,
		Status:        status,
		GatewayFee:    0.0,
		NetDisbursed:  amount,
		CreatedAt:     now,
		ProcessedAt:   processedAt,
		UpdatedAt:     now,
	}

	insertRes, err := config.GetCollection("payouts").InsertOne(ctx, payout)
	if err != nil {
		telemetry.LogError("Failed to record payout request", err)
	} else if oid, ok := insertRes.InsertedID.(bson.ObjectID); ok {
		payout.ID = oid
	}

	// 4. Create Ledger Wallet Transaction record
	desc := fmt.Sprintf("Earnings payout via UPI (%s)", payout.UPIID)
	if method == "bank_transfer" {
		accMask := payout.AccountNumber
		if len(accMask) > 4 {
			accMask = "..." + accMask[len(accMask)-4:]
		}
		desc = fmt.Sprintf("Earnings payout to Bank A/C %s (%s)", accMask, payout.IFSCCode)
	}

	walletTx := models.WalletTransaction{
		Owner:       driver.ID,
		OwnerModel:  "Driver",
		Type:        "debit",
		Amount:      amount,
		Description: desc,
		Status:      "completed",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	_, _ = config.GetCollection("wallet_transactions").InsertOne(ctx, walletTx)

	// 5. Driver In-App Notification
	_ = models.CreateNotification(ctx, config.DB, models.Notification{
		User:      driver.ID,
		UserModel: "Driver",
		Title:     "Payout Initiated",
		Message:   fmt.Sprintf("Payout of ₹%.2f has been %s (Ref: %s)", amount, status, refID),
		Type:      "payment",
		Link:      "/driver/wallet",
	})

	telemetry.LogInfo("Driver payout request completed",
		"driverId", driver.ID.Hex(),
		"amount", amount,
		"method", method,
		"status", status,
		"refId", refID,
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Payout requested successfully",
		"payout":  payout,
	})
}

// GET /api/v1/drivers/payouts
func GetDriverPayouts(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusOK, gin.H{
			"payouts": []models.PayoutRequest{},
			"total":   0,
		})
		return
	}

	driverObj, exists := c.Get("driver")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized driver credentials"})
		return
	}
	driver := driverObj.(*models.Driver)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	limit := utils.ClampLimit(c.Query("limit"), 20, 50)
	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(int64(limit))

	cursor, err := config.GetCollection("payouts").Find(ctx, bson.M{"driverId": driver.ID}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch payouts history"})
		return
	}
	defer cursor.Close(ctx)

	var payouts []models.PayoutRequest
	_ = cursor.All(ctx, &payouts)
	if payouts == nil {
		payouts = []models.PayoutRequest{}
	}

	c.JSON(http.StatusOK, gin.H{
		"payouts": payouts,
		"total":   len(payouts),
	})
}

// GET /api/v1/admin/payouts
func AdminGetAllPayouts(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusOK, gin.H{
			"payouts": []models.PayoutRequest{},
			"total":   0,
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{}
	if status := c.Query("status"); status != "" {
		filter["status"] = status
	}

	limit := utils.ClampLimit(c.Query("limit"), 20, 100)
	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(int64(limit))

	cursor, err := config.GetCollection("payouts").Find(ctx, filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to retrieve payouts"})
		return
	}
	defer cursor.Close(ctx)

	var payouts []models.PayoutRequest
	_ = cursor.All(ctx, &payouts)
	if payouts == nil {
		payouts = []models.PayoutRequest{}
	}

	c.JSON(http.StatusOK, gin.H{
		"payouts": payouts,
		"total":   len(payouts),
	})
}

// PUT /api/v1/admin/payouts/:id/status
func AdminUpdatePayoutStatus(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "Database is not connected"})
		return
	}

	payoutIDStr := c.Param("id")
	payoutOID, err := bson.ObjectIDFromHex(payoutIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid payout ID"})
		return
	}

	var input struct {
		Status        string `json:"status" binding:"required"` // "processed" or "rejected"
		FailureReason string `json:"failureReason"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Status is required"})
		return
	}

	newStatus := strings.ToLower(strings.TrimSpace(input.Status))
	if newStatus != "processed" && newStatus != "rejected" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Status must be 'processed' or 'rejected'"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	var payout models.PayoutRequest
	err = config.GetCollection("payouts").FindOne(ctx, bson.M{"_id": payoutOID}).Decode(&payout)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Payout record not found"})
		return
	}

	if payout.Status != "pending" && payout.Status != "processing" {
		c.JSON(http.StatusBadRequest, gin.H{"message": fmt.Sprintf("Cannot modify payout with status '%s'", payout.Status)})
		return
	}

	now := time.Now().UTC()
	updateFields := bson.M{
		"status":    newStatus,
		"updatedAt": now,
	}

	if newStatus == "processed" {
		updateFields["processedAt"] = now
	} else if newStatus == "rejected" {
		updateFields["failureReason"] = input.FailureReason
		// If rejected, refund the amount atomically back to driver wallet
		_, _ = config.DB.Collection("drivers").UpdateOne(ctx,
			bson.M{"_id": payout.DriverID},
			bson.M{
				"$inc": bson.M{"walletBalance": payout.Amount},
				"$set": bson.M{"updatedAt": now},
			},
		)

		// Create refund wallet transaction
		refundTx := models.WalletTransaction{
			Owner:       payout.DriverID,
			OwnerModel:  "Driver",
			Type:        "credit",
			Amount:      payout.Amount,
			Description: fmt.Sprintf("Payout refund (Ref: %s): %s", payout.ReferenceID, input.FailureReason),
			Status:      "completed",
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		_, _ = config.GetCollection("wallet_transactions").InsertOne(ctx, refundTx)
	}

	_, err = config.GetCollection("payouts").UpdateOne(ctx, bson.M{"_id": payoutOID}, bson.M{"$set": updateFields})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update payout status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Payout successfully marked as %s", newStatus),
	})
}
