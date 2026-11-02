package controllers_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"mymate-backend/config"
	"mymate-backend/controllers"
)

func TestCreateOrganization_Validation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	config.AppConfig = &config.Config{
		JWTSecret: "test_secret_for_controller_tests",
		AppEnv:    "test",
	}

	r := gin.New()
	r.POST("/api/v1/corporate/organization", controllers.CreateOrganization)

	// 1. Empty payload should fail validation with 400 Bad Request
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/corporate/organization", bytes.NewBuffer([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for empty organization payload, got %d", w.Code)
	}

	// 2. Invalid GSTIN format should fail with 400 Bad Request
	invalidGSTINPayload := []byte(`{
		"name": "Acme Corp",
		"gstin": "INVALID_GSTIN",
		"billingEmail": "billing@acme.com",
		"phone": "+919876543210",
		"address": "BKC, Mumbai"
	}`)
	wGST := httptest.NewRecorder()
	reqGST := httptest.NewRequest(http.MethodPost, "/api/v1/corporate/organization", bytes.NewBuffer(invalidGSTINPayload))
	reqGST.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(wGST, reqGST)

	if wGST.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for invalid GSTIN, got %d", wGST.Code)
	}
}

