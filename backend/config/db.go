package config

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

var (
	MongoClient *mongo.Client
	DB          *mongo.Database
)

func ConnectDB(uris ...string) (*mongo.Client, error) {
	uri := ""
	if len(uris) > 0 && uris[0] != "" {
		uri = uris[0]
	} else if AppConfig != nil {
		uri = AppConfig.MongoURI
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	clientOpts := options.Client().ApplyURI(uri)
	client, err := mongo.Connect(clientOpts)
	if err != nil {
		return nil, err
	}

	err = client.Ping(ctx, nil)
	if err != nil {
		return nil, err
	}

	MongoClient = client
	dbName := "mymate"
	if clientOpts.Auth != nil && clientOpts.Auth.AuthSource != "" {
		dbName = clientOpts.Auth.AuthSource
	}
	DB = client.Database(dbName)

	log.Printf("[MongoDB] Connected to database: %s", dbName)

	// Ensure Indexes
	go initIndexes(DB)

	return client, nil
}

func GetCollection(name string) *mongo.Collection {
	if DB == nil {
		return nil
	}
	return DB.Collection(name)
}

func initIndexes(db *mongo.Database) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 1. Users Indexes
	_, _ = db.Collection("users").Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "email", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: bson.D{{Key: "createdAt", Value: -1}},
		},
	})

	// 2. Drivers Indexes (including 2dsphere on location)
	_, _ = db.Collection("drivers").Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "email", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys:    bson.D{{Key: "licenseNumber", Value: 1}},
			Options: options.Index().SetUnique(true).SetSparse(true),
		},
		{
			Keys: bson.D{{Key: "location", Value: "2dsphere"}},
		},
		{
			Keys: bson.D{
				{Key: "kycStatus", Value: 1},
				{Key: "isActive", Value: 1},
				{Key: "averageRating", Value: -1},
			},
		},
	})

	// 3. Bookings Indexes
	_, _ = db.Collection("bookings").Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys: bson.D{{Key: "user", Value: 1}, {Key: "status", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "driver", Value: 1}, {Key: "status", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "createdAt", Value: -1}},
		},
	})

	// 4. Payments Index
	_, _ = db.Collection("payments").Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "razorpayOrderId", Value: 1}},
			Options: options.Index().SetSparse(true),
		},
		{
			Keys: bson.D{{Key: "booking", Value: 1}},
		},
	})

	// 5. Reviews Index
	_, _ = db.Collection("reviews").Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "user", Value: 1}, {Key: "booking", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: bson.D{{Key: "driver", Value: 1}},
		},
	})

	// 6. Favorites Index
	_, _ = db.Collection("favorites").Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "user", Value: 1}, {Key: "driver", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
	})

	// 7. Conversations Index
	_, _ = db.Collection("conversations").Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "user", Value: 1}, {Key: "driver", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
	})

	// 8. Notifications Index
	_, _ = db.Collection("notifications").Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys: bson.D{{Key: "user", Value: 1}, {Key: "read", Value: 1}, {Key: "createdAt", Value: -1}},
		},
	})

	log.Println("[MongoDB] Indexes initialized.")
}
