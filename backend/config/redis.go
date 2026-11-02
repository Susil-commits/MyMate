package config

import (
	"context"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

var RedisClient *redis.Client

func ConnectRedis(redisURL string, disabled bool) *redis.Client {
	if disabled || redisURL == "" {
		log.Println("[Redis] Redis caching disabled via configuration.")
		return nil
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		opts = &redis.Options{
			Addr: "localhost:6379",
		}
	}
	opts.DialTimeout = 2 * time.Second
	opts.ReadTimeout = 2 * time.Second
	opts.WriteTimeout = 2 * time.Second

	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("[Redis] Connection warning: %v. Running in-memory/fallback mode.", err)
		return nil
	}

	RedisClient = client
	log.Println("[Redis] Connected successfully.")
	return RedisClient
}

// PublishWSMessage publishes a broadcast event to Redis Pub/Sub channel
func PublishWSMessage(ctx context.Context, channel string, payload interface{}) error {
	if RedisClient == nil {
		return nil
	}
	return RedisClient.Publish(ctx, channel, payload).Err()
}

// SubscribeWSChannel subscribes to a Redis channel for multi-pod WebSocket synchronization
func SubscribeWSChannel(ctx context.Context, channel string) *redis.PubSub {
	if RedisClient == nil {
		return nil
	}
	return RedisClient.Subscribe(ctx, channel)
}

// GeoAddDriver updates driver GPS coordinates in the Redis GEO spatial set
func GeoAddDriver(ctx context.Context, key string, lng, lat float64, driverID string) error {
	if RedisClient == nil {
		return nil
	}
	return RedisClient.GeoAdd(ctx, key, &redis.GeoLocation{
		Name:      driverID,
		Longitude: lng,
		Latitude:  lat,
	}).Err()
}

// GeoSearchNearbyDrivers finds drivers within radiusKm using Redis GEORadius
func GeoSearchNearbyDrivers(ctx context.Context, key string, userLng, userLat, radiusKm float64, count int) ([]redis.GeoLocation, error) {
	if RedisClient == nil {
		return nil, nil
	}
	query := &redis.GeoRadiusQuery{
		Radius:   radiusKm,
		Unit:     "km",
		WithDist: true,
		Count:    count,
		Sort:     "ASC",
	}
	return RedisClient.GeoRadius(ctx, key, userLng, userLat, query).Result()
}
