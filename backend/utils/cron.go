package utils

import (
	"context"
	"log"
	"time"

	"mymate-backend/config"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func StartCronJobs() {
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()

		for range ticker.C {
			cleanStaleBookings()
		}
	}()

	log.Println("[Cron] Background cron jobs initialized.")
}

func cleanStaleBookings() {
	if config.DB == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	twentyFourHoursAgo := time.Now().Add(-24 * time.Hour)

	filter := bson.D{
		{Key: "status", Value: "pending"},
		{Key: "createdAt", Value: bson.D{{Key: "$lt", Value: twentyFourHoursAgo}}},
	}

	update := bson.D{
		{Key: "$set", Value: bson.D{
			{Key: "status", Value: "cancelled"},
			{Key: "cancellationReason", Value: "Auto-cancelled due to driver inactivity"},
			{Key: "updatedAt", Value: time.Now()},
		}},
	}

	res, err := config.DB.Collection("bookings").UpdateMany(ctx, filter, update)
	if err != nil {
		log.Printf("[Cron Error] Failed to auto-cancel stale bookings: %v", err)
		return
	}

	if res.ModifiedCount > 0 {
		log.Printf("[Cron] Auto-cancelled %d stale pending bookings.", res.ModifiedCount)
	}
}
