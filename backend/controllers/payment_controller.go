package controllers

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"mymate-backend/config"
	"mymate-backend/models"
)

type createOrderReq struct {
	BookingID string `json:"bookingId" binding:"required"`
}

type verifyPaymentReq struct {
	RazorpayOrderID   string `json:"razorpay_order_id" binding:"required"`
	RazorpayPaymentID string `json:"razorpay_payment_id" binding:"required"`
	RazorpaySignature string `json:"razorpay_signature" binding:"required"`
}

type refundPaymentReq struct {
	BookingID string `json:"bookingId" binding:"required"`
}

type payWithWalletReq struct {
	BookingID string `json:"bookingId" binding:"required"`
}

// Helper: Razorpay HTTP client call
func callRazorpayAPI(method, endpoint string, reqPayload interface{}) ([]byte, int, error) {
	keyID := config.AppConfig.RazorpayKeyID
	keySecret := config.AppConfig.RazorpayKeySecret
	if keyID == "" || keySecret == "" {
		return nil, http.StatusBadRequest, fmt.Errorf("online payments are not configured on this server")
	}

	var bodyReader io.Reader
	if reqPayload != nil {
		jsonBytes, err := json.Marshal(reqPayload)
		if err != nil {
			return nil, http.StatusInternalServerError, err
		}
		bodyReader = bytes.NewReader(jsonBytes)
	}

	req, err := http.NewRequest(method, "https://api.razorpay.com/v1"+endpoint, bodyReader)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	req.SetBasicAuth(keyID, keySecret)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, http.StatusBadGateway, err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	return respBytes, resp.StatusCode, nil
}

// POST /api/v1/payments/create-order
func CreateOrder(c *gin.Context) {
	if config.AppConfig.RazorpayKeyID == "" || config.AppConfig.RazorpayKeySecret == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Online payments are not configured on this server"})
		return
	}

	var req createOrderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request: " + err.Error()})
		return
	}

	bookingOID, err := bson.ObjectIDFromHex(req.BookingID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid booking ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var booking models.Booking
	err = config.GetCollection("bookings").FindOne(ctx, bson.M{"_id": bookingOID}).Decode(&booking)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Booking not found"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)
	if booking.User != userOID {
		c.JSON(http.StatusForbidden, gin.H{"message": "Not authorized"})
		return
	}
	if booking.PaymentStatus == "paid" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "This booking is already paid"})
		return
	}
	if booking.Status == "cancelled" || booking.Status == "rejected" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Cannot pay for a cancelled booking"})
		return
	}
	if booking.Status != "accepted" && booking.Status != "ongoing" && booking.Status != "completed" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Booking must be accepted before payment"})
		return
	}
	if booking.TotalAmount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid booking amount. Contact support."})
		return
	}

	amountPaise := int64(math.Round(booking.TotalAmount * 100))
	payload := map[string]interface{}{
		"amount":   amountPaise,
		"currency": "INR",
		"receipt":  fmt.Sprintf("booking_%s", booking.ID.Hex()),
	}

	respBytes, statusCode, err := callRazorpayAPI("POST", "/orders", payload)
	if err != nil || statusCode >= 400 {
		errMsg := "Could not create payment order"
		if err != nil {
			errMsg = err.Error()
		}
		c.JSON(http.StatusBadGateway, gin.H{"message": errMsg, "error": string(respBytes)})
		return
	}

	var rzpOrder struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(respBytes, &rzpOrder)

	// Upsert payment record
	now := time.Now()
	opts := options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After)
	update := bson.M{
		"$set": bson.M{
			"booking":         booking.ID,
			"user":            booking.User,
			"driver":          booking.Driver,
			"amount":          booking.TotalAmount,
			"currency":        "inr",
			"razorpayOrderId": rzpOrder.ID,
			"status":          "pending",
			"updatedAt":       now,
		},
		"$setOnInsert": bson.M{
			"createdAt": now,
		},
	}
	_ = config.GetCollection("payments").FindOneAndUpdate(ctx, bson.M{
		"booking": booking.ID,
		"status":  "pending",
	}, update, opts)

	c.JSON(http.StatusOK, gin.H{
		"keyId":    config.AppConfig.RazorpayKeyID,
		"orderId":  rzpOrder.ID,
		"amount":   amountPaise,
		"currency": "INR",
	})
}

