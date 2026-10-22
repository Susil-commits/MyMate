package models

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type Notification struct {
	ID        bson.ObjectID `bson:"_id,omitempty" json:"_id"`
	User      bson.ObjectID `bson:"user" json:"user"`
	UserModel string        `bson:"userModel" json:"userModel"`
	Title     string        `bson:"title" json:"title"`
	Message   string        `bson:"message" json:"message"`
	Type      string        `bson:"type" json:"type"`
	Link      string        `bson:"link" json:"link"`
	Read      bool          `bson:"read" json:"read"`
	CreatedAt time.Time     `bson:"createdAt" json:"createdAt"`
	UpdatedAt time.Time     `bson:"updatedAt" json:"updatedAt"`
}

func CreateNotification(ctx context.Context, db *mongo.Database, notif Notification) error {
	notif.CreatedAt = time.Now()
	notif.UpdatedAt = time.Now()
	if notif.Type == "" {
		notif.Type = "system"
	}
	_, err := db.Collection("notifications").InsertOne(ctx, notif)
	return err
}
