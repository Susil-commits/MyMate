package utils_test

import (
	"strings"
	"testing"
	"time"

	"mymate-backend/models"
	"mymate-backend/utils"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestGenerateICS(t *testing.T) {
	startTime := time.Date(2026, 11, 10, 10, 0, 0, 0, time.UTC)
	endTime := startTime.Add(4 * time.Hour)

	booking := &models.Booking{
		ID:             bson.NewObjectID(),
		PickupLocation: "Marine Drive, Mumbai",
		DropLocation:   "Bandra Kurla Complex, Mumbai",
		StartDate:      startTime,
		EndDate:        &endTime,
		Purpose:        "Business Conference",
		Status:         "accepted",
	}

	user := &models.User{
		Name:  "Test Customer",
		Email: "customer@test.com",
	}
	driver := &models.Driver{
		Name:  "Test Driver",
		Email: "driver@test.com",
	}

	ics := utils.GenerateICS(booking, user, driver)

	if !strings.Contains(ics, "BEGIN:VCALENDAR") {
		t.Errorf("Expected ICS to contain BEGIN:VCALENDAR")
	}
	if !strings.Contains(ics, "END:VCALENDAR") {
		t.Errorf("Expected ICS to contain END:VCALENDAR")
	}
	if !strings.Contains(ics, "SUMMARY:MyMate Booking with Test Driver") {
		t.Errorf("Expected ICS to contain event summary")
	}
	if !strings.Contains(ics, "LOCATION:Marine Drive, Mumbai") {
		t.Errorf("Expected ICS to contain location")
	}
}
