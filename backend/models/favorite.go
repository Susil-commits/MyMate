package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type Favorite struct {
	ID        bson.ObjectID `bson:"_id,omitempty" json:"_id"`
	User      bson.ObjectID `bson:"user" json:"userId"`
	Driver    bson.ObjectID `bson:"driver" json:"driverId"`
	CreatedAt time.Time     `bson:"createdAt" json:"createdAt"`

	DriverObj *SanitizedDriver `bson:"-" json:"driver,omitempty"`
}
