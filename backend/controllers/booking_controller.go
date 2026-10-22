package controllers

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"mymate-backend/config"
	"mymate-backend/models"
	"mymate-backend/services"
	"mymate-backend/socket"
	"mymate-backend/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type CreateBookingInput struct {
	DriverID         string         `json:"driverId" binding:"required"`
	HireType         string         `json:"hireType" binding:"required"`
	StartDate        string         `json:"startDate" binding:"required"`
	EndDate          string         `json:"endDate"`
	PickupLocation   string         `json:"pickupLocation" binding:"required"`
	DropLocation     string         `json:"dropLocation"`
	Stops            []string       `json:"stops"`
	Purpose          string         `json:"purpose" binding:"required"`
	PromoCode        string         `json:"promoCode"`
	IsRecurring      bool           `json:"isRecurring"`
	RecurringPattern string         `json:"recurringPattern"`
	RecurringEndDate string         `json:"recurringEndDate"`
}

func computeAmount(hireType string, start time.Time, end *time.Time, driver *models.Driver) float64 {
	if hireType == "temporary" {
		hours := 1.0
		if end != nil && end.After(start) {
			hours = math.Max(1.0, math.Ceil(end.Sub(start).Hours()))
		}
		return hours * driver.HourlyRate
	}
	days := 30.0
	if end != nil && end.After(start) {
		days = math.Max(1.0, math.Ceil(end.Sub(start).Hours()/24.0))
	}
	return days * driver.DailyRate
}

