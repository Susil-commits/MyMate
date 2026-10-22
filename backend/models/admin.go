package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"golang.org/x/crypto/bcrypt"
)

type Admin struct {
	ID          bson.ObjectID `bson:"_id,omitempty" json:"_id"`
	Email       string        `bson:"email" json:"email"`
	Password    string        `bson:"password" json:"-"`
	Role        string        `bson:"role" json:"role"`
	LastLoginAt *time.Time    `bson:"lastLoginAt,omitempty" json:"lastLoginAt,omitempty"`
	CreatedAt   time.Time     `bson:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time     `bson:"updatedAt" json:"updatedAt"`
}

func (a *Admin) ComparePassword(candidate string) bool {
	if a.Password == "" {
		return false
	}
	err := bcrypt.CompareHashAndPassword([]byte(a.Password), []byte(candidate))
	return err == nil
}
