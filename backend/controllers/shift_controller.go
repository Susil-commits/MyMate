package controllers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"mymate-backend/config"
	"mymate-backend/models"
	"mymate-backend/socket"
	"mymate-backend/telemetry"
)

type CreateShiftInput struct {
	DriverID       string   `json:"driverId" binding:"required"`
	Title          string   `json:"title" binding:"required"`
	CostCenter     string   `json:"costCenter"`
	StartDate      string   `json:"startDate" binding:"required"`
	EndDate        string   `json:"endDate" binding:"required"`
	DailyStartTime string   `json:"dailyStartTime"`
	DailyEndTime   string   `json:"dailyEndTime"`
	DaysOfWeek     []string `json:"daysOfWeek"`
	PickupLocation string   `json:"pickupLocation" binding:"required"`
}

// POST /api/v1/corporate/organization/shifts
func CreateShiftRoster(c *gin.Context) {
	var input CreateShiftInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid shift input: " + err.Error()})
		return
	}

	// Validate date formats and boundaries
	startDate, endDate, err := ParseShiftDates(input.StartDate, input.EndDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	if config.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "Database is not connected"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	// 1. Verify caller has an active corporate organization
	var org models.Organization
	err = config.GetCollection("organizations").FindOne(ctx, bson.M{
		"$or": bson.A{
			bson.M{"adminUser": userOID},
			bson.M{"members": userOID},
		},
		"isActive": true,
	}).Decode(&org)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": "Active corporate organization required to schedule chauffeur shifts"})
		return
	}

	// 2. Validate target driver
	driverOID, err := bson.ObjectIDFromHex(input.DriverID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid driver ID"})
		return
	}

	var driver models.Driver
	err = config.GetCollection("drivers").FindOne(ctx, bson.M{
		"_id":       driverOID,
		"kycStatus": "approved",
		"isActive":  true,
		"deletedAt": nil,
	}).Decode(&driver)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Driver not found or not currently active for corporate dispatch"})
		return
	}

	daysOfWeek := input.DaysOfWeek
	if len(daysOfWeek) == 0 {
		daysOfWeek = []string{"Mon", "Tue", "Wed", "Thu", "Fri"}
	}

	// 3. Atomic Conflict Detection: Check if driver is already committed to an overlapping shift
	conflictFilter := bson.M{
		"driverId":  driverOID,
		"status":    bson.M{"$in": bson.A{"confirmed", "active"}},
		"startDate": bson.M{"$lte": endDate},
		"endDate":   bson.M{"$gte": startDate},
	}

	cursor, err := config.GetCollection("shifts").Find(ctx, conflictFilter)
	if err == nil {
		var existingShifts []models.ShiftRoster
		_ = cursor.All(ctx, &existingShifts)
		cursor.Close(ctx)

		// Check intersecting days of week
		for _, es := range existingShifts {
			if hasOverlap, overlappingDay := FindFirstIntersectingDay(daysOfWeek, es.DaysOfWeek); hasOverlap {
				c.JSON(http.StatusConflict, gin.H{
					"message": fmt.Sprintf("Driver %s is already rostered for shift '%s' on %s during this date range", driver.Name, es.Title, overlappingDay),
				})
				return
			}
		}
	}

	// 4. Calculate total working days in the window
	workingDays := CalculateShiftWorkingDays(startDate, endDate, daysOfWeek)

	dailyRate := driver.DailyRate
	if dailyRate <= 0 {
		dailyRate = 1800 // Default fallback daily chauffeur base
	}
	totalCost := float64(workingDays) * dailyRate

	costCenter := input.CostCenter
	if costCenter == "" {
		costCenter = "General"
	}

	dailyStart := input.DailyStartTime
	if dailyStart == "" {
		dailyStart = "09:00"
	}
	dailyEnd := input.DailyEndTime
	if dailyEnd == "" {
		dailyEnd = "18:00"
	}

	now := time.Now().UTC()
	shift := models.ShiftRoster{
		ID:                 bson.NewObjectID(),
		OrganizationID:     org.ID,
		OrganizationName:   org.Name,
		DriverID:           driver.ID,
		DriverName:         driver.Name,
		DriverAvatar:       driver.Avatar.URL,
		DriverPhone:        driver.Phone,
		Title:              strings.TrimSpace(input.Title),
		CostCenter:         costCenter,
		StartDate:          startDate,
		EndDate:            endDate,
		DailyStartTime:     dailyStart,
		DailyEndTime:       dailyEnd,
		DaysOfWeek:         daysOfWeek,
		DailyRate:          dailyRate,
		TotalEstimatedDays: workingDays,
		TotalAmount:        totalCost,
		Status:             "confirmed",
		PickupLocation:     strings.TrimSpace(input.PickupLocation),
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	_, err = config.GetCollection("shifts").InsertOne(ctx, shift)
	if err != nil {
		telemetry.LogError("Failed to insert shift roster", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to schedule chauffeur shift"})
		return
	}

	// Notify driver
	socket.BroadcastCluster(driver.ID.Hex(), "shift_assigned", gin.H{
		"shiftId":          shift.ID.Hex(),
		"organizationName": org.Name,
		"title":            shift.Title,
		"startDate":        shift.StartDate,
		"endDate":          shift.EndDate,
		"dailyRate":        shift.DailyRate,
		"totalAmount":      shift.TotalAmount,
	})

	c.JSON(http.StatusCreated, gin.H{
		"message": "Chauffeur shift successfully scheduled and rostered",
		"shift":   shift,
	})
}

// GET /api/v1/corporate/organization/shifts
func GetOrganizationShifts(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "Database is not connected"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var org models.Organization
	err := config.GetCollection("organizations").FindOne(ctx, bson.M{
		"$or": bson.A{
			bson.M{"adminUser": userOID},
			bson.M{"members": userOID},
		},
		"isActive": true,
	}).Decode(&org)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Organization not found"})
		return
	}

	cursor, err := config.GetCollection("shifts").Find(
		ctx,
		bson.M{"organizationId": org.ID},
		options.Find().SetSort(bson.D{{Key: "startDate", Value: -1}}).SetLimit(50),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to query shifts"})
		return
	}
	defer cursor.Close(ctx)

	var shifts []models.ShiftRoster
	_ = cursor.All(ctx, &shifts)

	c.JSON(http.StatusOK, gin.H{
		"organization": org.Name,
		"shifts":       shifts,
		"total":        len(shifts),
	})
}

