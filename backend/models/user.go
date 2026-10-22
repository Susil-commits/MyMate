package models

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"golang.org/x/crypto/bcrypt"
)

type ImageRef struct {
	URL      string `bson:"url" json:"url"`
	PublicID string `bson:"publicId" json:"publicId"`
}

type User struct {
	ID                      bson.ObjectID `bson:"_id,omitempty" json:"_id"`
	Name                    string        `bson:"name" json:"name"`
	Email                   string        `bson:"email" json:"email"`
	Password                string        `bson:"password" json:"-"`
	Avatar                  ImageRef      `bson:"avatar" json:"avatar"`
	Gender                  string        `bson:"gender" json:"gender"`
	Phone                   string        `bson:"phone" json:"phone"`
	Locality                string        `bson:"locality" json:"locality"`
	ProfileCompleted        bool          `bson:"profileCompleted" json:"profileCompleted"`
	IsActive                bool          `bson:"isActive" json:"isActive"`
	TokenVersion            int           `bson:"tokenVersion" json:"tokenVersion"`
	IsEmailVerified         bool          `bson:"isEmailVerified" json:"isEmailVerified"`
	EmailVerificationToken  string        `bson:"emailVerificationToken,omitempty" json:"-"`
	EmailVerificationExpire *time.Time    `bson:"emailVerificationExpire,omitempty" json:"-"`
	Role                    string        `bson:"role" json:"role"`
	ResetPasswordToken      string        `bson:"resetPasswordToken,omitempty" json:"-"`
	ResetPasswordExpire     *time.Time    `bson:"resetPasswordExpire,omitempty" json:"-"`
	IsTwoFactorEnabled      bool          `bson:"isTwoFactorEnabled" json:"isTwoFactorEnabled"`
	TwoFactorSecret         string        `bson:"twoFactorSecret,omitempty" json:"-"`
	WalletBalance           float64       `bson:"walletBalance" json:"walletBalance"`
	DeletedAt               *time.Time    `bson:"deletedAt,omitempty" json:"deletedAt,omitempty"`
	CreatedAt               time.Time     `bson:"createdAt" json:"createdAt"`
	UpdatedAt               time.Time     `bson:"updatedAt" json:"updatedAt"`
}

func (u *User) ComparePassword(candidate string) bool {
	if u.Password == "" {
		return false
	}
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(candidate))
	return err == nil
}

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	return string(bytes), err
}

func HashToken(token string) string {
	h := sha256.New()
	h.Write([]byte(token))
	return hex.EncodeToString(h.Sum(nil))
}

func GenerateCryptoToken() (raw, hashed string) {
	bytes := make([]byte, 32)
	_, _ = rand.Read(bytes)
	raw = hex.EncodeToString(bytes)
	hashed = HashToken(raw)
	return raw, hashed
}
