package controllers

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"mymate-backend/config"
	"mymate-backend/models"
)

type createWalletOrderReq struct {
	Amount float64 `json:"amount" binding:"required,gt=0"`
}

type verifyWalletPaymentReq struct {
	RazorpayOrderID   string  `json:"razorpay_order_id" binding:"required"`
	RazorpayPaymentID string  `json:"razorpay_payment_id" binding:"required"`
	RazorpaySignature string  `json:"razorpay_signature" binding:"required"`
	Amount            float64 `json:"amount" binding:"required,gt=0"`
}

// GET /api/v1/wallet
func GetWalletTransactions(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusOK, gin.H{
			"balance":      0.0,
			"transactions": []models.WalletTransaction{},
		})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)
	roleVal, _ := c.Get("userRole")
	userRole, _ := roleVal.(string)

	ownerModel := "User"
	if userRole == "driver" {
		ownerModel = "Driver"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	findOpts := options.Find().SetSort(bson.M{"createdAt": -1}).SetLimit(50)
	cursor, err := config.GetCollection("wallet_transactions").Find(ctx, bson.M{
		"owner":      userOID,
		"ownerModel": ownerModel,
	}, findOpts)

	var transactions []models.WalletTransaction
	if err == nil {
		_ = cursor.All(ctx, &transactions)
		cursor.Close(ctx)
	}
	if transactions == nil {
		transactions = []models.WalletTransaction{}
	}

	var balance float64
	if ownerModel == "Driver" {
		var d models.Driver
		if err := config.GetCollection("drivers").FindOne(ctx, bson.M{"_id": userOID}).Decode(&d); err == nil {
			balance = d.WalletBalance
		}
	} else {
		var u models.User
		if err := config.GetCollection("users").FindOne(ctx, bson.M{"_id": userOID}).Decode(&u); err == nil {
			balance = u.WalletBalance
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"balance":      balance,
		"transactions": transactions,
	})
}

// POST /api/v1/wallet/order
func CreateWalletOrder(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "Database is not connected"})
		return
	}
	if config.AppConfig.RazorpayKeyID == "" || config.AppConfig.RazorpayKeySecret == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Payment gateway not configured"})
		return
	}

	var req createWalletOrderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid amount: " + err.Error()})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)
	roleVal, _ := c.Get("userRole")
	userRole, _ := roleVal.(string)

	ownerModel := "User"
	if userRole == "driver" {
		ownerModel = "Driver"
	}

	amountPaise := int64(math.Round(req.Amount * 100))
	payload := map[string]interface{}{
		"amount":   amountPaise,
		"currency": "INR",
		"receipt":  fmt.Sprintf("wallet_rcpt_%d", time.Now().UnixMilli()),
	}

	respBytes, statusCode, err := callRazorpayAPI("POST", "/orders", payload)
	if err != nil || statusCode >= 400 {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create order", "error": string(respBytes)})
		return
	}

	var rzpOrder struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(respBytes, &rzpOrder)

	// Persist pending top-up payment record to prevent tampering and replay attacks
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	now := time.Now()
	paymentRecord := models.Payment{
		ID:                bson.NewObjectID(),
		User:              userOID,
		Amount:            req.Amount,
		Currency:          "inr",
		RazorpayOrderID:   rzpOrder.ID,
		Status:            "pending",
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	// Store ownerModel context in payments collection
	_, _ = config.GetCollection("payments").InsertOne(ctx, bson.M{
		"_id":             paymentRecord.ID,
		"user":            userOID,
		"ownerModel":      ownerModel,
		"amount":          req.Amount,
		"currency":        "inr",
		"razorpayOrderId": rzpOrder.ID,
		"type":            "wallet_topup",
		"status":          "pending",
		"createdAt":       now,
		"updatedAt":       now,
	})

	c.JSON(http.StatusOK, gin.H{
		"orderId": rzpOrder.ID,
		"keyId":   config.AppConfig.RazorpayKeyID,
	})
}

// POST /api/v1/wallet/verify
func VerifyWalletPayment(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "Database is not connected"})
		return
	}
	keySecret := config.AppConfig.RazorpayKeySecret
	if keySecret == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Payment gateway not configured"})
		return
	}

	var req verifyWalletPaymentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request: " + err.Error()})
		return
	}

	mac := hmac.New(sha256.New, []byte(keySecret))
	mac.Write([]byte(req.RazorpayOrderID + "|" + req.RazorpayPaymentID))
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(expectedSig), []byte(req.RazorpaySignature)) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid payment signature"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)
	roleVal, _ := c.Get("userRole")
	userRole, _ := roleVal.(string)

	ownerModel := "User"
	collName := "users"
	if userRole == "driver" {
		ownerModel = "Driver"
		collName = "drivers"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Atomically verify and transition the order to completed to PREVENT REPLAY ATTACKS
	now := time.Now()
	var verifiedOrder struct {
		ID     bson.ObjectID `bson:"_id"`
		User   bson.ObjectID `bson:"user"`
		Amount float64       `bson:"amount"`
		Status string        `bson:"status"`
	}

	err := config.GetCollection("payments").FindOneAndUpdate(ctx,
		bson.M{
			"razorpayOrderId": req.RazorpayOrderID,
			"user":            userOID,
			"status":          "pending",
		},
		bson.M{
			"$set": bson.M{
				"status":            "completed",
				"razorpayPaymentId": req.RazorpayPaymentID,
				"razorpaySignature": req.RazorpaySignature,
				"paidAt":            now,
				"updatedAt":         now,
			},
		},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&verifiedOrder)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Order is invalid, already verified, or not found"})
		return
	}

	// Use the verified amount stored securely on the server (NOT the client-submitted amount!)
	creditAmount := verifiedOrder.Amount
	if creditAmount <= 0 {
		creditAmount = req.Amount
	}

	_, err = config.GetCollection(collName).UpdateOne(ctx,
		bson.M{"_id": userOID},
		bson.M{"$inc": bson.M{"walletBalance": creditAmount}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update wallet balance"})
		return
	}

	tx := models.WalletTransaction{
		ID:          bson.NewObjectID(),
		Owner:       userOID,
		OwnerModel:  ownerModel,
		Amount:      creditAmount,
		Type:        "credit",
		Description: "Wallet recharge via Razorpay",
		Status:      "completed",
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	_, _ = config.GetCollection("wallet_transactions").InsertOne(ctx, tx)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Wallet recharged successfully",
		"amount":  creditAmount,
	})
}