// POST /api/v1/bookings
func CreateBooking(c *gin.Context) {
	var input CreateBookingInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Required fields: driverId, hireType, startDate, pickupLocation, purpose"})
		return
	}

	driverObjID, err := bson.ObjectIDFromHex(input.DriverID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid driver ID"})
		return
	}

	userObj, _ := c.Get("user")
	user := userObj.(*models.User)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var driver models.Driver
	err = config.DB.Collection("drivers").FindOne(ctx, bson.M{"_id": driverObjID}).Decode(&driver)
	if err != nil || driver.KycStatus != "approved" || !driver.IsActive {
		c.JSON(http.StatusNotFound, gin.H{"message": "This driver is not available for booking"})
		return
	}

	// Prevent duplicate active booking
	dupCount, _ := config.DB.Collection("bookings").CountDocuments(ctx, bson.M{
		"user":   user.ID,
		"driver": driver.ID,
		"status": bson.M{"$in": bson.A{"pending", "accepted", "ongoing"}},
	})
	if dupCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"message": "You already have an active booking with this driver"})
		return
	}

	start, err := time.Parse(time.RFC3339, input.StartDate)
	if err != nil {
		start, err = time.Parse("2006-01-02T15:04:05.000Z", input.StartDate)
		if err != nil {
			start = time.Now()
		}
	}

	var end *time.Time
	if input.EndDate != "" {
		if t, err := time.Parse(time.RFC3339, input.EndDate); err == nil {
			end = &t
		} else if t, err := time.Parse("2006-01-02T15:04:05.000Z", input.EndDate); err == nil {
			end = &t
		}
	}

	baseAmount := computeAmount(input.HireType, start, end, &driver)
	surgeMultiplier := services.CalculateDynamicSurge(start)
	totalAmount := baseAmount * surgeMultiplier
	discountAmount := 0.0
	appliedPromo := ""

	if input.PromoCode != "" {
		code := strings.ToUpper(strings.TrimSpace(input.PromoCode))
		var promo models.PromoCode
		promoFilter := bson.M{
			"code":       code,
			"isActive":   true,
			"expiryDate": bson.M{"$gt": time.Now()},
		}
		promoUpdate := bson.M{
			"$inc": bson.M{"usedCount": 1},
		}
		res := config.DB.Collection("promocodes").FindOneAndUpdate(ctx, promoFilter, promoUpdate)
		if res.Decode(&promo) == nil {
			calcDiscount := (totalAmount * promo.DiscountPercentage) / 100.0
			discountAmount = math.Min(calcDiscount, promo.MaxDiscount)
			totalAmount = math.Max(0.0, totalAmount-discountAmount)
			appliedPromo = promo.Code
		}
	}

	baseBooking := models.Booking{
		User:               user.ID,
		Driver:             driver.ID,
		HireType:           input.HireType,
		Status:             "pending",
		StartDate:          start,
		EndDate:            end,
		PickupLocation:     input.PickupLocation,
		DropLocation:       input.DropLocation,
		Stops:              input.Stops,
		Purpose:            input.Purpose,
		BaseAmount:         baseAmount,
		SurgeMultiplier:    surgeMultiplier,
		TotalAmount:        totalAmount,
		PromoCode:          appliedPromo,
		DiscountAmount:     discountAmount,
		PaymentStatus:      "pending",
		CancellationReason: "",
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}

	var createdBookings []models.Booking

	if input.IsRecurring && input.RecurringPattern != "none" && input.RecurringEndDate != "" {
		rEnd, _ := time.Parse(time.RFC3339, input.RecurringEndDate)
		if rEnd.IsZero() {
			rEnd, _ = time.Parse("2006-01-02", input.RecurringEndDate)
		}
		groupID := fmt.Sprintf("REC-%d", time.Now().UnixMilli())
		currentStart := start
		var currentEnd *time.Time
		if end != nil {
			t := *end
			currentEnd = &t
		}

		for !currentStart.After(rEnd) && len(createdBookings) < 365 {
			b := baseBooking
			b.ID = bson.NewObjectID()
			b.StartDate = currentStart
			b.EndDate = currentEnd
			b.IsRecurring = true
			b.RecurringPattern = input.RecurringPattern
			b.RecurringEndDate = &rEnd
			b.RecurringGroupId = groupID

			createdBookings = append(createdBookings, b)

			if input.RecurringPattern == "daily" {
				currentStart = currentStart.AddDate(0, 0, 1)
				if currentEnd != nil {
					t := currentEnd.AddDate(0, 0, 1)
					currentEnd = &t
				}
			} else if input.RecurringPattern == "weekly" {
				currentStart = currentStart.AddDate(0, 0, 7)
				if currentEnd != nil {
					t := currentEnd.AddDate(0, 0, 7)
					currentEnd = &t
				}
			} else {
				break
			}
		}

		var docs []interface{}
		for _, b := range createdBookings {
			docs = append(docs, b)
		}
		if len(docs) > 0 {
			_, _ = config.DB.Collection("bookings").InsertMany(ctx, docs)
		}
	} else {
		baseBooking.ID = bson.NewObjectID()
		_, _ = config.DB.Collection("bookings").InsertOne(ctx, baseBooking)
		createdBookings = []models.Booking{baseBooking}
	}

	primary := createdBookings[0]

	// Send Notifications & Kafka Events
	_ = models.CreateNotification(ctx, config.DB, models.Notification{
		User:      driver.ID,
		UserModel: "Driver",
		Title:     "New Booking Request",
		Message:   fmt.Sprintf("New %s booking request from %s.", input.HireType, user.Name),
		Type:      "booking",
		Link:      "/bookings/" + primary.ID.Hex(),
	})

	socket.EmitNotification(driver.ID.Hex(), gin.H{
		"title": "New Booking Request",
		"body":  fmt.Sprintf("New booking from %s", user.Name),
		"link":  "/bookings/" + primary.ID.Hex(),
	})

	config.PublishKafkaEvent(config.TopicBookingCreated, primary.ID.Hex(), gin.H{
		"bookingId":   primary.ID.Hex(),
		"driverId":    driver.ID.Hex(),
		"userId":      user.ID.Hex(),
		"hireType":    input.HireType,
		"totalAmount": primary.TotalAmount,
	})

	c.JSON(http.StatusCreated, gin.H{
		"booking":      primary,
		"totalCreated": len(createdBookings),
	})
}

