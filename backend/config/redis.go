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
