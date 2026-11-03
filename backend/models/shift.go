package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type ShiftRoster struct {
	ID                 bson.ObjectID `bson:"_id,omitempty" json:"id"`
	OrganizationID     bson.ObjectID `bson:"organizationId" json:"organizationId"`
	OrganizationName   string        `bson:"organizationName" json:"organizationName"`
	DriverID           bson.ObjectID `bson:"driverId" json:"driverId"`
	DriverName         string        `bson:"driverName" json:"driverName"`
	DriverAvatar       string        `bson:"driverAvatar" json:"driverAvatar"`
	DriverPhone        string        `bson:"driverPhone" json:"driverPhone"`
	Title              string        `bson:"title" json:"title"`
	CostCenter         string        `bson:"costCenter" json:"costCenter"`
	StartDate          time.Time     `bson:"startDate" json:"startDate"`
	EndDate            time.Time     `bson:"endDate" json:"endDate"`
	DailyStartTime     string        `bson:"dailyStartTime" json:"dailyStartTime"`
	DailyEndTime       string        `bson:"dailyEndTime" json:"dailyEndTime"`
	DaysOfWeek         []string      `bson:"daysOfWeek" json:"daysOfWeek"`
	DailyRate          float64       `bson:"dailyRate" json:"dailyRate"`
	TotalEstimatedDays int           `bson:"totalEstimatedDays" json:"totalEstimatedDays"`
	TotalAmount        float64       `bson:"totalAmount" json:"totalAmount"`
	Status             string        `bson:"status" json:"status"` // "confirmed", "active", "completed", "cancelled"
	PickupLocation     string        `bson:"pickupLocation" json:"pickupLocation"`
	CreatedAt          time.Time     `bson:"createdAt" json:"createdAt"`
	UpdatedAt          time.Time     `bson:"updatedAt" json:"updatedAt"`
}