// GET /api/v1/bookings/user
func GetUserBookings(c *gin.Context) {
	userObj, _ := c.Get("user")
	user := userObj.(*models.User)

	status := c.Query("status")
	page := utils.ParseIntDefault(c.Query("page"), 1)
	limit := utils.ClampLimit(c.Query("limit"), 10, 50)
	skip := int64((page - 1) * limit)

	filter := bson.M{"user": user.ID}
	if status != "" {
		filter["status"] = status
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	total, _ := config.DB.Collection("bookings").CountDocuments(ctx, filter)
	findOpts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetSkip(skip).SetLimit(int64(limit))
	cursor, err := config.DB.Collection("bookings").Find(ctx, filter, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Query error"})
		return
	}
	defer cursor.Close(ctx)

	var bookings []models.Booking
	_ = cursor.All(ctx, &bookings)

	// Populate driver summaries
	for i := range bookings {
		var d models.Driver
		if err := config.DB.Collection("drivers").FindOne(ctx, bson.M{"_id": bookings[i].Driver}).Decode(&d); err == nil {
			bookings[i].DriverObj = &models.DriverSummary{
				ID:            d.ID,
				Name:          d.Name,
				Phone:         d.Phone,
				Email:         d.Email,
				Locality:      d.Locality,
				Avatar:        d.Avatar,
				AverageRating: d.AverageRating,
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"bookings":   bookings,
		"pagination": utils.BuildPagination(total, page, limit),
	})
}

// GET /api/v1/bookings/driver
func GetDriverBookings(c *gin.Context) {
	driverObj, _ := c.Get("driver")
	driver := driverObj.(*models.Driver)

	status := c.Query("status")
	page := utils.ParseIntDefault(c.Query("page"), 1)
	limit := utils.ClampLimit(c.Query("limit"), 10, 50)
	skip := int64((page - 1) * limit)

	filter := bson.M{"driver": driver.ID}
	if status != "" {
		filter["status"] = status
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	total, _ := config.DB.Collection("bookings").CountDocuments(ctx, filter)
	findOpts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetSkip(skip).SetLimit(int64(limit))
	cursor, err := config.DB.Collection("bookings").Find(ctx, filter, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Query error"})
		return
	}
	defer cursor.Close(ctx)

	var bookings []models.Booking
	_ = cursor.All(ctx, &bookings)

	// Populate user summaries
	for i := range bookings {
		var u models.User
		if err := config.DB.Collection("users").FindOne(ctx, bson.M{"_id": bookings[i].User}).Decode(&u); err == nil {
			bookings[i].UserObj = &models.UserSummary{
				ID:     u.ID,
				Name:   u.Name,
				Phone:  u.Phone,
				Email:  u.Email,
				Avatar: u.Avatar,
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"bookings":   bookings,
		"pagination": utils.BuildPagination(total, page, limit),
	})
}

// GET /api/v1/bookings/driver/stats
func GetDriverStats(c *gin.Context) {
	driverObj, _ := c.Get("driver")
	driver := driverObj.(*models.Driver)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pipeline := mongo.Pipeline{
		bson.D{{Key: "$match", Value: bson.D{{Key: "driver", Value: driver.ID}}}},
		bson.D{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: nil},
			{Key: "totalBookings", Value: bson.D{{Key: "$sum", Value: 1}}},
			{Key: "completedBookings", Value: bson.D{{Key: "$sum", Value: bson.D{{Key: "$cond", Value: bson.A{bson.D{{Key: "$eq", Value: bson.A{"$status", "completed"}}}, 1, 0}}}}}},
			{Key: "pendingBookings", Value: bson.D{{Key: "$sum", Value: bson.D{{Key: "$cond", Value: bson.A{bson.D{{Key: "$eq", Value: bson.A{"$status", "pending"}}}, 1, 0}}}}}},
			{Key: "earnings", Value: bson.D{{Key: "$sum", Value: bson.D{{Key: "$cond", Value: bson.A{
				bson.D{{Key: "$and", Value: bson.A{
					bson.D{{Key: "$eq", Value: bson.A{"$status", "completed"}}},
					bson.D{{Key: "$eq", Value: bson.A{"$paymentStatus", "paid"}}},
				}}},
				"$totalAmount",
				0,
			}}}}}},
		}}},
	}

	cursor, err := config.DB.Collection("bookings").Aggregate(ctx, pipeline)
	totalBookings := 0
	completedBookings := 0
	pendingBookings := 0
	earnings := 0.0

	if err == nil {
		defer cursor.Close(ctx)
		var stats []struct {
			TotalBookings     int     `bson:"totalBookings"`
			CompletedBookings int     `bson:"completedBookings"`
			PendingBookings   int     `bson:"pendingBookings"`
			Earnings          float64 `bson:"earnings"`
		}
		if cursor.All(ctx, &stats) == nil && len(stats) > 0 {
			totalBookings = stats[0].TotalBookings
			completedBookings = stats[0].CompletedBookings
			pendingBookings = stats[0].PendingBookings
			earnings = stats[0].Earnings
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"totalBookings":     totalBookings,
		"completedBookings": completedBookings,
		"pendingBookings":   pendingBookings,
		"earnings":          earnings,
	})
}

// GET /api/v1/bookings/:id
func GetBookingByID(c *gin.Context) {
	bObjID, err := bson.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid booking ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var booking models.Booking
	err = config.DB.Collection("bookings").FindOne(ctx, bson.M{"_id": bObjID}).Decode(&booking)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Booking not found"})
		return
	}

	role, _ := c.Get("userRole")
	userID, _ := c.Get("userID")

	isOwner := role == "admin" ||
		(role == "user" && booking.User == userID) ||
		(role == "driver" && booking.Driver == userID)

	if !isOwner {
		c.JSON(http.StatusForbidden, gin.H{"message": "Not authorized to view this booking"})
		return
	}

	// Populate User and Driver
	var u models.User
	_ = config.DB.Collection("users").FindOne(ctx, bson.M{"_id": booking.User}).Decode(&u)
	booking.UserObj = &models.UserSummary{
		ID:     u.ID,
		Name:   u.Name,
		Phone:  u.Phone,
		Email:  u.Email,
		Avatar: u.Avatar,
	}

	var d models.Driver
	_ = config.DB.Collection("drivers").FindOne(ctx, bson.M{"_id": booking.Driver}).Decode(&d)
	booking.DriverObj = &models.DriverSummary{
		ID:            d.ID,
		Name:          d.Name,
		Phone:         d.Phone,
		Email:         d.Email,
		Locality:      d.Locality,
		Avatar:        d.Avatar,
		AverageRating: d.AverageRating,
	}

	c.JSON(http.StatusOK, gin.H{"booking": booking})
}

