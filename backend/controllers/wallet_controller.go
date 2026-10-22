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
	if config.AppConfig.RazorpayKeyID == "" || config.AppConfig.RazorpayKeySecret == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Payment gateway not configured"})
		return
	}

	var req createWalletOrderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid amount: " + err.Error()})
		return
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

	c.JSON(http.StatusOK, gin.H{
		"orderId": rzpOrder.ID,
		"keyId":   config.AppConfig.RazorpayKeyID,
	})
}

// POST /api/v1/wallet/verify
func VerifyWalletPayment(c *gin.Context) {
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

	_, err := config.GetCollection(collName).UpdateOne(ctx,
		bson.M{"_id": userOID},
		bson.M{"$inc": bson.M{"walletBalance": req.Amount}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update wallet balance"})
		return
	}

	now := time.Now()
	tx := models.WalletTransaction{
		ID:          bson.NewObjectID(),
		Owner:       userOID,
		OwnerModel:  ownerModel,
		Amount:      req.Amount,
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
	})
}
