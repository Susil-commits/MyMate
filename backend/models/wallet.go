package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type WalletTransaction struct {
	ID          bson.ObjectID  `bson:"_id,omitempty" json:"_id"`
	Owner       bson.ObjectID  `bson:"owner" json:"owner"`
	OwnerModel  string         `bson:"ownerModel" json:"ownerModel"`
	Type        string         `bson:"type" json:"type"`
	Amount      float64        `bson:"amount" json:"amount"`
	Description string         `bson:"description" json:"description"`
	Booking     *bson.ObjectID `bson:"booking,omitempty" json:"bookingId,omitempty"`
	Status      string         `bson:"status" json:"status"`
	CreatedAt   time.Time      `bson:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time      `bson:"updatedAt" json:"updatedAt"`

	BookingObj *BookingTripSummary `bson:"-" json:"booking,omitempty"`
}

type BookingTripSummary struct {
	ID             bson.ObjectID `json:"_id"`
	PickupLocation string        `json:"pickupLocation"`
	DropLocation   string        `json:"dropLocation"`
	Status         string        `json:"status"`
}
