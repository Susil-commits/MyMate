package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"sync"
	"time"

	"mymate-backend/config"

	"github.com/gin-gonic/gin"
)

type CachedIdempotencyResponse struct {
	StatusCode int               `json:"statusCode"`
	Body       string            `json:"body"`
	Headers    map[string]string `json:"headers"`
}

var (
	memIdempotency sync.Map
)

type memItem struct {
	response  CachedIdempotencyResponse
	expiresAt time.Time
}

func Idempotency() gin.HandlerFunc {
	return func(c *gin.Context) {
		method := c.Request.Method
		if method != "POST" && method != "PUT" && method != "PATCH" {
			c.Next()
			return
		}

		key := c.GetHeader("Idempotency-Key")
		if key == "" {
			key = c.GetHeader("X-Idempotency-Key")
		}
		if key == "" {
			c.Next()
			return
		}

		userID := "anon"
		if uid, exists := c.Get("userId"); exists {
			if stringer, ok := uid.(interface{ Hex() string }); ok {
				userID = stringer.Hex()
			} else if str, ok := uid.(string); ok {
				userID = str
			}
		} else if uid, exists := c.Get("userID"); exists {
			if stringer, ok := uid.(interface{ Hex() string }); ok {
				userID = stringer.Hex()
			}
		}
		cacheKey := "idempotency:" + userID + ":" + key

		// 1. Try Redis first if available
		if config.RedisClient != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()

			val, err := config.RedisClient.Get(ctx, cacheKey).Result()
			if err == nil && val != "" {
				var cached CachedIdempotencyResponse
				if json.Unmarshal([]byte(val), &cached) == nil {
					for hKey, hVal := range cached.Headers {
						c.Header(hKey, hVal)
					}
					c.Header("X-Idempotent-Replay", "true")
					c.String(cached.StatusCode, cached.Body)
					c.Abort()
					return
				}
			}
		} else {
			// 2. Fall back to in-memory idempotency cache
			if item, ok := memIdempotency.Load(cacheKey); ok {
				m := item.(memItem)
				if time.Now().Before(m.expiresAt) {
					for hKey, hVal := range m.response.Headers {
						c.Header(hKey, hVal)
					}
					c.Header("X-Idempotent-Replay", "true")
					c.String(m.response.StatusCode, m.response.Body)
					c.Abort()
					return
				}
				memIdempotency.Delete(cacheKey)
			}
		}

		blw := &bodyLogWriter{body: bytes.NewBufferString(""), ResponseWriter: c.Writer}
		c.Writer = blw

		c.Next()

		if c.Writer.Status() >= 200 && c.Writer.Status() < 300 {
			bodyStr := blw.body.String()
			headers := make(map[string]string)
			for k, v := range c.Writer.Header() {
				if len(v) > 0 {
					headers[k] = v[0]
				}
			}

			cached := CachedIdempotencyResponse{
				StatusCode: c.Writer.Status(),
				Body:       bodyStr,
				Headers:    headers,
			}

			if config.RedisClient != nil {
				ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
				defer cancel()
				bytesData, _ := json.Marshal(cached)
				_ = config.RedisClient.Set(ctx, cacheKey, string(bytesData), 24*time.Hour).Err()
			} else {
				memIdempotency.Store(cacheKey, memItem{
					response:  cached,
					expiresAt: time.Now().Add(24 * time.Hour),
				})
			}
		}
	}
}
