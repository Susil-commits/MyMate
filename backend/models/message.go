package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type Message struct {
	ID           bson.ObjectID `bson:"_id,omitempty" json:"_id"`
	Conversation bson.ObjectID `bson:"conversation" json:"conversation"`
	Sender       bson.ObjectID `bson:"sender" json:"sender"`
	SenderModel  string        `bson:"senderModel" json:"senderModel"`
	Text         string        `bson:"text" json:"text"`
	Read         bool          `bson:"read" json:"read"`
	CreatedAt    time.Time     `bson:"createdAt" json:"createdAt"`
	UpdatedAt    time.Time     `bson:"updatedAt" json:"updatedAt"`
}
