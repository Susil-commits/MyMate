package services_test

import (
	"testing"

	"mymate-backend/services"
)

func TestValidateLicenseNumber(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		wantValid  bool
		wantNumber string
	}{
		{
			name:       "Standard format with spaces",
			input:      "Driving Licence: MH 02 20180012345",
			wantValid:  true,
			wantNumber: "MH0220180012345",
		},
		{
			name:       "Standard format with hyphens",
			input:      "DL No: DL-04-2019-1234567",
			wantValid:  true,
			wantNumber: "DL0420191234567",
		},
		{
			name:       "Direct alphanumeric string",
			input:      "KA0120150009876",
			wantValid:  true,
			wantNumber: "KA0120150009876",
		},
		{
			name:       "Invalid license format",
			input:      "Just a random driver note without license",
			wantValid:  false,
			wantNumber: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := services.ValidateLicenseNumber(tt.input)
			if res.IsValid != tt.wantValid {
				t.Errorf("ValidateLicenseNumber() IsValid = %v, want %v", res.IsValid, tt.wantValid)
			}
			if tt.wantValid && res.ExtractedLicenseNumber != tt.wantNumber {
				t.Errorf("ValidateLicenseNumber() Extracted = %s, want %s", res.ExtractedLicenseNumber, tt.wantNumber)
			}
		})
	}
}
