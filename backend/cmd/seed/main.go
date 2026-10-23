package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"mymate-backend/config"
	"mymate-backend/models"

	"go.mongodb.org/mongo-driver/v2/bson"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	cfg := config.LoadConfig()
	if cfg.MongoURI == "" {
		log.Fatal("MONGO_URI not set")
	}

	client, err := config.ConnectDB()
	if err != nil {
		log.Fatalf("DB connection failed: %v", err)
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = client.Disconnect(ctx)
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	adminColl := config.GetCollection("admins")
	adminEmail := cfg.AdminEmail
	if adminEmail == "" {
		adminEmail = "admin@mymate.com"
	}

	var existing models.Admin
	err = adminColl.FindOne(ctx, bson.M{"email": adminEmail}).Decode(&existing)
	if err == nil {
		fmt.Printf("Admin account already exists: %s\n", adminEmail)
	} else {
		hash, _ := bcrypt.GenerateFromPassword([]byte("adminpassword123"), bcrypt.DefaultCost)
		newAdmin := models.Admin{
			ID:        bson.NewObjectID(),
			Email:     adminEmail,
			Password:  string(hash),
			Role:      "admin",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		_, err := adminColl.InsertOne(ctx, newAdmin)
		if err != nil {
			log.Fatalf("Failed to create admin: %v", err)
		}
		fmt.Printf("Default admin created: %s (password: adminpassword123)\n", adminEmail)
	}

	// Seed Sample Drivers if drivers collection is empty
	driverColl := config.GetCollection("drivers")
	driverCount, _ := driverColl.CountDocuments(ctx, bson.M{})
	if driverCount == 0 {
		fmt.Println("Drivers collection is empty. Seeding verified sample drivers...")
		pwdHash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)

		sampleDrivers := []models.Driver{
			{
				ID:               bson.NewObjectID(),
				Name:             "Rajesh Sharma",
				Email:            "rajesh.sharma@example.com",
				Password:         string(pwdHash),
				Gender:           "male",
				Phone:            "+91 98201 12345",
				Nationality:      "Indian",
				Locality:         "Mumbai",
				Location:         models.GeoPoint{Type: "Point", Coordinates: []float64{72.8777, 19.0760}},
				LicenseNumber:    "MH0220180012345",
				ExperienceYears:  8,
				VehicleTypes:     []string{"Car", "SUV"},
				Availability:     "available",
				HourlyRate:       150,
				DailyRate:        1200,
				Languages:        []string{"English", "Hindi", "Marathi"},
				Bio:              "Experienced professional chauffeur with 8+ years across Mumbai & Thane.",
				ProfileCompleted: true,
				KycStatus:        "approved",
				IsActive:         true,
				IsEmailVerified:  true,
				AverageRating:    4.9,
				TotalReviews:     28,
				Role:             "driver",
				CreatedAt:        time.Now(),
				UpdatedAt:        time.Now(),
			},
			{
				ID:               bson.NewObjectID(),
				Name:             "Vikram Patil",
				Email:            "vikram.patil@example.com",
				Password:         string(pwdHash),
				Gender:           "male",
				Phone:            "+91 98202 23456",
				Nationality:      "Indian",
				Locality:         "Pune",
				Location:         models.GeoPoint{Type: "Point", Coordinates: []float64{73.8567, 18.5204}},
				LicenseNumber:    "MH1220160098765",
				ExperienceYears:  6,
				VehicleTypes:     []string{"Car", "Van"},
				Availability:     "available",
				HourlyRate:       130,
				DailyRate:        1000,
				Languages:        []string{"English", "Hindi", "Marathi"},
				Bio:              "Punctual and courteous driver specializing in outstation and corporate travel.",
				ProfileCompleted: true,
				KycStatus:        "approved",
				IsActive:         true,
				IsEmailVerified:  true,
				AverageRating:    4.8,
				TotalReviews:     19,
				Role:             "driver",
				CreatedAt:        time.Now(),
				UpdatedAt:        time.Now(),
			},
			{
				ID:               bson.NewObjectID(),
				Name:             "Amitabh Verma",
				Email:            "amitabh.verma@example.com",
				Password:         string(pwdHash),
				Gender:           "male",
				Phone:            "+91 98101 34567",
				Nationality:      "Indian",
				Locality:         "Delhi",
				Location:         models.GeoPoint{Type: "Point", Coordinates: []float64{77.1025, 28.7041}},
				LicenseNumber:    "DL0420191234567",
				ExperienceYears:  10,
				VehicleTypes:     []string{"SUV", "Luxury"},
				Availability:     "available",
				HourlyRate:       200,
				DailyRate:        1600,
				Languages:        []string{"English", "Hindi"},
				Bio:              "Specialized in VIP transit, airport transfers and luxury sedans.",
				ProfileCompleted: true,
				KycStatus:        "approved",
				IsActive:         true,
				IsEmailVerified:  true,
				AverageRating:    4.9,
				TotalReviews:     42,
				Role:             "driver",
				CreatedAt:        time.Now(),
				UpdatedAt:        time.Now(),
			},
			{
				ID:               bson.NewObjectID(),
				Name:             "Suresh Kumar",
				Email:            "suresh.kumar@example.com",
				Password:         string(pwdHash),
				Gender:           "male",
				Phone:            "+91 98450 45678",
				Nationality:      "Indian",
				Locality:         "Bangalore",
				Location:         models.GeoPoint{Type: "Point", Coordinates: []float64{77.5946, 12.9716}},
				LicenseNumber:    "KA0120150009876",
				ExperienceYears:  7,
				VehicleTypes:     []string{"Car", "SUV", "Truck"},
				Availability:     "available",
				HourlyRate:       140,
				DailyRate:        1100,
				Languages:        []string{"English", "Hindi", "Kannada"},
				Bio:              "Safe, reliable driver familiar with all tech corridors and IT parks.",
				ProfileCompleted: true,
				KycStatus:        "approved",
				IsActive:         true,
				IsEmailVerified:  true,
				AverageRating:    4.7,
				TotalReviews:     31,
				Role:             "driver",
				CreatedAt:        time.Now(),
				UpdatedAt:        time.Now(),
			},
		}

		for _, d := range sampleDrivers {
			_, err := driverColl.InsertOne(ctx, d)
			if err != nil {
				log.Printf("Failed to insert driver %s: %v", d.Name, err)
			}
		}
		fmt.Printf("Seeded %d verified sample drivers across Mumbai, Pune, Delhi, Bangalore.\n", len(sampleDrivers))
	} else {
		fmt.Printf("Database already contains %d drivers.\n", driverCount)
	}

	// Seed Sample Completed Bookings if bookings collection is empty
	bookingColl := config.GetCollection("bookings")
	bookingCount, _ := bookingColl.CountDocuments(ctx, bson.M{})
	if bookingCount == 0 {
		fmt.Println("Bookings collection is empty. Seeding completed sample bookings for stats...")
		now := time.Now()
		sampleBookings := []models.Booking{
			{
				ID:             bson.NewObjectID(),
				HireType:       "temporary",
				Status:         "completed",
				PaymentStatus:  "paid",
				StartDate:      now.Add(-48 * time.Hour),
				PickupLocation: "Nariman Point, Mumbai",
				DropLocation:   "Bandra Kurla Complex, Mumbai",
				Purpose:        "Client Meeting",
				TotalAmount:    600,
				CreatedAt:      now.Add(-48 * time.Hour),
				UpdatedAt:      now.Add(-46 * time.Hour),
			},
			{
				ID:             bson.NewObjectID(),
				HireType:       "daily",
				Status:         "completed",
				PaymentStatus:  "paid",
				StartDate:      now.Add(-24 * time.Hour),
				PickupLocation: "Koramangala, Bangalore",
				DropLocation:   "Whitefield, Bangalore",
				Purpose:        "Corporate Commute",
				TotalAmount:    1200,
				CreatedAt:      now.Add(-24 * time.Hour),
				UpdatedAt:      now.Add(-16 * time.Hour),
			},
			{
				ID:             bson.NewObjectID(),
				HireType:       "temporary",
				Status:         "completed",
				PaymentStatus:  "paid",
				StartDate:      now.Add(-12 * time.Hour),
				PickupLocation: "Connaught Place, Delhi",
				DropLocation:   "Cyber City, Gurgaon",
				Purpose:        "Airport Transit",
				TotalAmount:    850,
				CreatedAt:      now.Add(-12 * time.Hour),
				UpdatedAt:      now.Add(-10 * time.Hour),
			},
		}

		for _, b := range sampleBookings {
			_, err := bookingColl.InsertOne(ctx, b)
			if err != nil {
				log.Printf("Failed to insert booking: %v", err)
			}
		}
		fmt.Printf("Seeded %d completed trips for stats counter.\n", len(sampleBookings))
	} else {
		fmt.Printf("Database already contains %d bookings.\n", bookingCount)
	}
}
