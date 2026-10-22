package controllers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"mymate-backend/config"
	"mymate-backend/models"
)

// GET /api/v1/admin/audit-logs
func GetAuditLogs(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	findOpts := options.Find().SetSort(bson.M{"createdAt": -1}).SetLimit(100)
	cursor, err := config.GetCollection("audit_logs").Find(ctx, bson.M{}, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to fetch audit logs"})
		return
	}
	defer cursor.Close(ctx)

	var logs []models.AuditLog
	if err := cursor.All(ctx, &logs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to decode audit logs"})
		return
	}
	if logs == nil {
		logs = []models.AuditLog{}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Audit logs retrieved",
		"data":    gin.H{"logs": logs},
	})
}

// Helper to log audit actions asynchronously
func LogAudit(userOID *bson.ObjectID, userType, action string, details interface{}, ipAddress string) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		now := time.Now()
		log := models.AuditLog{
			ID:        bson.NewObjectID(),
			User:      userOID,
			UserType:  userType,
			Action:    action,
			Details:   details,
			IPAddress: ipAddress,
			CreatedAt: now,
			UpdatedAt: now,
		}
		_, _ = config.GetCollection("audit_logs").InsertOne(ctx, log)
	}()
}
