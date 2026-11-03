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

func TestCreateShiftRoster_Validation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	config.AppConfig = &config.Config{
		JWTSecret: "test_secret_for_shift_tests",
		AppEnv:    "test",
	}

	r := gin.New()
	r.POST("/api/v1/corporate/organization/shifts", controllers.CreateShiftRoster)

	// 1. Empty payload should fail validation with 400 Bad Request
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/corporate/organization/shifts", bytes.NewBuffer([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for empty shift payload, got %d", w.Code)
	}

	// 2. Missing DriverID should fail validation with 400
	missingDriverPayload := []byte(`{
		"title": "Executive Daily Chauffeur",
		"startDate": "2026-11-10",
		"endDate": "2026-11-20",
		"pickupLocation": "Cyber Hub, Gurugram"
	}`)
	wMissing := httptest.NewRecorder()
	reqMissing := httptest.NewRequest(http.MethodPost, "/api/v1/corporate/organization/shifts", bytes.NewBuffer(missingDriverPayload))
	reqMissing.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(wMissing, reqMissing)

	if wMissing.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for missing driverId, got %d", wMissing.Code)
	}
}