// POST /api/v1/payments/verify
func VerifyPayment(c *gin.Context) {
	keySecret := config.AppConfig.RazorpayKeySecret
	if keySecret == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Online payments are not configured on this server"})
		return
	}

	var req verifyPaymentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var payment models.Payment
	err := config.GetCollection("payments").FindOne(ctx, bson.M{"razorpayOrderId": req.RazorpayOrderID}).Decode(&payment)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Order not found"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)
	if payment.User != userOID {
		c.JSON(http.StatusForbidden, gin.H{"message": "Not authorized"})
		return
	}

	if payment.Status == "completed" {
		c.JSON(http.StatusOK, gin.H{"message": "Payment already verified"})
		return
	}

	// Signature verification: HMAC-SHA256 of orderId|paymentId
	mac := hmac.New(sha256.New, []byte(keySecret))
	mac.Write([]byte(req.RazorpayOrderID + "|" + req.RazorpayPaymentID))
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(expectedSig), []byte(req.RazorpaySignature)) {
		_, _ = config.GetCollection("payments").UpdateOne(ctx,
			bson.M{"_id": payment.ID, "status": "pending"},
			bson.M{"$set": bson.M{"status": "failed"}},
		)
		c.JSON(http.StatusBadRequest, gin.H{"message": "Payment signature verification failed"})
		return
	}

	// Atomic transition: pending -> completed
	now := time.Now()
	var updated models.Payment
	err = config.GetCollection("payments").FindOneAndUpdate(ctx,
		bson.M{"_id": payment.ID, "status": "pending"},
		bson.M{"$set": bson.M{
			"razorpayPaymentId": req.RazorpayPaymentID,
			"razorpaySignature": req.RazorpaySignature,
			"status":            "completed",
			"paidAt":            now,
			"updatedAt":         now,
		}},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&updated)

	if err != nil {
		// Already completed by concurrent request
		c.JSON(http.StatusOK, gin.H{"message": "Payment already verified"})
		return
	}

	ReconcilePayment(&updated, "razorpay")
	c.JSON(http.StatusOK, gin.H{"message": "Payment verified successfully"})
}

