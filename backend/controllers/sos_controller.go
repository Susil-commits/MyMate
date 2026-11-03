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
	"mymate-backend/utils"
)

type TriggerSOSInput struct {
	Reason   string  `json:"reason"`
	Lat      float64 `json:"lat"`
	Lng      float64 `json:"lng"`
	Locality string  `json:"locality"`
}

// POST /api/v1/bookings/:id/sos
func TriggerEmergencySOS(c *gin.Context) {
	bookingIDStr := c.Param("id")
	bookingOID, err := bson.ObjectIDFromHex(bookingIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid booking ID"})
		return
	}

	var input TriggerSOSInput
	_ = c.ShouldBindJSON(&input)

	if input.Reason == "" {
		input.Reason = "Emergency SOS Alert"
	}

	if config.DB == nil {
		c.JSON(http.StatusOK, gin.H{
			"message":          "Emergency SOS dispatched (offline test mode)",
			"incidentId":       "inc_test_offline",
			"emergencyHotline": "112 (National Emergency), +91-1800-MYMATE",
		})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)
	role, _ := c.Get("role")
	roleStr, _ := role.(string)

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	// 1. Fetch booking
	var booking models.Booking
	err = config.GetCollection("bookings").FindOne(ctx, bson.M{"_id": bookingOID}).Decode(&booking)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Booking not found"})
		return
	}

	// Verify caller belongs to the booking
	isRider := booking.User == userOID
	isDriver := booking.Driver == userOID
	if !isRider && !isDriver {
		c.JSON(http.StatusForbidden, gin.H{"message": "You are not an authorized party to this trip"})
		return
	}

	// 2. Fetch User and Driver Details for emergency dispatch payload
	var rider models.User
	var driver models.Driver
	_ = config.GetCollection("users").FindOne(ctx, bson.M{"_id": booking.User}).Decode(&rider)
	_ = config.GetCollection("drivers").FindOne(ctx, bson.M{"_id": booking.Driver}).Decode(&driver)

	triggeredByModel := "User"
	if roleStr == "driver" || isDriver {
		triggeredByModel = "Driver"
	}

	coords := []float64{input.Lng, input.Lat}
	if input.Lat == 0 && input.Lng == 0 && booking.PickupCoordinates != nil {
		coords = []float64{booking.PickupCoordinates.Lng, booking.PickupCoordinates.Lat}
	}

	now := time.Now().UTC()
	incident := models.Incident{
		BookingID:        booking.ID,
		TriggeredBy:      userOID,
		TriggeredByModel: triggeredByModel,
		RiderName:        rider.Name,
		RiderPhone:       rider.Phone,
		DriverName:       driver.Name,
		DriverPhone:      driver.Phone,
		VehicleNumber:    driver.LicenseNumber,
		VehicleModel:     strings.Join(driver.VehicleTypes, ", "),
		Coordinates:      coords,
		Locality:         input.Locality,
		Reason:           input.Reason,
		Status:           "triggered",
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	insertRes, err := config.GetCollection("incidents").InsertOne(ctx, incident)
	if err != nil {
		telemetry.LogError("Failed to record emergency incident", err)
	} else if oid, ok := insertRes.InsertedID.(bson.ObjectID); ok {
		incident.ID = oid
	}

	// 3. Mark booking with SOS status
	_, _ = config.GetCollection("bookings").UpdateOne(ctx,
		bson.M{"_id": bookingOID},
		bson.M{"$set": bson.M{"sosTriggered": true, "sosTriggeredAt": now}},
	)

	// 4. Real-time WebSocket High-Priority Broadcast
	alertPayload := map[string]interface{}{
		"incidentId":    incident.ID.Hex(),
		"bookingId":     booking.ID.Hex(),
		"triggeredBy":   triggeredByModel,
		"reason":        incident.Reason,
		"riderName":     incident.RiderName,
		"riderPhone":    incident.RiderPhone,
		"driverName":    incident.DriverName,
		"driverPhone":   incident.DriverPhone,
		"vehicleNumber": incident.VehicleNumber,
		"coordinates":   coords,
		"timestamp":     now.UnixMilli(),
	}

	// Broadcast to booking room and admin channel across cluster
	socket.BroadcastCluster("booking_"+booking.ID.Hex(), "emergency_sos_alert", alertPayload)
	socket.BroadcastCluster("admin_incidents", "emergency_sos_alert", alertPayload)

	// 5. Structured High-Priority Log
	telemetry.LogError("EMERGENCY SOS ALERT TRIGGERED", fmt.Errorf("in-ride emergency triggered by %s", triggeredByModel),
		"incidentId", incident.ID.Hex(),
		"bookingId", booking.ID.Hex(),
		"reason", incident.Reason,
		"lat", input.Lat,
		"lng", input.Lng,
	)

	c.JSON(http.StatusOK, gin.H{
		"message":          "EMERGENCY SOS DISPATCHED: Authorities and Security Team Notified",
		"incident":         incident,
		"emergencyHotline": "112 (National Emergency), +91-1800-MYMATE-SOS",
	})
}

// GET /api/v1/admin/incidents
func AdminGetIncidents(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusOK, gin.H{
			"incidents": []models.Incident{},
			"total":     0,
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{}
	if status := c.Query("status"); status != "" {
		filter["status"] = status
	}

	limit := utils.ClampLimit(c.Query("limit"), 20, 50)
	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(int64(limit))

	cursor, err := config.GetCollection("incidents").Find(ctx, filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch incidents"})
		return
	}
	defer cursor.Close(ctx)

	var incidents []models.Incident
	_ = cursor.All(ctx, &incidents)
	if incidents == nil {
		incidents = []models.Incident{}
	}

	c.JSON(http.StatusOK, gin.H{
		"incidents": incidents,
		"total":     len(incidents),
	})
}

// PUT /api/v1/admin/incidents/:id/resolve
func AdminResolveIncident(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "Database is not connected"})
		return
	}

	incidentIDStr := c.Param("id")
	incidentOID, err := bson.ObjectIDFromHex(incidentIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid incident ID"})
		return
	}

	var input struct {
		Status     string `json:"status" binding:"required"` // "acknowledged", "dispatched", "resolved"
		AdminNotes string `json:"adminNotes"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Status is required"})
		return
	}

	status := strings.ToLower(strings.TrimSpace(input.Status))
	if status != "acknowledged" && status != "dispatched" && status != "resolved" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Status must be 'acknowledged', 'dispatched', or 'resolved'"})
		return
	}

	adminID, _ := c.Get("userId")
	adminOID, _ := adminID.(bson.ObjectID)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	now := time.Now().UTC()
	updateFields := bson.M{
		"status":     status,
		"adminNotes": input.AdminNotes,
		"updatedAt":  now,
	}
	if status == "resolved" {
		updateFields["resolvedBy"] = adminOID
		updateFields["resolvedAt"] = now
	}

	res, err := config.GetCollection("incidents").UpdateOne(ctx, bson.M{"_id": incidentOID}, bson.M{"$set": updateFields})
	if err != nil || res.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Incident not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Incident updated to %s", status),
	})
}
