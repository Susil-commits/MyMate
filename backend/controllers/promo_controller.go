package controllers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"

	"mymate-backend/config"
	"mymate-backend/models"
)

type validatePromoReq struct {
	Code string `json:"code" binding:"required"`
}

type createPromoReq struct {
	Code               string    `json:"code" binding:"required"`
	DiscountPercentage float64   `json:"discountPercentage" binding:"required,gt=0,lte=100"`
	MaxDiscount        float64   `json:"maxDiscount" binding:"required,gte=0"`
	ExpiryDate         time.Time `json:"expiryDate" binding:"required"`
	UsageLimit         *int      `json:"usageLimit"`
}

// GET /api/v1/promos
func GetPromoCodes(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{
		"isActive":   true,
		"expiryDate": bson.M{"$gt": time.Now()},
	}

	cursor, err := config.GetCollection("promocodes").Find(ctx, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Server Error", "error": err.Error()})
		return
	}
	defer cursor.Close(ctx)

	var promos []models.PromoCode
	if err := cursor.All(ctx, &promos); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Server Error", "error": err.Error()})
		return
	}
	if promos == nil {
		promos = []models.PromoCode{}
	}

	c.JSON(http.StatusOK, gin.H{"promos": promos})
}

// POST /api/v1/promos/validate
func ValidatePromoCode(c *gin.Context) {
	var req validatePromoReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Promo code is required"})
		return
	}

	codeUpper := strings.ToUpper(strings.TrimSpace(req.Code))
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var promo models.PromoCode
	err := config.GetCollection("promocodes").FindOne(ctx, bson.M{
		"code":       codeUpper,
		"isActive":   true,
		"expiryDate": bson.M{"$gt": time.Now()},
	}).Decode(&promo)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Invalid or expired promo code"})
		return
	}

	if promo.UsageLimit != nil && promo.UsedCount >= *promo.UsageLimit {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Promo code usage limit reached"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"promo": promo})
}

// POST /api/v1/promos/create
func CreatePromoCode(c *gin.Context) {
	var req createPromoReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request: " + err.Error()})
		return
	}

	codeUpper := strings.ToUpper(strings.TrimSpace(req.Code))
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var existing models.PromoCode
	if err := config.GetCollection("promocodes").FindOne(ctx, bson.M{"code": codeUpper}).Decode(&existing); err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Promo code already exists"})
		return
	}

	now := time.Now()
	promo := models.PromoCode{
		ID:                 bson.NewObjectID(),
		Code:               codeUpper,
		DiscountPercentage: req.DiscountPercentage,
		MaxDiscount:        req.MaxDiscount,
		ExpiryDate:         req.ExpiryDate,
		UsageLimit:         req.UsageLimit,
		UsedCount:          0,
		IsActive:           true,
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	_, err := config.GetCollection("promocodes").InsertOne(ctx, promo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Server Error", "error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"promo": promo})
}
