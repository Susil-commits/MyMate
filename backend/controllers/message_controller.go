package controllers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"mymate-backend/config"
	"mymate-backend/models"
	"mymate-backend/socket"
)

type getOrCreateConvReq struct {
	RecipientID string `json:"recipientId" binding:"required"`
}

type sendMessageReq struct {
	ConversationID string `json:"conversationId" binding:"required"`
	Text           string `json:"text" binding:"required"`
}

func myModel(role string) string {
	if role == "driver" {
		return "Driver"
	}
	return "User"
}

func isConversationMember(conv *models.Conversation, role string, userOID bson.ObjectID) bool {
	if conv == nil {
		return false
	}
	if role == "user" {
		return conv.User == userOID
	}
	if role == "driver" {
		return conv.Driver == userOID
	}
	return false
}

// POST /api/v1/messages/conversations
func GetOrCreateConversation(c *gin.Context) {
	var req getOrCreateConvReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Recipient is required"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)
	roleVal, _ := c.Get("userRole")
	userRole, _ := roleVal.(string)

	if req.RecipientID == userOID.Hex() {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Cannot start a conversation with yourself"})
		return
	}

	recipientOID, err := bson.ObjectIDFromHex(req.RecipientID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid recipient ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Check recipient exists and isActive
	if userRole == "user" {
		var driver models.Driver
		if err := config.GetCollection("drivers").FindOne(ctx, bson.M{"_id": recipientOID}).Decode(&driver); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Recipient not found"})
			return
		}
		if !driver.IsActive {
			c.JSON(http.StatusBadRequest, gin.H{"message": "This account is no longer active"})
			return
		}
	} else {
		var user models.User
		if err := config.GetCollection("users").FindOne(ctx, bson.M{"_id": recipientOID}).Decode(&user); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Recipient not found"})
			return
		}
		if !user.IsActive {
			c.JSON(http.StatusBadRequest, gin.H{"message": "This account is no longer active"})
			return
		}
	}

	var userTarget, driverTarget bson.ObjectID
	if userRole == "user" {
		userTarget = userOID
		driverTarget = recipientOID
	} else {
		userTarget = recipientOID
		driverTarget = userOID
	}

	var conv models.Conversation
	err = config.GetCollection("conversations").FindOne(ctx, bson.M{
		"user":   userTarget,
		"driver": driverTarget,
	}).Decode(&conv)

	if err != nil {
		now := time.Now()
		newConv := models.Conversation{
			ID:            bson.NewObjectID(),
			User:          userTarget,
			Driver:        driverTarget,
			LastMessageAt: now,
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		_, insertErr := config.GetCollection("conversations").InsertOne(ctx, newConv)
		if insertErr != nil {
			// Duplicate key fallback
			_ = config.GetCollection("conversations").FindOne(ctx, bson.M{
				"user":   userTarget,
				"driver": driverTarget,
			}).Decode(&conv)
		} else {
			conv = newConv
		}
	}

	// Populate User & Driver summaries
	var u models.User
	if err := config.GetCollection("users").FindOne(ctx, bson.M{"_id": conv.User}).Decode(&u); err == nil {
		conv.UserObj = &models.UserSummary{
			ID:       u.ID,
			Name:     u.Name,
			Avatar:   u.Avatar,
			Locality: u.Locality,
		}
	}

	var d models.Driver
	if err := config.GetCollection("drivers").FindOne(ctx, bson.M{"_id": conv.Driver}).Decode(&d); err == nil {
		conv.DriverObj = &models.DriverSummary{
			ID:       d.ID,
			Name:     d.Name,
			Avatar:   d.Avatar,
			Locality: d.Locality,
		}
	}

	c.JSON(http.StatusOK, gin.H{"conversation": conv})
}

// GET /api/v1/messages/conversations
func GetConversations(c *gin.Context) {
	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)
	roleVal, _ := c.Get("userRole")
	userRole, _ := roleVal.(string)

	filter := bson.M{"user": userOID}
	if userRole == "driver" {
		filter = bson.M{"driver": userOID}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	findOpts := options.Find().SetSort(bson.M{"lastMessageAt": -1})
	cursor, err := config.GetCollection("conversations").Find(ctx, filter, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch conversations"})
		return
	}
	defer cursor.Close(ctx)

	var conversations []models.Conversation
	if err := cursor.All(ctx, &conversations); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to decode conversations"})
		return
	}
	if conversations == nil {
		conversations = []models.Conversation{}
	}

	me := myModel(userRole)
	for i := range conversations {
		convID := conversations[i].ID

		// Count unread messages
		count, _ := config.GetCollection("messages").CountDocuments(ctx, bson.M{
			"conversation": convID,
			"senderModel":  bson.M{"$ne": me},
			"read":         false,
		})
		conversations[i].UnreadCount = int(count)

		// Populate user
		var u models.User
		if err := config.GetCollection("users").FindOne(ctx, bson.M{"_id": conversations[i].User}).Decode(&u); err == nil {
			conversations[i].UserObj = &models.UserSummary{
				ID:       u.ID,
				Name:     u.Name,
				Avatar:   u.Avatar,
				Locality: u.Locality,
			}
		}

		// Populate driver
		var d models.Driver
		if err := config.GetCollection("drivers").FindOne(ctx, bson.M{"_id": conversations[i].Driver}).Decode(&d); err == nil {
			conversations[i].DriverObj = &models.DriverSummary{
				ID:       d.ID,
				Name:     d.Name,
				Avatar:   d.Avatar,
				Locality: d.Locality,
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"conversations": conversations})
}

