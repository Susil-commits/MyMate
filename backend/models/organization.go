package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type Organization struct {
	ID                bson.ObjectID   `bson:"_id,omitempty" json:"id"`
	Name              string          `bson:"name" json:"name"`
	GSTIN             string          `bson:"gstin" json:"gstin"`
	BillingEmail      string          `bson:"billingEmail" json:"billingEmail"`
	Phone             string          `bson:"phone" json:"phone"`
	Address           string          `bson:"address" json:"address"`
	MonthlyBudget     float64         `bson:"monthlyBudget" json:"monthlyBudget"`
	CurrentMonthSpend float64         `bson:"currentMonthSpend" json:"currentMonthSpend"`
	CostCenters       []string        `bson:"costCenters" json:"costCenters"`
	AdminUser         bson.ObjectID   `bson:"adminUser" json:"adminUser"`
	Members           []bson.ObjectID `bson:"members" json:"members"`
	IsActive          bool            `bson:"isActive" json:"isActive"`
	CreatedAt         time.Time       `bson:"createdAt" json:"createdAt"`
	UpdatedAt         time.Time       `bson:"updatedAt" json:"updatedAt"`
}

type CorporateBookingSummary struct {
	BookingID   string    `json:"bookingId"`
	Employee    string    `json:"employee"`
	CostCenter  string    `json:"costCenter"`
	DriverName  string    `json:"driverName"`
	HireType    string    `json:"hireType"`
	TotalAmount float64   `json:"totalAmount"`
	Status      string    `json:"status"`
	Date        time.Time `json:"date"`
}

