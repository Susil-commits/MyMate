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

func TestTriggerEmergencySOS_OfflineAndValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	config.AppConfig = &config.Config{
		JWTSecret: "test_secret_for_sos",
		AppEnv:    "test",
	}

	r := gin.New()
	r.POST("/api/v1/bookings/:id/sos", controllers.TriggerEmergencySOS)

	// 1. Invalid Hex ObjectID should return 400 Bad Request
	wBadID := httptest.NewRecorder()
	reqBadID := httptest.NewRequest(http.MethodPost, "/api/v1/bookings/invalid-booking-id/sos", bytes.NewBuffer([]byte(`{}`)))
	reqBadID.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(wBadID, reqBadID)

	if wBadID.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for invalid hex booking ID, got %d", wBadID.Code)
	}

	// 2. Offline fallback handling with valid Hex ObjectID
	validHexBookingID := "507f1f77bcf86cd799439011"
	wOffline := httptest.NewRecorder()
	sosPayload := []byte(`{
		"reason": "Vehicle Breakdown on Expressway",
		"lat": 28.4595,
		"lng": 77.0266,
		"locality": "Cyber Hub, Gurugram"
	}`)
	reqOffline := httptest.NewRequest(http.MethodPost, "/api/v1/bookings/"+validHexBookingID+"/sos", bytes.NewBuffer(sosPayload))
	reqOffline.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(wOffline, reqOffline)

	if wOffline.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for offline emergency SOS trigger, got %d", wOffline.Code)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(wOffline.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to parse response JSON: %v", err)
	}

	if resp["emergencyHotline"] == nil || resp["emergencyHotline"] == "" {
		t.Errorf("Expected emergencyHotline in SOS response, got %v", resp["emergencyHotline"])
	}
}

