package services

import (
	"context"
	"math"
	"time"

	"mymate-backend/config"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func CalculateDynamicSurge(start time.Time) float64 {
	baseMultiplier := 1.0

	// 1. Time-based surge
	hour := start.Hour()
	if (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19) {
		baseMultiplier += 0.5 // Peak rush hours (+50%)
	} else if hour >= 23 || hour < 5 {
		baseMultiplier += 0.25 // Late-night (+25%)
	}

	// 2. Supply vs demand ratio
	if config.DB != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()

		activeDrivers, err1 := config.DB.Collection("drivers").CountDocuments(ctx, bson.D{
			{Key: "isActive", Value: true},
			{Key: "kycStatus", Value: "approved"},
		})
		activeBookings, err2 := config.DB.Collection("bookings").CountDocuments(ctx, bson.D{
			{Key: "status", Value: bson.D{{Key: "$in", Value: bson.A{"pending", "ongoing", "accepted"}}}},
		})

		if err1 == nil && err2 == nil {
			if activeDrivers == 0 && activeBookings > 0 {
				baseMultiplier += 1.0
			} else if activeDrivers > 0 {
				ratio := float64(activeBookings) / float64(activeDrivers)
				if ratio > 2.0 {
					baseMultiplier += 0.8
				} else if ratio > 1.0 {
					baseMultiplier += 0.4
				} else if ratio > 0.5 {
					baseMultiplier += 0.1
				}
			}
		}
	}

	return math.Min(baseMultiplier, 3.0)
}
