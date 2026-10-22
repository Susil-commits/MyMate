package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"time"

	"mymate-backend/config"

	"github.com/gin-gonic/gin"
)

type CachedIdempotencyResponse struct {
	StatusCode int               `json:"statusCode"`
	Body       string            `json:"body"`
	Headers    map[string]string `json:"headers"`
}

func Idempotency() gin.HandlerFunc {
	return func(c *gin.Context) {
		method := c.Request.Method
		if method != "POST" && method != "PUT" && method != "PATCH" {
			c.Next()
			return
		}

		key := c.GetHeader("Idempotency-Key")
		if key == "" || config.RedisClient == nil {
			c.Next()
			return
		}

		userID := "anon"
		if uid, exists := c.Get("userID"); exists {
			userID = uid.(interface{ Hex() string }).Hex()
		}
		cacheKey := "idempotency:" + userID + ":" + key

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
			bytesData, _ := json.Marshal(cached)
			_ = config.RedisClient.Set(ctx, cacheKey, string(bytesData), 24*time.Hour).Err()
		}
	}
}
