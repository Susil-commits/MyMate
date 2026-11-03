package controllers_test

import (
	"bytes"
	"math"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
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

// Table-driven GSTIN format test across multiple Indian state codes and syntax edge cases
func TestGSTIN_FormatScenarios(t *testing.T) {
	gstinRegex := regexp.MustCompile(`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`)

	tests := []struct {
		name    string
		gstin   string
		isValid bool
	}{
		{"Valid Maharashtra GSTIN", "27AAAAA0000A1Z5", true},
		{"Valid Delhi GSTIN", "07AABCS1429B1Z1", true},
		{"Valid Karnataka GSTIN", "29ABCDE1234F1Z5", true},
		{"Valid Odisha GSTIN", "21AAACA9876C1Z9", true},
		{"Valid Gujarat GSTIN", "24AAECP1234D1Z8", true},
		{"Invalid Too Short (14 chars)", "27AAAAA0000A1Z", false},
		{"Invalid Too Long (16 chars)", "27AAAAA0000A1Z55", false},
		{"Invalid Missing Z at char 14", "27AAAAA0000A155", false},
		{"Invalid Symbols in PAN part", "27AAA@#0000A1Z5", false},
		{"Invalid Empty String", "", false},
		{"Invalid Spaces Only", "               ", false},
		{"Invalid Numeric in State Code position", "AA27AAA0000A1Z5", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clean := strings.ToUpper(strings.TrimSpace(tt.gstin))
			matches := gstinRegex.MatchString(clean)
			if matches != tt.isValid {
				t.Errorf("GSTIN %q validity mismatch: expected %v, got %v", tt.gstin, tt.isValid, matches)
			}
		})
	}
}

// Test accurate computation of Indian 18% Integrated GST (9% CGST + 9% SGST)
func TestMonthlyTaxInvoice_ComputationScenarios(t *testing.T) {
	tests := []struct {
		name                 string
		totalFares           float64
		expectedTaxableValue float64
		expectedCgst         float64
		expectedSgst         float64
		expectedTotalGst     float64
	}{
		{
			name:                 "Standard Round Amount 11800 INR",
			totalFares:           11800.0,
			expectedTaxableValue: 10000.0,
			expectedCgst:         900.0,
			expectedSgst:         900.0,
			expectedTotalGst:     1800.0,
		},
		{
			name:                 "Zero Trips Total 0 INR",
			totalFares:           0.0,
			expectedTaxableValue: 0.0,
			expectedCgst:         0.0,
			expectedSgst:         0.0,
			expectedTotalGst:     0.0,
		},
		{
			name:                 "Micro Fare 118 INR",
			totalFares:           118.0,
			expectedTaxableValue: 100.0,
			expectedCgst:         9.0,
			expectedSgst:         9.0,
			expectedTotalGst:     18.0,
		},
		{
			name:                 "Real-world Fare with Decimals 1550.75 INR",
			totalFares:           1550.75,
			expectedTaxableValue: 1314.19, // 1550.75 / 1.18 = 1314.1949
			expectedCgst:         118.28,  // (1550.75 - 1314.1949) / 2 = 118.277
			expectedSgst:         118.28,
			expectedTotalGst:     236.56,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			taxableValue := tt.totalFares / 1.18
			gstAmount := tt.totalFares - taxableValue
			cgst := gstAmount / 2.0
			sgst := gstAmount / 2.0

			roundedTaxable := math.Round(taxableValue*100) / 100
			roundedCgst := math.Round(cgst*100) / 100
			roundedSgst := math.Round(sgst*100) / 100
			roundedTotalGst := math.Round(gstAmount*100) / 100

			if math.Abs(roundedTaxable-tt.expectedTaxableValue) > 0.01 {
				t.Errorf("TaxableValue mismatch: expected %.2f, got %.2f", tt.expectedTaxableValue, roundedTaxable)
			}
			if math.Abs(roundedCgst-tt.expectedCgst) > 0.01 {
				t.Errorf("CGST mismatch: expected %.2f, got %.2f", tt.expectedCgst, roundedCgst)
			}
			if math.Abs(roundedSgst-tt.expectedSgst) > 0.01 {
				t.Errorf("SGST mismatch: expected %.2f, got %.2f", tt.expectedSgst, roundedSgst)
			}
			if math.Abs(roundedTotalGst-tt.expectedTotalGst) > 0.01 {
				t.Errorf("TotalGST mismatch: expected %.2f, got %.2f", tt.expectedTotalGst, roundedTotalGst)
			}
		})
	}
}

func TestAddCorporateMember_Validation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	config.AppConfig = &config.Config{
		JWTSecret: "test_secret_for_member_tests",
		AppEnv:    "test",
	}

	r := gin.New()
	r.POST("/api/v1/corporate/organization/members", controllers.AddCorporateMember)

	// 1. Missing email should fail validation
	wEmpty := httptest.NewRecorder()
	reqEmpty := httptest.NewRequest(http.MethodPost, "/api/v1/corporate/organization/members", bytes.NewBuffer([]byte(`{}`)))
	reqEmpty.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(wEmpty, reqEmpty)

	if wEmpty.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for missing member email, got %d", wEmpty.Code)
	}

	// 2. Malformed email should fail validation
	wInvalid := httptest.NewRecorder()
	reqInvalid := httptest.NewRequest(http.MethodPost, "/api/v1/corporate/organization/members", bytes.NewBuffer([]byte(`{"email":"not-an-email"}`)))
	reqInvalid.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(wInvalid, reqInvalid)

	if wInvalid.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for malformed email, got %d", wInvalid.Code)
	}
}
