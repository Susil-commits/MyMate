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
}
