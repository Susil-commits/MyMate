package controllers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"mymate-backend/config"
	"mymate-backend/controllers"
)

func TestAuthValidation_InvalidPayloads(t *testing.T) {
	gin.SetMode(gin.TestMode)
	config.AppConfig = &config.Config{
		JWTSecret: "test_secret_for_controller_tests",
		AppEnv:    "test",
	}

	r := gin.New()
	r.POST("/api/auth/user/register", controllers.UserRegister)
	r.POST("/api/auth/login", controllers.UserLogin)

	// 1. Register with empty JSON body should return 400 Bad Request
	wRegister := httptest.NewRecorder()
	reqRegister := httptest.NewRequest(http.MethodPost, "/api/auth/user/register", bytes.NewBuffer([]byte(`{}`)))
	reqRegister.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(wRegister, reqRegister)

	if wRegister.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for empty registration payload, got %d", wRegister.Code)
	}

	// 2. Login with missing password should return 400 Bad Request
	wLogin := httptest.NewRecorder()
	loginBody, _ := json.Marshal(map[string]string{"email": "test@example.com"})
	reqLogin := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBuffer(loginBody))
	reqLogin.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(wLogin, reqLogin)

	if wLogin.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for login without password, got %d", wLogin.Code)
	}
}

func TestGetCsrfToken_Controller(t *testing.T) {
	gin.SetMode(gin.TestMode)
	config.AppConfig = &config.Config{
		JWTSecret: "test_secret_for_controller_tests",
		AppEnv:    "test",
	}

	r := gin.New()
	r.GET("/api/auth/csrf-token", controllers.GetCsrfToken)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/csrf-token", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK from GetCsrfToken, got %d", w.Code)
	}

	var resp map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to parse JSON response: %v", err)
	}

	if resp["csrfToken"] == "" {
		t.Errorf("Expected non-empty csrfToken in controller response")
	}
}