// GET /api/v1/messages/:conversationId
func GetMessages(c *gin.Context) {
	convOID, err := bson.ObjectIDFromHex(c.Param("conversationId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid conversation ID"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)
	roleVal, _ := c.Get("userRole")
	userRole, _ := roleVal.(string)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var conv models.Conversation
	if err := config.GetCollection("conversations").FindOne(ctx, bson.M{"_id": convOID}).Decode(&conv); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Conversation not found"})
		return
	}

	if !isConversationMember(&conv, userRole, userOID) {
		c.JSON(http.StatusForbidden, gin.H{"message": "Not authorized"})
		return
	}

	findOpts := options.Find().SetSort(bson.M{"createdAt": 1})
	cursor, err := config.GetCollection("messages").Find(ctx, bson.M{"conversation": convOID}, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch messages"})
		return
	}
	defer cursor.Close(ctx)

	var messages []models.Message
	if err := cursor.All(ctx, &messages); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to decode messages"})
		return
	}
	if messages == nil {
		messages = []models.Message{}
	}

	// Mark messages from other party as read
	me := myModel(userRole)
	_, _ = config.GetCollection("messages").UpdateMany(ctx,
		bson.M{"conversation": convOID, "senderModel": bson.M{"$ne": me}, "read": false},
		bson.M{"$set": bson.M{"read": true, "updatedAt": time.Now()}},
	)

	c.JSON(http.StatusOK, gin.H{"messages": messages})
}

// POST /api/v1/messages
func SendMessage(c *gin.Context) {
	var req sendMessageReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request: " + err.Error()})
		return
	}

	cleanText := strings.TrimSpace(req.Text)
	if cleanText == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Message cannot be empty"})
		return
	}

	convOID, err := bson.ObjectIDFromHex(req.ConversationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid conversation ID"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)
	roleVal, _ := c.Get("userRole")
	userRole, _ := roleVal.(string)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var conv models.Conversation
	if err := config.GetCollection("conversations").FindOne(ctx, bson.M{"_id": convOID}).Decode(&conv); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Conversation not found"})
		return
	}

	if !isConversationMember(&conv, userRole, userOID) {
		c.JSON(http.StatusForbidden, gin.H{"message": "Not authorized"})
		return
	}

	me := myModel(userRole)
	now := time.Now()
	msg := models.Message{
		ID:           bson.NewObjectID(),
		Conversation: convOID,
		Sender:       userOID,
		SenderModel:  me,
		Text:         cleanText,
		Read:         false,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	_, err = config.GetCollection("messages").InsertOne(ctx, msg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to send message", "error": err.Error()})
		return
	}

	// Update preview on conversation
	preview := cleanText
	if len(preview) > 100 {
		preview = preview[:97] + "..."
	}
	_, _ = config.GetCollection("conversations").UpdateOne(ctx,
		bson.M{"_id": convOID},
		bson.M{"$set": bson.M{
			"lastMessage":     preview,
			"lastMessageAt":   now,
			"lastSenderModel": me,
			"updatedAt":       now,
		}},
	)

	// Determine recipient
	var recipientOID bson.ObjectID
	var recipientModel string
	if userRole == "user" {
		recipientOID = conv.Driver
		recipientModel = "Driver"
	} else {
		recipientOID = conv.User
		recipientModel = "User"
	}

	previewShort := cleanText
	if len(previewShort) > 80 {
		previewShort = previewShort[:80]
	}

	notif := models.Notification{
		User:      recipientOID,
		UserModel: recipientModel,
		Title:     "New Message",
		Message:   previewShort,
		Type:      "message",
		Link:      "/messages/" + convOID.Hex(),
		Read:      false,
		CreatedAt: now,
		UpdatedAt: now,
	}
	_, _ = config.GetCollection("notifications").InsertOne(ctx, notif)

	// Broadcast via Socket.IO
	socket.EmitChatMessage(convOID.Hex(), msg)
	socket.EmitNotification(recipientOID.Hex(), map[string]interface{}{
		"title": "New Message",
		"body":  previewShort,
		"link":  "/messages/" + convOID.Hex(),
	})

	c.JSON(http.StatusCreated, gin.H{"message": msg})
}

// PUT /api/v1/messages/:conversationId/read
func MarkConversationRead(c *gin.Context) {
	convOID, err := bson.ObjectIDFromHex(c.Param("conversationId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid conversation ID"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)
	roleVal, _ := c.Get("userRole")
	userRole, _ := roleVal.(string)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var conv models.Conversation
	if err := config.GetCollection("conversations").FindOne(ctx, bson.M{"_id": convOID}).Decode(&conv); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Conversation not found"})
		return
	}

	if !isConversationMember(&conv, userRole, userOID) {
		c.JSON(http.StatusForbidden, gin.H{"message": "Not authorized"})
		return
	}

	me := myModel(userRole)
	_, _ = config.GetCollection("messages").UpdateMany(ctx,
		bson.M{"conversation": convOID, "senderModel": bson.M{"$ne": me}, "read": false},
		bson.M{"$set": bson.M{"read": true, "updatedAt": time.Now()}},
	)

	c.JSON(http.StatusOK, gin.H{"message": "Marked as read"})
}
