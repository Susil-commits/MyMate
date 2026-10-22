package services_test

import (
	"testing"
	"time"

	"mymate-backend/config"
	"mymate-backend/services"
)

func TestCalculateDynamicSurge_PeakHours(t *testing.T) {
	config.DB = nil // Test pure time-based surge without DB

	// 9:00 AM (Morning Peak) -> 1.0 + 0.5 = 1.5
	morningPeak := time.Date(2026, 10, 22, 9, 0, 0, 0, time.UTC)
	surgeMorning := services.CalculateDynamicSurge(morningPeak)
	if surgeMorning < 1.5 {
		t.Errorf("Expected surge >= 1.5 during morning rush hour, got %f", surgeMorning)
	}

	// 6:00 PM (Evening Peak) -> 1.0 + 0.5 = 1.5
	eveningPeak := time.Date(2026, 10, 22, 18, 0, 0, 0, time.UTC)
	surgeEvening := services.CalculateDynamicSurge(eveningPeak)
	if surgeEvening < 1.5 {
		t.Errorf("Expected surge >= 1.5 during evening rush hour, got %f", surgeEvening)
	}

	// 1:00 AM (Late Night) -> 1.0 + 0.25 = 1.25
	lateNight := time.Date(2026, 10, 22, 1, 0, 0, 0, time.UTC)
	surgeNight := services.CalculateDynamicSurge(lateNight)
	if surgeNight < 1.25 {
		t.Errorf("Expected surge >= 1.25 during late night, got %f", surgeNight)
	}

	// 2:00 PM (Off-Peak Afternoon) -> 1.0
	offPeak := time.Date(2026, 10, 22, 14, 0, 0, 0, time.UTC)
	surgeOffPeak := services.CalculateDynamicSurge(offPeak)
	if surgeOffPeak != 1.0 {
		t.Errorf("Expected base surge 1.0 during off-peak, got %f", surgeOffPeak)
	}
}
