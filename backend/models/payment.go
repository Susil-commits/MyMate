package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type Payment struct {
	ID                bson.ObjectID `bson:"_id,omitempty" json:"_id"`
	Booking           bson.ObjectID `bson:"booking" json:"booking"`
	User              bson.ObjectID `bson:"user" json:"user"`
	Driver            bson.ObjectID `bson:"driver" json:"driver"`
	Amount            float64       `bson:"amount" json:"amount"`
	Currency          string        `bson:"currency" json:"currency"`
	RazorpayOrderID   string        `bson:"razorpayOrderId" json:"razorpayOrderId"`
	RazorpayPaymentID string        `bson:"razorpayPaymentId,omitempty" json:"razorpayPaymentId,omitempty"`
	RazorpaySignature string        `bson:"razorpaySignature,omitempty" json:"razorpaySignature,omitempty"`
	Status            string        `bson:"status" json:"status"`
	PaidAt            *time.Time    `bson:"paidAt,omitempty" json:"paidAt,omitempty"`
	CreatedAt         time.Time     `bson:"createdAt" json:"createdAt"`
	UpdatedAt         time.Time     `bson:"updatedAt" json:"updatedAt"`
}
