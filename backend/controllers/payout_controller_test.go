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

func TestValidateUPI_Scenarios(t *testing.T) {
	tests := []struct {
		name    string
		vpa     string
		isValid bool
	}{
		{"Valid phone Paytm VPA", "9876543210@paytm", true},
		{"Valid GooglePay HDFC VPA", "rajesh.kumar@okhdfcbank", true},
		{"Valid PhonePe YBL VPA", "driver_ravi@ybl", true},
		{"Valid ICICI Bank VPA", "chauffeur123@icici", true},
		{"Invalid Missing @ symbol", "rajeshkumar", false},
		{"Invalid Empty VPA", "", false},
		{"Invalid Double @ symbol", "rajesh@paytm@bank", false},
		{"Invalid Spaces within VPA", "rajesh kumar@paytm", false},
		{"Invalid Missing handle after @", "driver@", false},
		{"Invalid Missing username before @", "@okhdfcbank", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := controllers.ValidateUPI(tt.vpa)
			if result != tt.isValid {
				t.Errorf("ValidateUPI(%q) expected %v, got %v", tt.vpa, tt.isValid, result)
			}
		})
	}
}

func TestValidateIFSC_Scenarios(t *testing.T) {
	tests := []struct {
		name    string
		ifsc    string
		isValid bool
	}{
		{"Valid HDFC IFSC", "HDFC0001234", true},
		{"Valid SBI IFSC", "SBIN0004567", true},
		{"Valid ICICI IFSC", "ICIC0000001", true},
		{"Valid Kotak IFSC", "KKBK0000123", true},
		{"Valid lowercase with whitespace auto-cleaned", "  hdfc0001234  ", true},
		{"Invalid 5th character not Zero", "HDFC1001234", false},
		{"Invalid Bank prefix has numbers", "12340001234", false},
		{"Invalid Too short (10 chars)", "HDFC000123", false},
		{"Invalid Too long (12 chars)", "HDFC00012345", false},
		{"Invalid Special characters", "HDFC0@01234", false},
		{"Invalid Empty string", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := controllers.ValidateIFSC(tt.ifsc)
			if result != tt.isValid {
				t.Errorf("ValidateIFSC(%q) expected %v, got %v", tt.ifsc, tt.isValid, result)
			}
		})
	}
}

func TestValidateAccountNumber_Scenarios(t *testing.T) {
	tests := []struct {
		name    string
		accNo   string
		isValid bool
	}{
		{"Valid 9-digit Account Number", "123456789", true},
		{"Valid 12-digit Account Number", "123456789012", true},
		{"Valid 16-digit Account Number", "1234567890123456", true},
		{"Valid 18-digit Account Number", "123456789012345678", true},
		{"Invalid 8 digits (too short)", "12345678", false},
		{"Invalid 19 digits (too long)", "1234567890123456789", false},
		{"Invalid Contains alphabets", "12345ABCD6789", false},
		{"Invalid Empty string", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := controllers.ValidateAccountNumber(tt.accNo)
			if result != tt.isValid {
				t.Errorf("ValidateAccountNumber(%q) expected %v, got %v", tt.accNo, tt.isValid, result)
			}
		})
	}
}

func TestRequestDriverPayout_Validation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	config.AppConfig = &config.Config{
		JWTSecret: "test_secret_for_payouts",
		AppEnv:    "test",
	}

	r := gin.New()
	r.POST("/api/v1/drivers/payout/request", controllers.RequestDriverPayout)

	// 1. Amount less than minimum ₹100
	belowMinPayload := []byte(`{
		"amount": 50,
		"method": "upi",
		"upiId": "driver@paytm"
	}`)
	wMin := httptest.NewRecorder()
	reqMin := httptest.NewRequest(http.MethodPost, "/api/v1/drivers/payout/request", bytes.NewBuffer(belowMinPayload))
	reqMin.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(wMin, reqMin)

	if wMin.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for amount < 100, got %d", wMin.Code)
	}

	// 2. Unsupported payout method
	invalidMethodPayload := []byte(`{
		"amount": 500,
		"method": "crypto_wallet",
		"upiId": "driver@paytm"
	}`)
	wMethod := httptest.NewRecorder()
	reqMethod := httptest.NewRequest(http.MethodPost, "/api/v1/drivers/payout/request", bytes.NewBuffer(invalidMethodPayload))
	reqMethod.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(wMethod, reqMethod)

	if wMethod.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for invalid method, got %d", wMethod.Code)
	}

	// 3. Invalid UPI ID for UPI method
	invalidUPIPayload := []byte(`{
		"amount": 500,
		"method": "upi",
		"upiId": "not-a-valid-upi"
	}`)
	wUPI := httptest.NewRecorder()
	reqUPI := httptest.NewRequest(http.MethodPost, "/api/v1/drivers/payout/request", bytes.NewBuffer(invalidUPIPayload))
	reqUPI.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(wUPI, reqUPI)

	if wUPI.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for malformed UPI ID, got %d", wUPI.Code)
	}

	// 4. Invalid IFSC for Bank Transfer method
	invalidIFSCPayload := []byte(`{
		"amount": 1500,
		"method": "bank_transfer",
		"ifscCode": "INVALID_IFSC",
		"accountNumber": "123456789012",
		"accountHolder": "Rajesh Kumar"
	}`)
	wIFSC := httptest.NewRecorder()
	reqIFSC := httptest.NewRequest(http.MethodPost, "/api/v1/drivers/payout/request", bytes.NewBuffer(invalidIFSCPayload))
	reqIFSC.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(wIFSC, reqIFSC)

	if wIFSC.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for invalid IFSC, got %d", wIFSC.Code)
	}
}
