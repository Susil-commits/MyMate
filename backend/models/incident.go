package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type Incident struct {
	ID               bson.ObjectID  `bson:"_id,omitempty" json:"id"`
	BookingID        bson.ObjectID  `bson:"bookingId" json:"bookingId"`
	TriggeredBy      bson.ObjectID  `bson:"triggeredBy" json:"triggeredBy"`
	TriggeredByModel string         `bson:"triggeredByModel" json:"triggeredByModel"` // "User" or "Driver"
	RiderName        string         `bson:"riderName,omitempty" json:"riderName,omitempty"`
	RiderPhone       string         `bson:"riderPhone,omitempty" json:"riderPhone,omitempty"`
	DriverName       string         `bson:"driverName,omitempty" json:"driverName,omitempty"`
	DriverPhone      string         `bson:"driverPhone,omitempty" json:"driverPhone,omitempty"`
	VehicleNumber    string         `bson:"vehicleNumber,omitempty" json:"vehicleNumber,omitempty"`
	VehicleModel     string         `bson:"vehicleModel,omitempty" json:"vehicleModel,omitempty"`
	Coordinates      []float64      `bson:"coordinates" json:"coordinates"` // [lng, lat]
	Locality         string         `bson:"locality,omitempty" json:"locality,omitempty"`
	Reason           string         `bson:"reason" json:"reason"`
	Status           string         `bson:"status" json:"status"` // "triggered", "acknowledged", "dispatched", "resolved"
	AdminNotes       string         `bson:"adminNotes,omitempty" json:"adminNotes,omitempty"`
	ResolvedBy       *bson.ObjectID `bson:"resolvedBy,omitempty" json:"resolvedBy,omitempty"`
	ResolvedAt       *time.Time     `bson:"resolvedAt,omitempty" json:"resolvedAt,omitempty"`
	CreatedAt        time.Time      `bson:"createdAt" json:"createdAt"`
	UpdatedAt        time.Time      `bson:"updatedAt" json:"updatedAt"`
}

