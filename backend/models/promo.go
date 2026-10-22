package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type PromoCode struct {
	ID                 bson.ObjectID `bson:"_id,omitempty" json:"_id"`
	Code               string        `bson:"code" json:"code"`
	DiscountPercentage float64       `bson:"discountPercentage" json:"discountPercentage"`
	MaxDiscount        float64       `bson:"maxDiscount" json:"maxDiscount"`
	ExpiryDate         time.Time     `bson:"expiryDate" json:"expiryDate"`
	UsageLimit         *int          `bson:"usageLimit,omitempty" json:"usageLimit,omitempty"`
	UsedCount          int           `bson:"usedCount" json:"usedCount"`
	IsActive           bool          `bson:"isActive" json:"isActive"`
	CreatedAt          time.Time     `bson:"createdAt" json:"createdAt"`
	UpdatedAt          time.Time     `bson:"updatedAt" json:"updatedAt"`
}
