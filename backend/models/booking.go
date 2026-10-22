package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type LatLng struct {
	Lat float64 `bson:"lat" json:"lat"`
	Lng float64 `bson:"lng" json:"lng"`
}

type Booking struct {
	ID                    bson.ObjectID  `bson:"_id,omitempty" json:"_id"`
	User                  bson.ObjectID  `bson:"user" json:"userId"`
	Driver                bson.ObjectID  `bson:"driver" json:"driverId"`
	HireType              string         `bson:"hireType" json:"hireType"`
	Status                string         `bson:"status" json:"status"`
	StartDate             time.Time      `bson:"startDate" json:"startDate"`
	EndDate               *time.Time     `bson:"endDate,omitempty" json:"endDate,omitempty"`
	PickupLocation        string         `bson:"pickupLocation" json:"pickupLocation"`
	PickupCoordinates     *LatLng        `bson:"pickupCoordinates,omitempty" json:"pickupCoordinates,omitempty"`
	DropLocation          string         `bson:"dropLocation" json:"dropLocation"`
	Stops                 []string       `bson:"stops" json:"stops"`
	Purpose               string         `bson:"purpose" json:"purpose"`
	BaseAmount            float64        `bson:"baseAmount" json:"baseAmount"`
	SurgeMultiplier       float64        `bson:"surgeMultiplier" json:"surgeMultiplier"`
	TotalAmount           float64        `bson:"totalAmount" json:"totalAmount"`
	PromoCode             string         `bson:"promoCode,omitempty" json:"promoCode,omitempty"`
	DiscountAmount        float64        `bson:"discountAmount" json:"discountAmount"`
	IsRecurring           bool           `bson:"isRecurring" json:"isRecurring"`
	RecurringPattern      string         `bson:"recurringPattern" json:"recurringPattern"`
	RecurringEndDate      *time.Time     `bson:"recurringEndDate,omitempty" json:"recurringEndDate,omitempty"`
	RecurringGroupId      string         `bson:"recurringGroupId,omitempty" json:"recurringGroupId,omitempty"`
	CancellationReason    string         `bson:"cancellationReason" json:"cancellationReason"`
	PaymentStatus         string         `bson:"paymentStatus" json:"paymentStatus"`
	DriverArrivedNotified bool           `bson:"driverArrivedNotified" json:"driverArrivedNotified"`
	CreatedAt             time.Time      `bson:"createdAt" json:"createdAt"`
	UpdatedAt             time.Time      `bson:"updatedAt" json:"updatedAt"`

	// Populated view fields for API JSON responses
	UserObj   *UserSummary   `bson:"-" json:"user,omitempty"`
	DriverObj *DriverSummary `bson:"-" json:"driver,omitempty"`
}

type UserSummary struct {
	ID       bson.ObjectID `json:"_id"`
	Name     string        `json:"name"`
	Phone    string        `json:"phone,omitempty"`
	Email    string        `json:"email,omitempty"`
	Avatar   ImageRef      `json:"avatar"`
	Locality string        `json:"locality,omitempty"`
}

type DriverSummary struct {
	ID            bson.ObjectID `json:"_id"`
	Name          string        `json:"name"`
	Phone         string        `json:"phone,omitempty"`
	Email         string        `json:"email,omitempty"`
	Locality      string        `json:"locality"`
	Avatar        ImageRef      `json:"avatar"`
	AverageRating float64       `json:"averageRating"`
}
