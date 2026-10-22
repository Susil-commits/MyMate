package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"mymate-backend/config"
	"mymate-backend/middleware"
)

func TestCORSMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	config.AppConfig = &config.Config{
		AllowedOrigins: []string{"http://localhost:5173", "https://mymate.app"},
	}

	r := gin.New()
	r.Use(middleware.CORSMiddleware())
	r.GET("/test-cors", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	// 1. Allowed origin GET
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test-cors", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	r.ServeHTTP(w, req)

	if w.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5173" {
		t.Errorf("Expected allow origin http://localhost:5173, got %s", w.Header().Get("Access-Control-Allow-Origin"))
	}
	if w.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Errorf("Expected allow credentials true")
	}

	// 2. Preflight OPTIONS
	wOptions := httptest.NewRecorder()
	reqOptions := httptest.NewRequest(http.MethodOptions, "/test-cors", nil)
	reqOptions.Header.Set("Origin", "https://mymate.app")
	r.ServeHTTP(wOptions, reqOptions)

	if wOptions.Code != http.StatusNoContent {
		t.Errorf("Expected 204 No Content for OPTIONS, got %d", wOptions.Code)
	}
	if wOptions.Header().Get("Access-Control-Allow-Methods") == "" {
		t.Errorf("Expected Access-Control-Allow-Methods header in preflight")
	}
}
