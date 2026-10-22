package middleware

import (
	"net/http"
	"strings"

	"mymate-backend/config"

	"github.com/gin-gonic/gin"
)

func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		allowedOrigins := config.AppConfig.AllowedOrigins

		allowed := false
		trimmedOrigin := strings.TrimRight(origin, "/")

		if origin == "" {
			allowed = true
		} else {
			for _, o := range allowedOrigins {
				if strings.TrimRight(o, "/") == trimmedOrigin || o == "*" {
					allowed = true
					break
				}
			}
		}

		if allowed {
			if origin != "" {
				c.Header("Access-Control-Allow-Origin", origin)
			} else {
				c.Header("Access-Control-Allow-Origin", "*")
			}
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, Idempotency-Key, x-xsrf-token, x-csrf-token")
			c.Header("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")
			c.Header("Access-Control-Expose-Headers", "Content-Length, Content-Disposition, XSRF-TOKEN, X-XSRF-TOKEN")
		}

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
