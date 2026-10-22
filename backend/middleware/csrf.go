package middleware

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"net/http"
	"strings"

	"mymate-backend/config"

	"github.com/gin-gonic/gin"
)

func getCsrfSecret() []byte {
	cfg := config.AppConfig
	if cfg != nil && cfg.JWTSecret != "" {
		return []byte(cfg.JWTSecret)
	}
	return []byte("mymate_default_csrf_secret_32bytes_long")
}

func GenerateCsrfToken() string {
	bytes := make([]byte, 24)
	_, _ = rand.Read(bytes)
	nonce := hex.EncodeToString(bytes)

	h := hmac.New(sha256.New, getCsrfSecret())
	h.Write([]byte(nonce))
	sig := hex.EncodeToString(h.Sum(nil))

	return nonce + "." + sig
}

func VerifyCsrfToken(token string) bool {
	if token == "" {
		return false
	}
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return false
	}
	nonce, signature := parts[0], parts[1]

	h := hmac.New(sha256.New, getCsrfSecret())
	h.Write([]byte(nonce))
	expectedSig := hex.EncodeToString(h.Sum(nil))

	return subtle.ConstantTimeCompare([]byte(signature), []byte(expectedSig)) == 1
}

func CSRFProtection() gin.HandlerFunc {
	return func(c *gin.Context) {
		cookieVal, err := c.Cookie("XSRF-TOKEN")
		if err != nil || cookieVal == "" || !VerifyCsrfToken(cookieVal) {
			newToken := GenerateCsrfToken()
			isProd := config.AppConfig.AppEnv == "production"
			sameSite := http.SameSiteLaxMode
			if isProd {
				sameSite = http.SameSiteNoneMode
			}
			c.SetSameSite(sameSite)
			c.SetCookie("XSRF-TOKEN", newToken, 7*24*3600, "/", "", isProd, false)
			cookieVal = newToken
		}

		// Safe HTTP methods pass through
		method := c.Request.Method
		if method == "GET" || method == "HEAD" || method == "OPTIONS" {
			c.Next()
			return
		}

		// Webhook route bypass
		if strings.Contains(c.Request.URL.Path, "/payments/webhook") {
			c.Next()
			return
		}

		// Check if request has a session cookie
		sessionCookie, _ := c.Cookie("token")
		if sessionCookie == "" {
			c.Next()
			return
		}

		// Double-submit token validation
		clientHeader := c.GetHeader("X-XSRF-TOKEN")
		if clientHeader == "" {
			clientHeader = c.GetHeader("X-CSRF-TOKEN")
		}

		if clientHeader == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "CSRF token missing in request headers"})
			return
		}

		if !VerifyCsrfToken(clientHeader) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "Invalid CSRF token"})
			return
		}

		if subtle.ConstantTimeCompare([]byte(clientHeader), []byte(cookieVal)) != 1 {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "CSRF token mismatch between header and cookie"})
			return
		}

		c.Next()
	}
}
