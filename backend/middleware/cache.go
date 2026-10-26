package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"time"

	"mymate-backend/config"

	"github.com/gin-gonic/gin"
)

type bodyLogWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w bodyLogWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

func ClearCachePrefix(prefix string) {
	if config.RedisClient == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var cursor uint64
	for {
		keys, nextCursor, err := config.RedisClient.Scan(ctx, cursor, prefix+"*", 100).Result()
		if err != nil {
			log.Printf("[Cache Error] Scan error: %v", err)
			break
		}
		if len(keys) > 0 {
			_ = config.RedisClient.Del(ctx, keys...).Err()
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
}

func CacheMiddleware(prefix string, durationSeconds int) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method != "GET" || config.RedisClient == nil {
			c.Next()
			return
		}

		key := prefix + "_" + c.Request.RequestURI

		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		cached, err := config.RedisClient.Get(ctx, key).Result()
		if err == nil && cached != "" {
			c.Header("Content-Type", "application/json; charset=utf-8")
			c.Header("X-Cache", "HIT")
			c.String(http.StatusOK, cached)
			c.Abort()
			return
		}

		blw := &bodyLogWriter{body: bytes.NewBufferString(""), ResponseWriter: c.Writer}
		c.Writer = blw

		c.Next()

		if c.Writer.Status() >= 200 && c.Writer.Status() < 300 {
			bodyBytes := blw.body.Bytes()
			if len(bodyBytes) > 0 {
				var js json.RawMessage
				if json.Unmarshal(bodyBytes, &js) == nil {
					baseDuration := time.Duration(durationSeconds) * time.Second
					// Add 0-20% randomized jitter to prevent cache stampede / thundering herd
					jitter := time.Duration(rand.Int63n(int64(baseDuration/5) + 1))
					_ = config.RedisClient.Set(ctx, key, string(bodyBytes), baseDuration+jitter).Err()
				}
			}
		}
	}
}
