package utils

import (
	"fmt"
	"strings"
	"time"

	"mymate-backend/models"
)

func GenerateICS(booking *models.Booking, user *models.User, driver *models.Driver) string {
	formatICSTime := func(t time.Time) string {
		return t.UTC().Format("20060102T150405Z")
	}

	start := booking.StartDate
	end := start.Add(1 * time.Hour)
	if booking.EndDate != nil && !booking.EndDate.IsZero() {
		end = *booking.EndDate
	}

	driverName := "Driver"
	driverEmail := "driver@example.com"
	if driver != nil {
		if driver.Name != "" {
			driverName = driver.Name
		}
		if driver.Email != "" {
			driverEmail = driver.Email
		}
	}

	userName := "Customer"
	userEmail := "user@example.com"
	if user != nil {
		if user.Name != "" {
			userName = user.Name
		}
		if user.Email != "" {
			userEmail = user.Email
		}
	}

	uid := fmt.Sprintf("booking-%s@mymate.com", booking.ID.Hex())
	now := formatICSTime(time.Now())

	lines := []string{
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//MyMate//Booking Calendar//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:REQUEST",
		"BEGIN:VEVENT",
		fmt.Sprintf("UID:%s", uid),
		fmt.Sprintf("DTSTAMP:%s", now),
		fmt.Sprintf("DTSTART:%s", formatICSTime(start)),
		fmt.Sprintf("DTEND:%s", formatICSTime(end)),
		fmt.Sprintf("SUMMARY:MyMate Booking with %s", driverName),
		fmt.Sprintf("DESCRIPTION:Booking ID: %s\\nPickup: %s\\nDrop: %s\\nPurpose: %s", booking.ID.Hex(), booking.PickupLocation, booking.DropLocation, booking.Purpose),
		fmt.Sprintf("LOCATION:%s", booking.PickupLocation),
		"STATUS:CONFIRMED",
		"ORGANIZER;CN=MyMate:mailto:noreply@mymate.com",
		fmt.Sprintf("ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=%s:mailto:%s", userName, userEmail),
		fmt.Sprintf("ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=%s:mailto:%s", driverName, driverEmail),
		"END:VEVENT",
		"END:VCALENDAR",
	}

	return strings.Join(lines, "\r\n") + "\r\n"
}
