package controllers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"mymate-backend/config"
	"mymate-backend/models"
)

// GET /api/v1/notifications
func GetNotifications(c *gin.Context) {
	roleVal, _ := c.Get("userRole")
	userRole, _ := roleVal.(string)

	if userRole == "admin" {
		c.JSON(http.StatusOK, gin.H{"notifications": []models.Notification{}, "unreadCount": 0})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)
	me := myModel(userRole)

	filter := bson.M{"user": userOID, "userModel": me}

	limit := 20
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			if parsed > 50 {
				parsed = 50
			}
			limit = parsed
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	findOpts := options.Find().SetSort(bson.M{"createdAt": -1}).SetLimit(int64(limit))
	cursor, err := config.GetCollection("notifications").Find(ctx, filter, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch notifications"})
		return
	}
	defer cursor.Close(ctx)

	var notifications []models.Notification
	if err := cursor.All(ctx, &notifications); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to decode notifications"})
		return
	}
	if notifications == nil {
		notifications = []models.Notification{}
	}

	unreadFilter := bson.M{"user": userOID, "userModel": me, "read": false}
	unreadCount, _ := config.GetCollection("notifications").CountDocuments(ctx, unreadFilter)

	c.JSON(http.StatusOK, gin.H{
		"notifications": notifications,
		"unreadCount":   unreadCount,
	})
}

// PUT /api/v1/notifications/read-all
func MarkAsRead(c *gin.Context) {
	roleVal, _ := c.Get("userRole")
	userRole, _ := roleVal.(string)

	if userRole == "admin" {
		c.JSON(http.StatusOK, gin.H{"message": "No notifications"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)
	me := myModel(userRole)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, _ = config.GetCollection("notifications").UpdateMany(ctx,
		bson.M{"user": userOID, "userModel": me, "read": false},
		bson.M{"$set": bson.M{"read": true, "updatedAt": time.Now()}},
	)

	c.JSON(http.StatusOK, gin.H{"message": "All notifications marked as read"})
}

// PUT /api/v1/notifications/:id/read
func MarkOneAsRead(c *gin.Context) {
	roleVal, _ := c.Get("userRole")
	userRole, _ := roleVal.(string)

	if userRole == "admin" {
		c.JSON(http.StatusOK, gin.H{"message": "No notifications"})
		return
	}

	notifOID, err := bson.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid notification ID"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)
	me := myModel(userRole)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, _ = config.GetCollection("notifications").UpdateOne(ctx,
		bson.M{"_id": notifOID, "user": userOID, "userModel": me},
		bson.M{"$set": bson.M{"read": true, "updatedAt": time.Now()}},
	)

	c.JSON(http.StatusOK, gin.H{"message": "Notification marked as read"})
}
