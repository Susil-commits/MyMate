package middleware

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"mymate-backend/config"

	"github.com/gin-gonic/gin"
)

type memoryLimiter struct {
	mu      sync.Mutex
	records map[string][]time.Time
}

var (
	generalMemoryLimiter = &memoryLimiter{records: make(map[string][]time.Time)}
	authMemoryLimiter    = &memoryLimiter{records: make(map[string][]time.Time)}
	paymentMemoryLimiter = &memoryLimiter{records: make(map[string][]time.Time)}
	twoFactorLimiter     = &memoryLimiter{records: make(map[string][]time.Time)}
	aiMemoryLimiter      = &memoryLimiter{records: make(map[string][]time.Time)}
)

func (m *memoryLimiter) allow(key string, limit int, window time.Duration) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-window)

	// Periodic sweep to prevent unbounded memory growth
	if len(m.records) > 500 {
		for k, timestamps := range m.records {
			var remaining []time.Time
			for _, t := range timestamps {
				if t.After(cutoff) {
					remaining = append(remaining, t)
				}
			}
			if len(remaining) == 0 {
				delete(m.records, k)
			} else {
				m.records[k] = remaining
			}
		}
	}

	var valid []time.Time
	for _, t := range m.records[key] {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}

	if len(valid) >= limit {
		m.records[key] = valid
		return false
	}

	valid = append(valid, now)
	m.records[key] = valid
	return true
}

func createLimiter(prefix string, limit int, window time.Duration, mem *memoryLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		key := fmt.Sprintf("rl:%s:%s", prefix, clientIP)

		if config.RedisClient != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
			defer cancel()

			count, err := config.RedisClient.Incr(ctx, key).Result()
			if err == nil {
				if count == 1 {
					config.RedisClient.Expire(ctx, key, window)
				}
				if count > int64(limit) {
					c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
						"message": "Too many requests. Please try again later.",
					})
					return
				}
				c.Next()
				return
			}
		}

		// In-memory fallback
		if !mem.allow(clientIP, limit, window) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"message": "Too many requests. Please try again later.",
			})
			return
		}

		c.Next()
	}
}

func GeneralLimiter() gin.HandlerFunc {
	return createLimiter("gen", 120, time.Minute, generalMemoryLimiter)
}

func AuthLimiter() gin.HandlerFunc {
	return createLimiter("auth", 20, time.Minute, authMemoryLimiter)
}

func PaymentLimiter() gin.HandlerFunc {
	return createLimiter("pay", 15, time.Minute, paymentMemoryLimiter)
}

func TwoFactorLimiter() gin.HandlerFunc {
	return createLimiter("2fa", 10, time.Minute, twoFactorLimiter)
}

func AIChatLimiter() gin.HandlerFunc {
	return createLimiter("ai", 30, time.Minute, aiMemoryLimiter)
}