// GET /api/v1/drivers/shifts
func GetDriverShifts(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "Database is not connected"})
		return
	}

	driverObj, _ := c.Get("driver")
	driver, ok := driverObj.(*models.Driver)
	if !ok || driver == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Driver authentication required"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := config.GetCollection("shifts").Find(
		ctx,
		bson.M{"driverId": driver.ID},
		options.Find().SetSort(bson.D{{Key: "startDate", Value: 1}}).SetLimit(50),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load driver shifts"})
		return
	}
	defer cursor.Close(ctx)

	var shifts []models.ShiftRoster
	_ = cursor.All(ctx, &shifts)

	c.JSON(http.StatusOK, gin.H{
		"shifts": shifts,
		"total":  len(shifts),
	})
}

// PUT /api/v1/corporate/organization/shifts/:id/cancel
func CancelShiftRoster(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "Database is not connected"})
		return
	}

	shiftIDStr := c.Param("id")
	shiftOID, err := bson.ObjectIDFromHex(shiftIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid shift ID"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var org models.Organization
	err = config.GetCollection("organizations").FindOne(ctx, bson.M{
		"$or": bson.A{
			bson.M{"adminUser": userOID},
			bson.M{"members": userOID},
		},
		"isActive": true,
	}).Decode(&org)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": "Corporate organization permissions required"})
		return
	}

	result, err := config.GetCollection("shifts").UpdateOne(
		ctx,
		bson.M{"_id": shiftOID, "organizationId": org.ID, "status": bson.M{"$in": bson.A{"confirmed", "active"}}},
		bson.M{"$set": bson.M{"status": "cancelled", "updatedAt": time.Now().UTC()}},
	)
	if err != nil || result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Shift not found or already cancelled"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Shift cancelled successfully and driver slot released"})
}

// ParseShiftDates parses startDate and endDate strings in YYYY-MM-DD or RFC3339 formats.
// Returns an error if parsing fails or if startDate is strictly after endDate.
func ParseShiftDates(startStr, endStr string) (time.Time, time.Time, error) {
	startClean := strings.TrimSpace(startStr)
	endClean := strings.TrimSpace(endStr)
	if startClean == "" || endClean == "" {
		return time.Time{}, time.Time{}, fmt.Errorf("startDate and endDate are required")
	}

	startDate, err1 := time.Parse("2006-01-02", startClean)
	if err1 != nil {
		startDate, err1 = time.Parse(time.RFC3339, startClean)
	}
	if err1 != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid startDate format (expected YYYY-MM-DD or RFC3339)")
	}

	endDate, err2 := time.Parse("2006-01-02", endClean)
	if err2 != nil {
		endDate, err2 = time.Parse(time.RFC3339, endClean)
	}
	if err2 != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid endDate format (expected YYYY-MM-DD or RFC3339)")
	}

	if startDate.After(endDate) {
		return time.Time{}, time.Time{}, fmt.Errorf("shift start date cannot be after end date")
	}

	return startDate, endDate, nil
}

// CalculateShiftWorkingDays computes the number of matching weekdays between startDate and endDate (inclusive).
func CalculateShiftWorkingDays(startDate, endDate time.Time, daysOfWeek []string) int {
	if len(daysOfWeek) == 0 {
		daysOfWeek = []string{"Mon", "Tue", "Wed", "Thu", "Fri"}
	}
	dayMap := make(map[string]bool)
	for _, d := range daysOfWeek {
		trimmed := strings.ToLower(strings.TrimSpace(d))
		if len(trimmed) >= 3 {
			dayMap[trimmed[:3]] = true
		}
	}

	workingDays := 0
	curr := startDate
	for !curr.After(endDate) {
		weekdayShort := strings.ToLower(curr.Weekday().String()[:3])
		if dayMap[weekdayShort] {
			workingDays++
		}
		curr = curr.AddDate(0, 0, 1)
	}

	if workingDays == 0 {
		workingDays = 1
	}
	return workingDays
}

// FindFirstIntersectingDay checks if any weekday in requestedDays overlaps with existingDays (case-insensitive, 3-char prefix match).
func FindFirstIntersectingDay(requestedDays, existingDays []string) (bool, string) {
	for _, reqDay := range requestedDays {
		r := strings.ToLower(strings.TrimSpace(reqDay))
		if len(r) < 3 {
			continue
		}
		for _, existDay := range existingDays {
			e := strings.ToLower(strings.TrimSpace(existDay))
			if len(e) < 3 {
				continue
			}
			if r[:3] == e[:3] {
				return true, reqDay
			}
		}
	}
	return false, ""
}
