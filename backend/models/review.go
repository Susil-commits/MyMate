package models

import (
	"context"
	"math"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type Review struct {
	ID        bson.ObjectID `bson:"_id,omitempty" json:"_id"`
	User      bson.ObjectID `bson:"user" json:"userId"`
	Driver    bson.ObjectID `bson:"driver" json:"driverId"`
	Booking   bson.ObjectID `bson:"booking" json:"bookingId"`
	Rating    float64       `bson:"rating" json:"rating"`
	Comment   string        `bson:"comment" json:"comment"`
	CreatedAt time.Time     `bson:"createdAt" json:"createdAt"`
	UpdatedAt time.Time     `bson:"updatedAt" json:"updatedAt"`

	UserObj *UserSummary `bson:"-" json:"user,omitempty"`
}

func UpdateDriverRating(ctx context.Context, db *mongo.Database, driverID bson.ObjectID) error {
	pipeline := mongo.Pipeline{
		bson.D{{Key: "$match", Value: bson.D{{Key: "driver", Value: driverID}}}},
		bson.D{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: "$driver"},
			{Key: "averageRating", Value: bson.D{{Key: "$avg", Value: "$rating"}}},
			{Key: "totalReviews", Value: bson.D{{Key: "$sum", Value: 1}}},
		}}},
	}

	cursor, err := db.Collection("reviews").Aggregate(ctx, pipeline)
	if err != nil {
		return err
	}
	defer cursor.Close(ctx)

	var results []struct {
		AverageRating float64 `bson:"averageRating"`
		TotalReviews  int     `bson:"totalReviews"`
	}
	if err := cursor.All(ctx, &results); err != nil {
		return err
	}

	avgRating := 0.0
	totalReviews := 0
	if len(results) > 0 {
		avgRating = math.Round(results[0].AverageRating*10) / 10
		totalReviews = results[0].TotalReviews
	}

	_, err = db.Collection("drivers").UpdateOne(ctx,
		bson.D{{Key: "_id", Value: driverID}},
		bson.D{{Key: "$set", Value: bson.D{
			{Key: "averageRating", Value: avgRating},
			{Key: "totalReviews", Value: totalReviews},
		}}},
	)
	return err
}