// ReconcilePayment: credits driver wallet, creates notification, email, Kafka event
func ReconcilePayment(payment *models.Payment, paymentMethod string) {
	if payment == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var booking models.Booking
	err := config.GetCollection("bookings").FindOne(ctx, bson.M{"_id": payment.Booking}).Decode(&booking)
	if err != nil || booking.PaymentStatus == "paid" {
		return
	}

	// 1. Update booking paymentStatus = paid
	_, _ = config.GetCollection("bookings").UpdateOne(ctx,
		bson.M{"_id": booking.ID},
		bson.M{"$set": bson.M{"paymentStatus": "paid", "updatedAt": time.Now()}},
	)

	// 2. Driver Wallet credit
	splitFraction := config.AppConfig.DriverWalletSplitPct
	platformFeePct := int(math.Round((1 - splitFraction) * 100))
	driverAmount := math.Round(booking.TotalAmount*splitFraction*100) / 100

	_, _ = config.GetCollection("drivers").UpdateOne(ctx,
		bson.M{"_id": booking.Driver},
		bson.M{"$inc": bson.M{"walletBalance": driverAmount}},
	)

	description := fmt.Sprintf("Earnings for booking %s (after %d%% platform fee)", booking.ID.Hex(), platformFeePct)
	if paymentMethod == "razorpay_webhook" {
		description = fmt.Sprintf("Earnings for booking %s (via webhook reconciliation)", booking.ID.Hex())
	}

	now := time.Now()
	walletTx := models.WalletTransaction{
		ID:          bson.NewObjectID(),
		Owner:       booking.Driver,
		OwnerModel:  "Driver",
		Type:        "credit",
		Amount:      driverAmount,
		Description: description,
		Booking:     &booking.ID,
		Status:      "completed",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	_, _ = config.GetCollection("wallet_transactions").InsertOne(ctx, walletTx)

	// 3. Notification
	notif := models.Notification{
		ID:        bson.NewObjectID(),
		User:      booking.Driver,
		UserModel: "Driver",
		Title:     "Payment Received",
		Message:   fmt.Sprintf("Payment of ₹%.2f received for a booking. ₹%.2f added to your wallet.", booking.TotalAmount, driverAmount),
		Type:      "payment",
		Link:      fmt.Sprintf("/bookings/%s", booking.ID.Hex()),
		Read:      false,
		CreatedAt: now,
		UpdatedAt: now,
	}
	_, _ = config.GetCollection("notifications").InsertOne(ctx, notif)

	// 4. Send email status update
	var driver models.Driver
	var user models.User
	_ = config.GetCollection("drivers").FindOne(ctx, bson.M{"_id": booking.Driver}).Decode(&driver)
	_ = config.GetCollection("users").FindOne(ctx, bson.M{"_id": booking.User}).Decode(&user)
	if driver.Email != "" && user.Email != "" {
		_ = config.SendBookingStatusEmail(user.Email, user.Name, driver.Name, booking.Status, booking.ID.Hex())
	}

	// 5. Kafka event
	payload := map[string]interface{}{
		"paymentId":     payment.ID.Hex(),
		"bookingId":     booking.ID.Hex(),
		"driverId":      booking.Driver.Hex(),
		"userId":        booking.User.Hex(),
		"totalAmount":   booking.TotalAmount,
		"driverAmount":  driverAmount,
		"paymentMethod": paymentMethod,
	}
	_ = config.PublishKafkaMessage(config.TopicPaymentCompleted, payment.ID.Hex(), payload)
}

// GET /api/v1/payments/booking/:bookingId
func GetPaymentStatus(c *gin.Context) {
	bookingOID, err := bson.ObjectIDFromHex(c.Param("bookingId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid booking ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var booking models.Booking
	if err := config.GetCollection("bookings").FindOne(ctx, bson.M{"_id": bookingOID}).Decode(&booking); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Booking not found"})
		return
	}

	role, _ := c.Get("userRole")
	userRole, _ := role.(string)
	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)

	isOwner := userRole == "admin" ||
		(userRole == "user" && booking.User == userOID) ||
		(userRole == "driver" && booking.Driver == userOID)

	if !isOwner {
		c.JSON(http.StatusForbidden, gin.H{"message": "Not authorized"})
		return
	}

	var payment models.Payment
	_ = config.GetCollection("payments").FindOne(ctx, bson.M{
		"booking": booking.ID,
		"status":  bson.M{"$in": []string{"pending", "completed", "refunded"}},
	}).Decode(&payment)

	c.JSON(http.StatusOK, gin.H{
		"paymentStatus": booking.PaymentStatus,
		"payment":       payment,
	})
}

// POST /api/v1/payments/refund
func RefundPayment(c *gin.Context) {
	var req refundPaymentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request: " + err.Error()})
		return
	}

	bookingOID, err := bson.ObjectIDFromHex(req.BookingID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid booking ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var booking models.Booking
	if err := config.GetCollection("bookings").FindOne(ctx, bson.M{"_id": bookingOID}).Decode(&booking); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Booking not found"})
		return
	}
	if booking.PaymentStatus != "paid" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "This booking has not been paid"})
		return
	}

	var payment models.Payment
	err = config.GetCollection("payments").FindOne(ctx, bson.M{"booking": booking.ID, "status": "completed"}).Decode(&payment)
	if err != nil || payment.RazorpayPaymentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "No completed payment found to refund"})
		return
	}

	amountPaise := int64(math.Round(payment.Amount * 100))
	endpoint := fmt.Sprintf("/payments/%s/refund", payment.RazorpayPaymentID)
	respBytes, statusCode, err := callRazorpayAPI("POST", endpoint, map[string]interface{}{"amount": amountPaise})
	if err != nil || statusCode >= 400 {
		c.JSON(http.StatusBadGateway, gin.H{"message": "Refund failed", "error": string(respBytes)})
		return
	}

	now := time.Now()
	_, _ = config.GetCollection("payments").UpdateOne(ctx, bson.M{"_id": payment.ID}, bson.M{"$set": bson.M{"status": "refunded", "updatedAt": now}})
	_, _ = config.GetCollection("bookings").UpdateOne(ctx, bson.M{"_id": booking.ID}, bson.M{"$set": bson.M{"paymentStatus": "refunded", "updatedAt": now}})

	c.JSON(http.StatusOK, gin.H{"message": "Refund processed successfully"})
}

