package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type AuditLog struct {
	ID        bson.ObjectID  `bson:"_id,omitempty" json:"_id"`
	User      *bson.ObjectID `bson:"user,omitempty" json:"user,omitempty"`
	UserType  string         `bson:"userType" json:"userType"`
	Action    string         `bson:"action" json:"action"`
	Details   interface{}    `bson:"details,omitempty" json:"details,omitempty"`
	IPAddress string         `bson:"ipAddress,omitempty" json:"ipAddress,omitempty"`
	CreatedAt time.Time      `bson:"createdAt" json:"createdAt"`
	UpdatedAt time.Time      `bson:"updatedAt" json:"updatedAt"`
}
