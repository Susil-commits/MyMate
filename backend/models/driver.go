package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"golang.org/x/crypto/bcrypt"
)

type GeoPoint struct {
	Type        string    `bson:"type" json:"type"`
	Coordinates []float64 `bson:"coordinates" json:"coordinates"` // [longitude, latitude]
}

type Driver struct {
	ID                      bson.ObjectID `bson:"_id,omitempty" json:"_id"`
	Name                    string        `bson:"name" json:"name"`
	Email                   string        `bson:"email" json:"email"`
	Password                string        `bson:"password" json:"-"`
	Avatar                  ImageRef      `bson:"avatar" json:"avatar"`
	Gender                  string        `bson:"gender" json:"gender"`
	Phone                   string        `bson:"phone" json:"phone"`
	Nationality             string        `bson:"nationality" json:"nationality"`
	Locality                string        `bson:"locality" json:"locality"`
	Location                GeoPoint      `bson:"location" json:"location"`
	LicenseNumber           string        `bson:"licenseNumber,omitempty" json:"licenseNumber,omitempty"`
	LicenseImage            ImageRef      `bson:"licenseImage" json:"licenseImage"`
	ExperienceYears         float64       `bson:"experienceYears" json:"experienceYears"`
	VehicleTypes            []string      `bson:"vehicleTypes" json:"vehicleTypes"`
	Availability            string        `bson:"availability" json:"availability"`
	HourlyRate              float64       `bson:"hourlyRate" json:"hourlyRate"`
	DailyRate               float64       `bson:"dailyRate" json:"dailyRate"`
	Languages               []string      `bson:"languages" json:"languages"`
	Bio                     string        `bson:"bio" json:"bio"`
	ProfileCompleted        bool          `bson:"profileCompleted" json:"profileCompleted"`
	KycStatus               string        `bson:"kycStatus" json:"kycStatus"`
	IsActive                bool          `bson:"isActive" json:"isActive"`
	TokenVersion            int           `bson:"tokenVersion" json:"tokenVersion"`
	IsEmailVerified         bool          `bson:"isEmailVerified" json:"isEmailVerified"`
	EmailVerificationToken  string        `bson:"emailVerificationToken,omitempty" json:"-"`
	EmailVerificationExpire *time.Time    `bson:"emailVerificationExpire,omitempty" json:"-"`
	AverageRating           float64       `bson:"averageRating" json:"averageRating"`
	TotalReviews            int           `bson:"totalReviews" json:"totalReviews"`
	WalletBalance           float64       `bson:"walletBalance" json:"walletBalance"`
	Role                    string        `bson:"role" json:"role"`
	ResetPasswordToken      string        `bson:"resetPasswordToken,omitempty" json:"-"`
	ResetPasswordExpire     *time.Time    `bson:"resetPasswordExpire,omitempty" json:"-"`
	IsTwoFactorEnabled      bool          `bson:"isTwoFactorEnabled" json:"isTwoFactorEnabled"`
	TwoFactorSecret         string        `bson:"twoFactorSecret,omitempty" json:"-"`
	DeletedAt               *time.Time    `bson:"deletedAt,omitempty" json:"deletedAt,omitempty"`
	CreatedAt               time.Time     `bson:"createdAt" json:"createdAt"`
	UpdatedAt               time.Time     `bson:"updatedAt" json:"updatedAt"`
}

func (d *Driver) ComparePassword(candidate string) bool {
	if d.Password == "" {
		return false
	}
	err := bcrypt.CompareHashAndPassword([]byte(d.Password), []byte(candidate))
	return err == nil
}

type SanitizedDriver struct {
	ID                bson.ObjectID `json:"_id"`
	Name              string        `json:"name"`
	Locality          string        `json:"locality"`
	Nationality       string        `json:"nationality"`
	Availability      string        `json:"availability"`
	AverageRating     float64       `json:"averageRating"`
	TotalReviews      int           `json:"totalReviews"`
	ExperienceYears   float64       `json:"experienceYears"`
	VehicleTypes      []string      `json:"vehicleTypes"`
	HourlyRate        float64       `json:"hourlyRate"`
	DailyRate         float64       `json:"dailyRate"`
	Languages         []string      `json:"languages"`
	Bio               string        `json:"bio"`
	KycStatus         string        `json:"kycStatus"`
	Avatar            ImageRef      `json:"avatar"`
	CreatedAt         time.Time     `json:"createdAt"`
	DocumentsVerified bool          `json:"documentsVerified"`
	Phone             string        `json:"phone,omitempty"`
	AIScore           *int          `json:"aiScore,omitempty"`
	AIRankedBy        string        `json:"aiRankedBy,omitempty"`
}

func SanitizeDriver(d *Driver, withContact bool) SanitizedDriver {
	if d == nil {
		return SanitizedDriver{}
	}
	res := SanitizedDriver{
		ID:                d.ID,
		Name:              d.Name,
		Locality:          d.Locality,
		Nationality:       d.Nationality,
		Availability:      d.Availability,
		AverageRating:     d.AverageRating,
		TotalReviews:      d.TotalReviews,
		ExperienceYears:   d.ExperienceYears,
		VehicleTypes:      d.VehicleTypes,
		HourlyRate:        d.HourlyRate,
		DailyRate:         d.DailyRate,
		Languages:         d.Languages,
		Bio:               d.Bio,
		KycStatus:         d.KycStatus,
		Avatar:            d.Avatar,
		CreatedAt:         d.CreatedAt,
		DocumentsVerified: d.KycStatus == "approved",
	}
	if withContact {
		res.Phone = d.Phone
	}
	return res
}
