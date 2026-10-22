package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type Conversation struct {
	ID              bson.ObjectID `bson:"_id,omitempty" json:"_id"`
	User            bson.ObjectID `bson:"user" json:"userId"`
	Driver          bson.ObjectID `bson:"driver" json:"driverId"`
	LastMessage     string        `bson:"lastMessage" json:"lastMessage"`
	LastMessageAt   time.Time     `bson:"lastMessageAt" json:"lastMessageAt"`
	LastSenderModel string        `bson:"lastSenderModel" json:"lastSenderModel"`
	CreatedAt       time.Time     `bson:"createdAt" json:"createdAt"`
	UpdatedAt       time.Time     `bson:"updatedAt" json:"updatedAt"`

	UnreadCount int            `bson:"-" json:"unreadCount"`
	UserObj     *UserSummary   `bson:"-" json:"user,omitempty"`
	DriverObj   *DriverSummary `bson:"-" json:"driver,omitempty"`
}