// PUT /api/v1/bookings/:id/status
func UpdateBookingStatus(c *gin.Context) {
	bObjID, err := bson.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid booking ID"})
		return
	}

	var body struct {
		Status             string `json:"status" binding:"required"`
		CancellationReason string `json:"cancellationReason"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Status is required"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var booking models.Booking
	err = config.DB.Collection("bookings").FindOne(ctx, bson.M{"_id": bObjID}).Decode(&booking)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Booking not found"})
		return
	}

	role, _ := c.Get("userRole")
	userID, _ := c.Get("userID")

	isOwner := role == "admin" ||
		(role == "user" && booking.User == userID) ||
		(role == "driver" && booking.Driver == userID)

	if !isOwner {
		c.JSON(http.StatusForbidden, gin.H{"message": "Not authorized to update this booking"})
		return
	}

	booking.Status = body.Status
	if body.CancellationReason != "" {
		booking.CancellationReason = body.CancellationReason
	}
	booking.UpdatedAt = time.Now()

	_, err = config.DB.Collection("bookings").UpdateOne(ctx,
		bson.M{"_id": booking.ID},
		bson.M{"$set": bson.M{
			"status":             booking.Status,
			"cancellationReason": booking.CancellationReason,
			"updatedAt":          booking.UpdatedAt,
		}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update booking status"})
		return
	}

	// Real-time Socket & Kafka broadcast
	socket.EmitBookingUpdate(booking.ID.Hex(), booking)
	config.PublishKafkaEvent(config.TopicBookingStatusChanged, booking.ID.Hex(), gin.H{
		"bookingId": booking.ID.Hex(),
		"status":    booking.Status,
		"driverId":  booking.Driver.Hex(),
		"userId":    booking.User.Hex(),
	})

	c.JSON(http.StatusOK, gin.H{"booking": booking})
}

// GET /api/v1/bookings/:id/calendar
func DownloadCalendar(c *gin.Context) {
	bObjID, err := bson.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid booking ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var booking models.Booking
	err = config.DB.Collection("bookings").FindOne(ctx, bson.M{"_id": bObjID}).Decode(&booking)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Booking not found"})
		return
	}

	var user models.User
	_ = config.DB.Collection("users").FindOne(ctx, bson.M{"_id": booking.User}).Decode(&user)

	var driver models.Driver
	_ = config.DB.Collection("drivers").FindOne(ctx, bson.M{"_id": booking.Driver}).Decode(&driver)

	icsContent := utils.GenerateICS(&booking, &user, &driver)

	c.Header("Content-Type", "text/calendar; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"mymate-booking-%s.ics\"", booking.ID.Hex()))
	c.String(http.StatusOK, icsContent)
}

// GET /api/v1/bookings/:id/invoice
func DownloadInvoice(c *gin.Context) {
	bObjID, err := bson.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid booking ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var booking models.Booking
	err = config.DB.Collection("bookings").FindOne(ctx, bson.M{"_id": bObjID}).Decode(&booking)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Booking not found"})
		return
	}

	if booking.Status != "completed" || booking.PaymentStatus != "paid" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invoice is only available for paid and completed bookings."})
		return
	}

	var user models.User
	_ = config.DB.Collection("users").FindOne(ctx, bson.M{"_id": booking.User}).Decode(&user)

	var driver models.Driver
	_ = config.DB.Collection("drivers").FindOne(ctx, bson.M{"_id": booking.Driver}).Decode(&driver)

	pdfBytes, err := utils.GenerateInvoicePDF(&booking, &user, &driver)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to generate invoice PDF"})
		return
	}

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"invoice-%s.pdf\"", booking.ID.Hex()))
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}
