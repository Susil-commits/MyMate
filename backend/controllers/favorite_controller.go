package controllers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"

	"mymate-backend/config"
	"mymate-backend/models"
)

type addFavoriteReq struct {
	DriverID string `json:"driverId" binding:"required"`
}

// GET /api/v1/favorites
func GetFavorites(c *gin.Context) {
	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := config.GetCollection("favorites").Find(ctx, bson.M{"user": userOID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch favorites"})
		return
	}
	defer cursor.Close(ctx)

	var favorites []models.Favorite
	if err := cursor.All(ctx, &favorites); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to decode favorites"})
		return
	}

	driverIDs := make([]bson.ObjectID, 0, len(favorites))
	for _, f := range favorites {
		driverIDs = append(driverIDs, f.Driver)
	}

	var drivers []models.Driver
	if len(driverIDs) > 0 {
		dCursor, err := config.GetCollection("drivers").Find(ctx, bson.M{"_id": bson.M{"$in": driverIDs}})
		if err == nil {
			_ = dCursor.All(ctx, &drivers)
			dCursor.Close(ctx)
		}
	}
	if drivers == nil {
		drivers = []models.Driver{}
	}

	// Sanitize drivers
	for i := range drivers {
		drivers[i].Password = ""
		drivers[i].TwoFactorSecret = ""
	}

	c.JSON(http.StatusOK, gin.H{"favorites": drivers})
}

// POST /api/v1/favorites
func AddFavorite(c *gin.Context) {
	var req addFavoriteReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "driverId is required"})
		return
	}

	driverOID, err := bson.ObjectIDFromHex(req.DriverID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid driver ID"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var driver models.Driver
	if err := config.GetCollection("drivers").FindOne(ctx, bson.M{"_id": driverOID}).Decode(&driver); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Driver not found"})
		return
	}

	now := time.Now()
	fav := models.Favorite{
		ID:        bson.NewObjectID(),
		User:      userOID,
		Driver:    driverOID,
		CreatedAt: now,
	}

	_, err = config.GetCollection("favorites").InsertOne(ctx, fav)
	if err != nil {
		// Unique key constraint violation: already saved
		c.JSON(http.StatusOK, gin.H{"message": "Already saved"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Added to favorites"})
}

// DELETE /api/v1/favorites/:driverId
func RemoveFavorite(c *gin.Context) {
	driverOID, err := bson.ObjectIDFromHex(c.Param("driverId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid driver ID"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, _ = config.GetCollection("favorites").DeleteOne(ctx, bson.M{"user": userOID, "driver": driverOID})
	c.JSON(http.StatusOK, gin.H{"message": "Removed from favorites"})
}

// GET /api/v1/favorites/check/:driverId
func CheckFavorite(c *gin.Context) {
	driverOID, err := bson.ObjectIDFromHex(c.Param("driverId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid driver ID"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var fav models.Favorite
	err = config.GetCollection("favorites").FindOne(ctx, bson.M{"user": userOID, "driver": driverOID}).Decode(&fav)

	c.JSON(http.StatusOK, gin.H{"isFavorited": err == nil})
}
