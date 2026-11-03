package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type PayoutRequest struct {
	ID            bson.ObjectID `bson:"_id,omitempty" json:"id"`
	DriverID      bson.ObjectID `bson:"driverId" json:"driverId"`
	DriverName    string        `bson:"driverName,omitempty" json:"driverName,omitempty"`
	DriverPhone   string        `bson:"driverPhone,omitempty" json:"driverPhone,omitempty"`
	Amount        float64       `bson:"amount" json:"amount"`
	Method        string        `bson:"method" json:"method"` // "upi" or "bank_transfer"
	UPIID         string        `bson:"upiId,omitempty" json:"upiId,omitempty"`
	AccountNumber string        `bson:"accountNumber,omitempty" json:"accountNumber,omitempty"`
	IFSCCode      string        `bson:"ifscCode,omitempty" json:"ifscCode,omitempty"`
	AccountHolder string        `bson:"accountHolder,omitempty" json:"accountHolder,omitempty"`
	ReferenceID   string        `bson:"referenceId" json:"referenceId"`
	Status        string        `bson:"status" json:"status"` // "pending", "processing", "processed", "rejected", "failed"
	FailureReason string        `bson:"failureReason,omitempty" json:"failureReason,omitempty"`
	GatewayFee    float64       `bson:"gatewayFee" json:"gatewayFee"`
	NetDisbursed  float64       `bson:"netDisbursed" json:"netDisbursed"`
	CreatedAt     time.Time     `bson:"createdAt" json:"createdAt"`
	ProcessedAt   *time.Time    `bson:"processedAt,omitempty" json:"processedAt,omitempty"`
	UpdatedAt     time.Time     `bson:"updatedAt" json:"updatedAt"`
}

