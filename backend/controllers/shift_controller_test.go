package controllers_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

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

	// 3. Start date after end date should fail validation with 400 Bad Request
	invertedDatePayload := []byte(`{
		"driverId": "507f1f77bcf86cd799439011",
		"title": "Executive Daily Chauffeur",
		"startDate": "2026-11-20",
		"endDate": "2026-11-10",
		"pickupLocation": "Cyber Hub, Gurugram"
	}`)
	wInverted := httptest.NewRecorder()
	reqInverted := httptest.NewRequest(http.MethodPost, "/api/v1/corporate/organization/shifts", bytes.NewBuffer(invertedDatePayload))
	reqInverted.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(wInverted, reqInverted)

	if wInverted.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for inverted date range, got %d", wInverted.Code)
	}
}

// Table-driven shift date parsing and boundary validation scenarios
func TestShiftRoster_DateRangeScenarios(t *testing.T) {
	tests := []struct {
		name        string
		startDate   string
		endDate     string
		shouldError bool
	}{
		{
			name:        "Standard YYYY-MM-DD valid range",
			startDate:   "2026-11-01",
			endDate:     "2026-11-14",
			shouldError: false,
		},
		{
			name:        "Single-day shift (startDate equals endDate)",
			startDate:   "2026-11-15",
			endDate:     "2026-11-15",
			shouldError: false,
		},
		{
			name:        "ISO-8601 RFC3339 format timestamps",
			startDate:   "2026-11-01T00:00:00Z",
			endDate:     "2026-11-05T00:00:00Z",
			shouldError: false,
		},
		{
			name:        "Start date after end date (chronological inversion)",
			startDate:   "2026-11-20",
			endDate:     "2026-11-10",
			shouldError: true,
		},
		{
			name:        "Empty start date",
			startDate:   "",
			endDate:     "2026-11-10",
			shouldError: true,
		},
		{
			name:        "Empty end date",
			startDate:   "2026-11-10",
			endDate:     "",
			shouldError: true,
		},
		{
			name:        "Malformed month and day format",
			startDate:   "10-11-2026",
			endDate:     "20-11-2026",
			shouldError: true,
		},
		{
			name:        "Random alphanumeric string",
			startDate:   "invalid-date",
			endDate:     "2026-11-20",
			shouldError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s, e, err := controllers.ParseShiftDates(tt.startDate, tt.endDate)
			if (err != nil) != tt.shouldError {
				t.Errorf("ParseShiftDates(%q, %q) error mismatch: expected error %v, got %v", tt.startDate, tt.endDate, tt.shouldError, err)
			}
			if !tt.shouldError && s.After(e) {
				t.Errorf("Expected start date <= end date, got s=%v, e=%v", s, e)
			}
		})
	}
}

// Table-driven working days calculation across calendar scenarios
func TestShiftRoster_WorkingDaysComputation(t *testing.T) {
	// Reference dates:
	// 2026-11-02 is a Monday
	// 2026-11-06 is a Friday (5 days: Mon, Tue, Wed, Thu, Fri)
	// 2026-11-15 is a Sunday (14 days from 2026-11-02 to 2026-11-15: 10 weekdays, 4 weekend days)
	dMon1, _ := time.Parse("2006-01-02", "2026-11-02")
	dFri1, _ := time.Parse("2006-01-02", "2026-11-06")
	dSun2, _ := time.Parse("2006-01-02", "2026-11-15")

	tests := []struct {
		name         string
		start        time.Time
		end          time.Time
		daysOfWeek   []string
		expectedDays int
	}{
		{
			name:         "Single 5-day work week (Mon-Fri)",
			start:        dMon1,
			end:          dFri1,
			daysOfWeek:   []string{"Mon", "Tue", "Wed", "Thu", "Fri"},
			expectedDays: 5,
		},
		{
			name:         "Default weekdays when empty list passed",
			start:        dMon1,
			end:          dFri1,
			daysOfWeek:   []string{},
			expectedDays: 5,
		},
		{
			name:         "Two-week span with weekdays only",
			start:        dMon1,
			end:          dSun2,
			daysOfWeek:   []string{"Mon", "Tue", "Wed", "Thu", "Fri"},
			expectedDays: 10,
		},
		{
			name:         "Two-week span with weekend shifts only (Sat & Sun)",
			start:        dMon1,
			end:          dSun2,
			daysOfWeek:   []string{"Sat", "Sun"},
			expectedDays: 4,
		},
		{
			name:         "Two-week span with all 7 days",
			start:        dMon1,
			end:          dSun2,
			daysOfWeek:   []string{"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"},
			expectedDays: 14,
		},
		{
			name:         "Alternate day roster (Mon, Wed, Fri) over 1 week",
			start:        dMon1,
			end:          dFri1,
			daysOfWeek:   []string{"Mon", "Wed", "Fri"},
			expectedDays: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := controllers.CalculateShiftWorkingDays(tt.start, tt.end, tt.daysOfWeek)
			if actual != tt.expectedDays {
				t.Errorf("CalculateShiftWorkingDays() mismatch: expected %d, got %d", tt.expectedDays, actual)
			}
		})
	}
}

// Table-driven shift day intersection conflict detection
func TestShiftRoster_IntersectingDayConflicts(t *testing.T) {
	tests := []struct {
		name          string
		requestedDays []string
		existingDays  []string
		expectedMatch bool
		matchDay      string
	}{
		{
			name:          "Overlapping Monday shift",
			requestedDays: []string{"Mon", "Wed", "Fri"},
			existingDays:  []string{"Mon", "Tue"},
			expectedMatch: true,
			matchDay:      "Mon",
		},
		{
			name:          "Case-insensitive full day string match",
			requestedDays: []string{"Wednesday", "Thursday"},
			existingDays:  []string{"wed", "fri"},
			expectedMatch: true,
			matchDay:      "Wednesday",
		},
		{
			name:          "Disjoint schedules (Weekdays vs Weekends)",
			requestedDays: []string{"Sat", "Sun"},
			existingDays:  []string{"Mon", "Tue", "Wed", "Thu", "Fri"},
			expectedMatch: false,
			matchDay:      "",
		},
		{
			name:          "Disjoint alternate weekdays (Tue, Thu vs Mon, Wed, Fri)",
			requestedDays: []string{"Tue", "Thu"},
			existingDays:  []string{"Mon", "Wed", "Fri"},
			expectedMatch: false,
			matchDay:      "",
		},
		{
			name:          "Empty existing days",
			requestedDays: []string{"Mon", "Tue"},
			existingDays:  []string{},
			expectedMatch: false,
			matchDay:      "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hasOverlap, day := controllers.FindFirstIntersectingDay(tt.requestedDays, tt.existingDays)
			if hasOverlap != tt.expectedMatch {
				t.Errorf("FindFirstIntersectingDay() overlap flag mismatch: expected %v, got %v", tt.expectedMatch, hasOverlap)
			}
			if tt.expectedMatch && day != tt.matchDay {
				t.Errorf("FindFirstIntersectingDay() matched day mismatch: expected %q, got %q", tt.matchDay, day)
			}
		})
	}
}
