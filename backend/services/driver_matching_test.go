package services_test

import (
	"math"
	"testing"

	"mymate-backend/services"
)

func TestHaversineKm(t *testing.T) {
	// Distance between Gateway of India (18.9220, 72.8347) and Bandra Fort (19.0434, 72.8184) is approx 13.6 km
	dist := services.HaversineKm(18.9220, 72.8347, 19.0434, 72.8184)
	if math.Abs(dist-13.6) > 1.5 {
		t.Errorf("Expected distance ~13.6 km, got %f km", dist)
	}

	// Distance between identical points should be 0
	distZero := services.HaversineKm(19.0760, 72.8777, 19.0760, 72.8777)
	if distZero != 0.0 {
		t.Errorf("Expected distance 0.0 for identical points, got %f", distZero)
	}
}

func TestScoreDriver(t *testing.T) {
	driverA := services.DriverCandidate{
		DriverID:          "driver_close_high_rating",
		DistanceKm:        2.0,
		Rating:            4.9,
		AcceptRatePercent: 95.0,
		IdleMinutes:       10.0,
	}

	driverB := services.DriverCandidate{
		DriverID:          "driver_far_low_rating",
		DistanceKm:        15.0,
		Rating:            3.5,
		AcceptRatePercent: 70.0,
		IdleMinutes:       30.0,
	}

	distWeight := 1.2
	ratingWeight := 2.5
	acceptWeight := 0.1
	idleWeight := 0.05

	scoreA := services.ScoreDriver(driverA, distWeight, ratingWeight, acceptWeight, idleWeight)
	scoreB := services.ScoreDriver(driverB, distWeight, ratingWeight, acceptWeight, idleWeight)

	if scoreA <= scoreB {
		t.Errorf("Expected driverA score (%f) to be significantly higher than driverB score (%f)", scoreA, scoreB)
	}
}