// POST /api/v1/payments/wallet-pay
func PayWithWallet(c *gin.Context) {
	var req payWithWalletReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request: " + err.Error()})
		return
	}

	bookingOID, err := bson.ObjectIDFromHex(req.BookingID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid booking ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var booking models.Booking
	if err := config.GetCollection("bookings").FindOne(ctx, bson.M{"_id": bookingOID}).Decode(&booking); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Booking not found"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)
	if booking.User != userOID {
		c.JSON(http.StatusForbidden, gin.H{"message": "Not authorized"})
		return
	}
	if booking.PaymentStatus == "paid" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "This booking is already paid"})
		return
	}
	if booking.Status == "cancelled" || booking.Status == "rejected" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Cannot pay for a cancelled booking"})
		return
	}
	if booking.TotalAmount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid booking amount"})
		return
	}

	// Atomically deduct user wallet balance
	var updatedUser models.User
	err = config.GetCollection("users").FindOneAndUpdate(ctx,
		bson.M{
			"_id":           userOID,
			"walletBalance": bson.M{"$gte": booking.TotalAmount},
		},
		bson.M{
			"$inc": bson.M{"walletBalance": -booking.TotalAmount},
		},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&updatedUser)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Insufficient wallet balance"})
		return
	}

	now := time.Now()
	// User debit transaction
	userTx := models.WalletTransaction{
		ID:          bson.NewObjectID(),
		Owner:       userOID,
		OwnerModel:  "User",
		Type:        "debit",
		Amount:      booking.TotalAmount,
		Description: fmt.Sprintf("Payment for booking %s", booking.ID.Hex()),
		Booking:     &booking.ID,
		Status:      "completed",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	_, _ = config.GetCollection("wallet_transactions").InsertOne(ctx, userTx)

	// Update booking payment status
	_, _ = config.GetCollection("bookings").UpdateOne(ctx,
		bson.M{"_id": booking.ID},
		bson.M{"$set": bson.M{"paymentStatus": "paid", "updatedAt": now}},
	)

	// Driver Wallet credit
	splitFraction := config.AppConfig.DriverWalletSplitPct
	platformFeePct := int(math.Round((1 - splitFraction) * 100))
	driverAmount := math.Round(booking.TotalAmount*splitFraction*100) / 100

	_, _ = config.GetCollection("drivers").UpdateOne(ctx,
		bson.M{"_id": booking.Driver},
		bson.M{"$inc": bson.M{"walletBalance": driverAmount}},
	)

	driverTx := models.WalletTransaction{
		ID:          bson.NewObjectID(),
		Owner:       booking.Driver,
		OwnerModel:  "Driver",
		Type:        "credit",
		Amount:      driverAmount,
		Description: fmt.Sprintf("Earnings for booking %s (after %d%% fee)", booking.ID.Hex(), platformFeePct),
		Booking:     &booking.ID,
		Status:      "completed",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	_, _ = config.GetCollection("wallet_transactions").InsertOne(ctx, driverTx)

	// Notifications & Emails
	notif := models.Notification{
		ID:        bson.NewObjectID(),
		User:      booking.Driver,
		UserModel: "Driver",
		Title:     "Payment Received",
		Message:   fmt.Sprintf("Payment of ₹%.2f received (paid via Wallet). ₹%.2f added to your wallet.", booking.TotalAmount, driverAmount),
		Type:      "payment",
		Link:      fmt.Sprintf("/bookings/%s", booking.ID.Hex()),
		CreatedAt: now,
		UpdatedAt: now,
	}
	_, _ = config.GetCollection("notifications").InsertOne(ctx, notif)

	var driver models.Driver
	_ = config.GetCollection("drivers").FindOne(ctx, bson.M{"_id": booking.Driver}).Decode(&driver)
	if driver.Email != "" && updatedUser.Email != "" {
		_ = config.SendBookingStatusEmail(updatedUser.Email, updatedUser.Name, driver.Name, booking.Status, booking.ID.Hex())
	}

	payload := map[string]interface{}{
		"bookingId":     booking.ID.Hex(),
		"driverId":      booking.Driver.Hex(),
		"userId":        userOID.Hex(),
		"totalAmount":   booking.TotalAmount,
		"driverAmount":  driverAmount,
		"paymentMethod": "wallet",
	}
	_ = config.PublishKafkaMessage(config.TopicPaymentCompleted, booking.ID.Hex(), payload)

	c.JSON(http.StatusOK, gin.H{"message": "Payment successful using wallet"})
}

// POST /api/v1/payments/webhook
func VerifyWebhook(c *gin.Context) {
	signature := c.GetHeader("X-Razorpay-Signature")
	webhookSecret := config.AppConfig.RazorpayWebhookSecret
	if webhookSecret == "" {
		webhookSecret = config.AppConfig.RazorpayKeySecret
	}
	if webhookSecret == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "RAZORPAY_WEBHOOK_SECRET is not configured"})
		return
	}
	if signature == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Missing Razorpay signature header"})
		return
	}

	rawBody, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Failed to read request body"})
		return
	}

	mac := hmac.New(sha256.New, []byte(webhookSecret))
	mac.Write(rawBody)
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(expectedSig), []byte(signature)) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid webhook signature"})
		return
	}

	var event struct {
		Event   string `json:"event"`
		Payload struct {
			Payment struct {
				Entity struct {
					ID      string `json:"id"`
					OrderID string `json:"order_id"`
				} `json:"entity"`
			} `json:"payment"`
		} `json:"payload"`
	}

	if err := json.Unmarshal(rawBody, &event); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid JSON payload"})
		return
	}

	if event.Event == "payment.captured" {
		orderID := event.Payload.Payment.Entity.OrderID
		paymentID := event.Payload.Payment.Entity.ID

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		var payment models.Payment
		err := config.GetCollection("payments").FindOne(ctx, bson.M{"razorpayOrderId": orderID}).Decode(&payment)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"received": true, "status": "ignored", "message": "Payment order not found"})
			return
		}

		if payment.Status == "completed" {
			c.JSON(http.StatusOK, gin.H{"received": true, "status": "ok", "message": "Already reconciled"})
			return
		}

		now := time.Now()
		var updated models.Payment
		err = config.GetCollection("payments").FindOneAndUpdate(ctx,
			bson.M{"_id": payment.ID, "status": "pending"},
			bson.M{"$set": bson.M{
				"razorpayPaymentId": paymentID,
				"razorpaySignature": signature,
				"status":            "completed",
				"paidAt":            now,
				"updatedAt":         now,
			}},
			options.FindOneAndUpdate().SetReturnDocument(options.After),
		).Decode(&updated)

		if err == nil {
			ReconcilePayment(&updated, "razorpay_webhook")
		}

		c.JSON(http.StatusOK, gin.H{"received": true, "status": "ok", "message": "Payment reconciled successfully"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"received": true, "status": "ok", "message": "Event ignored"})
}
