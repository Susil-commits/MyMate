package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"mymate-backend/config"
	"mymate-backend/middleware"
)

func TestGenerateAndVerifyCsrfToken(t *testing.T) {
	config.AppConfig = &config.Config{
		JWTSecret: "test_secret_for_csrf_testing",
	}

	token := middleware.GenerateCsrfToken()
	if token == "" {
		t.Fatalf("Expected non-empty CSRF token")
	}

	if !middleware.VerifyCsrfToken(token) {
		t.Errorf("Generated CSRF token failed verification")
	}

	tamperedToken := token + "tampered"
	if middleware.VerifyCsrfToken(tamperedToken) {
		t.Errorf("Tampered CSRF token should fail verification")
	}

	if middleware.VerifyCsrfToken("") {
		t.Errorf("Empty token should fail verification")
	}
}

func TestCSRFProtectionMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	config.AppConfig = &config.Config{
		JWTSecret: "test_secret_for_csrf_testing",
		AppEnv:    "development",
	}

	r := gin.New()
	r.Use(middleware.CSRFProtection())
	r.POST("/api/resource", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// 1. Safe GET should pass and set XSRF-TOKEN cookie
	r.GET("/api/safe", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "safe"})
	})
	wGet := httptest.NewRecorder()
	reqGet := httptest.NewRequest(http.MethodGet, "/api/safe", nil)
	r.ServeHTTP(wGet, reqGet)
	if wGet.Code != http.StatusOK {
		t.Errorf("GET should return 200, got %d", wGet.Code)
	}

	// Extract generated cookie
	var xsrfCookie *http.Cookie
	for _, cookie := range wGet.Result().Cookies() {
		if cookie.Name == "XSRF-TOKEN" {
			xsrfCookie = cookie
			break
		}
	}
	if xsrfCookie == nil {
		t.Fatalf("Expected XSRF-TOKEN cookie to be set on GET")
	}

	// 2. POST without session cookie should pass through
	wPostNoAuth := httptest.NewRecorder()
	reqPostNoAuth := httptest.NewRequest(http.MethodPost, "/api/resource", nil)
	r.ServeHTTP(wPostNoAuth, reqPostNoAuth)
	if wPostNoAuth.Code != http.StatusOK {
		t.Errorf("POST without session cookie should pass through, got %d", wPostNoAuth.Code)
	}

	// 3. POST with session cookie but missing CSRF header should return 403 Forbidden
	wPostMissingHeader := httptest.NewRecorder()
	reqPostMissingHeader := httptest.NewRequest(http.MethodPost, "/api/resource", nil)
	reqPostMissingHeader.AddCookie(&http.Cookie{Name: "token", Value: "valid.jwt.session"})
	reqPostMissingHeader.AddCookie(xsrfCookie)
	r.ServeHTTP(wPostMissingHeader, reqPostMissingHeader)
	if wPostMissingHeader.Code != http.StatusForbidden {
		t.Errorf("POST with session but missing header should return 403, got %d", wPostMissingHeader.Code)
	}

	// 4. POST with session cookie and valid CSRF header should return 200 OK
	wPostValid := httptest.NewRecorder()
	reqPostValid := httptest.NewRequest(http.MethodPost, "/api/resource", nil)
	reqPostValid.AddCookie(&http.Cookie{Name: "token", Value: "valid.jwt.session"})
	reqPostValid.AddCookie(xsrfCookie)
	reqPostValid.Header.Set("X-XSRF-TOKEN", xsrfCookie.Value)
	r.ServeHTTP(wPostValid, reqPostValid)
	if wPostValid.Code != http.StatusOK {
		t.Errorf("POST with valid CSRF header and cookie should return 200, got %d", wPostValid.Code)
	}
}
