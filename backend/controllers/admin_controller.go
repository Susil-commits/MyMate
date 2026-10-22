package controllers

import (
	"context"
	"encoding/csv"
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"mymate-backend/config"
	"mymate-backend/models"
	"mymate-backend/utils"
)

type verifyDriverReq struct {
	Status string `json:"status" binding:"required,oneof=approved rejected"`
}

// GET /api/v1/admin/stats
func GetDashboardStats(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusOK, gin.H{
			"data": gin.H{
				"totalDrivers":      0,
				"activeDrivers":     0,
				"totalUsers":        0,
				"totalBookings":     0,
				"pendingKyc":        0,
				"completedBookings": 0,
				"cancelledBookings": 0,
				"revenue":           0.0,
			},
			"totalDrivers":      0,
			"activeDrivers":     0,
			"totalUsers":        0,
			"totalBookings":     0,
			"pendingKyc":        0,
			"completedBookings": 0,
			"cancelledBookings": 0,
			"revenue":           0.0,
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	notDeleted := bson.M{"deletedAt": nil}

	totalDrivers, _ := config.GetCollection("drivers").CountDocuments(ctx, notDeleted)
	activeDrivers, _ := config.GetCollection("drivers").CountDocuments(ctx, bson.M{
		"isActive":  true,
		"kycStatus": "approved",
		"deletedAt": nil,
	})
	totalUsers, _ := config.GetCollection("users").CountDocuments(ctx, notDeleted)
	totalBookings, _ := config.GetCollection("bookings").CountDocuments(ctx, bson.M{})
	pendingKyc, _ := config.GetCollection("drivers").CountDocuments(ctx, bson.M{
		"kycStatus": "pending",
		"deletedAt": nil,
	})
	completedBookings, _ := config.GetCollection("bookings").CountDocuments(ctx, bson.M{"status": "completed"})
	cancelledBookings, _ := config.GetCollection("bookings").CountDocuments(ctx, bson.M{
		"status": bson.M{"$in": []string{"cancelled", "rejected"}},
	})

	// Revenue aggregate
	pipeline := mongo.Pipeline{
		bson.D{{Key: "$match", Value: bson.D{{Key: "status", Value: "completed"}}}},
		bson.D{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: nil},
			{Key: "revenue", Value: bson.D{{Key: "$sum", Value: "$amount"}}},
		}}},
	}

	var revenue float64
	cursor, err := config.GetCollection("payments").Aggregate(ctx, pipeline)
	if err == nil {
		var revResult []struct {
			Revenue float64 `bson:"revenue"`
		}
		if err := cursor.All(ctx, &revResult); err == nil && len(revResult) > 0 {
			revenue = revResult[0].Revenue
		}
		cursor.Close(ctx)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Dashboard stats retrieved",
		"data": gin.H{
			"totalDrivers":      totalDrivers,
			"activeDrivers":     activeDrivers,
			"totalUsers":        totalUsers,
			"totalBookings":     totalBookings,
			"pendingKyc":        pendingKyc,
			"completedBookings": completedBookings,
			"cancelledBookings": cancelledBookings,
			"revenue":           revenue,
		},
	})
}

// GET /api/v1/admin/metrics
func GetAdminMetrics(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Bookings by status
	statusPipeline := mongo.Pipeline{
		bson.D{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: "$status"},
			{Key: "count", Value: bson.D{{Key: "$sum", Value: 1}}},
			{Key: "totalAmount", Value: bson.D{{Key: "$sum", Value: "$totalAmount"}}},
		}}},
		bson.D{{Key: "$project", Value: bson.D{
			{Key: "status", Value: "$_id"},
			{Key: "count", Value: 1},
			{Key: "totalAmount", Value: 1},
			{Key: "_id", Value: 0},
		}}},
	}

	var statusBreakdown []struct {
		Status      string  `json:"status" bson:"status"`
		Count       int     `json:"count" bson:"count"`
		TotalAmount float64 `json:"totalAmount" bson:"totalAmount"`
	}
	cursor, err := config.GetCollection("bookings").Aggregate(ctx, statusPipeline)
	if err == nil {
		_ = cursor.All(ctx, &statusBreakdown)
		cursor.Close(ctx)
	}
	if statusBreakdown == nil {
		statusBreakdown = []struct {
			Status      string  `json:"status" bson:"status"`
			Count       int     `json:"count" bson:"count"`
			TotalAmount float64 `json:"totalAmount" bson:"totalAmount"`
		}{}
	}

	bookingsByStatus := make(map[string]int)
	for _, item := range statusBreakdown {
		bookingsByStatus[item.Status] = item.Count
	}

	// 2. Revenue by week
	revenuePipeline := mongo.Pipeline{
		bson.D{{Key: "$match", Value: bson.D{{Key: "status", Value: "completed"}}}},
		bson.D{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: bson.D{
				{Key: "year", Value: bson.D{{Key: "$isoWeekYear", Value: "$createdAt"}}},
				{Key: "week", Value: bson.D{{Key: "$isoWeek", Value: "$createdAt"}}},
			}},
			{Key: "revenue", Value: bson.D{{Key: "$sum", Value: "$amount"}}},
			{Key: "count", Value: bson.D{{Key: "$sum", Value: 1}}},
		}}},
		bson.D{{Key: "$sort", Value: bson.D{
			{Key: "_id.year", Value: -1},
			{Key: "_id.week", Value: -1},
		}}},
		bson.D{{Key: "$limit", Value: 12}},
		bson.D{{Key: "$project", Value: bson.D{
			{Key: "year", Value: "$_id.year"},
			{Key: "week", Value: "$_id.week"},
			{Key: "revenue", Value: 1},
			{Key: "count", Value: 1},
			{Key: "_id", Value: 0},
		}}},
	}

	var revenueByWeek []struct {
		Year    int     `json:"year" bson:"year"`
		Week    int     `json:"week" bson:"week"`
		Revenue float64 `json:"revenue" bson:"revenue"`
		Count   int     `json:"count" bson:"count"`
	}
	revCursor, err := config.GetCollection("payments").Aggregate(ctx, revenuePipeline)
	if err == nil {
		_ = revCursor.All(ctx, &revenueByWeek)
		revCursor.Close(ctx)
	}
	if revenueByWeek == nil {
		revenueByWeek = []struct {
			Year    int     `json:"year" bson:"year"`
			Week    int     `json:"week" bson:"week"`
			Revenue float64 `json:"revenue" bson:"revenue"`
			Count   int     `json:"count" bson:"count"`
		}{}
	}

	// 3. Active driver count
	activeDriverCount, _ := config.GetCollection("drivers").CountDocuments(ctx, bson.M{
		"isActive":  true,
		"kycStatus": "approved",
		"deletedAt": nil,
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Admin metrics retrieved successfully",
		"data": gin.H{
			"bookingsByStatus":   bookingsByStatus,
			"bookingsBreakdown":  statusBreakdown,
			"revenueByWeek":      revenueByWeek,
			"activeDriverCount":  activeDriverCount,
		},
	})
}

// GET /api/v1/admin/heatmap
func GetAdminHeatmap(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	heatPoints := make([][3]float64, 0)

	// Active drivers
	dCursor, err := config.GetCollection("drivers").Find(ctx, bson.M{
		"isActive": true,
		"location": bson.M{"$exists": true},
	})
	if err == nil {
		var drivers []models.Driver
		_ = dCursor.All(ctx, &drivers)
		dCursor.Close(ctx)
		for _, d := range drivers {
			if len(d.Location.Coordinates) == 2 {
				// [lat, lng, intensity]
				heatPoints = append(heatPoints, [3]float64{d.Location.Coordinates[1], d.Location.Coordinates[0], 0.6})
			}
		}
	}

	// Recent bookings
	bFindOpts := options.Find().SetSort(bson.M{"createdAt": -1}).SetLimit(100)
	bCursor, err := config.GetCollection("bookings").Find(ctx, bson.M{
		"pickupCoordinates": bson.M{"$exists": true},
	}, bFindOpts)
	if err == nil {
		var bookings []models.Booking
		_ = bCursor.All(ctx, &bookings)
		bCursor.Close(ctx)
		for _, b := range bookings {
			if b.PickupCoordinates != nil && (b.PickupCoordinates.Lat != 0 || b.PickupCoordinates.Lng != 0) {
				heatPoints = append(heatPoints, [3]float64{b.PickupCoordinates.Lat, b.PickupCoordinates.Lng, 1.0})
			}
		}
	}

	// Fallback mock points around Mumbai if empty
	if len(heatPoints) == 0 {
		baseLat := 19.0760
		baseLng := 72.8777
		r := rand.New(rand.NewSource(time.Now().UnixNano()))
		for i := 0; i < 50; i++ {
			lat := baseLat + (r.Float64()-0.5)*0.1
			lng := baseLng + (r.Float64()-0.5)*0.1
			intensity := r.Float64()*0.8 + 0.2
			heatPoints = append(heatPoints, [3]float64{lat, lng, intensity})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Heatmap data retrieved",
		"data":    gin.H{"heatPoints": heatPoints},
	})
}

// GET /api/v1/admin/drivers
func GetAllDrivers(c *gin.Context) {
	kycStatus := c.Query("kycStatus")
	pageNum, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if pageNum < 1 {
		pageNum = 1
	}
	limitNum := utils.ClampLimit(c.Query("limit"), 20, 100)
	skip := int64((pageNum - 1) * limitNum)

	filter := bson.M{"deletedAt": nil}
	if kycStatus != "" {
		filter["kycStatus"] = kycStatus
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	total, _ := config.GetCollection("drivers").CountDocuments(ctx, filter)
	findOpts := options.Find().SetSort(bson.M{"createdAt": -1}).SetSkip(skip).SetLimit(int64(limitNum))
	cursor, err := config.GetCollection("drivers").Find(ctx, filter, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to fetch drivers"})
		return
	}
	defer cursor.Close(ctx)

	var drivers []models.Driver
	if err := cursor.All(ctx, &drivers); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to decode drivers"})
		return
	}
	if drivers == nil {
		drivers = []models.Driver{}
	}

	for i := range drivers {
		drivers[i].Password = ""
		drivers[i].TwoFactorSecret = ""
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Drivers retrieved",
		"data": gin.H{
			"drivers":    drivers,
			"pagination": utils.BuildPagination(total, pageNum, limitNum),
		},
	})
}

// GET /api/v1/admin/drivers/pending
func GetPendingDrivers(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	findOpts := options.Find().SetSort(bson.M{"updatedAt": -1})
	cursor, err := config.GetCollection("drivers").Find(ctx, bson.M{
		"kycStatus":        "pending",
		"profileCompleted": true,
		"deletedAt":        nil,
	}, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to fetch pending drivers"})
		return
	}
	defer cursor.Close(ctx)

	var drivers []models.Driver
	if err := cursor.All(ctx, &drivers); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to decode drivers"})
		return
	}
	if drivers == nil {
		drivers = []models.Driver{}
	}

	for i := range drivers {
		drivers[i].Password = ""
		drivers[i].TwoFactorSecret = ""
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Pending drivers retrieved",
		"data":    gin.H{"drivers": drivers},
	})
}

// GET /api/v1/admin/drivers/:id
func GetDriverDetail(c *gin.Context) {
	driverOID, err := bson.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid driver ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var driver models.Driver
	if err := config.GetCollection("drivers").FindOne(ctx, bson.M{"_id": driverOID}).Decode(&driver); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Driver not found"})
		return
	}

	driver.Password = ""
	driver.TwoFactorSecret = ""

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Driver detail retrieved",
		"data":    gin.H{"driver": driver},
	})
}

// PUT /api/v1/admin/drivers/:id/verify
func VerifyDriver(c *gin.Context) {
	driverOID, err := bson.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid driver ID"})
		return
	}

	var req verifyDriverReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Status must be approved or rejected"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	updateFields := bson.M{
		"kycStatus": req.Status,
		"updatedAt": time.Now(),
	}
	if req.Status == "approved" {
		updateFields["isActive"] = true
		updateFields["availability"] = "available"
	}

	var updated models.Driver
	err = config.GetCollection("drivers").FindOneAndUpdate(ctx,
		bson.M{"_id": driverOID},
		bson.M{"$set": updateFields},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&updated)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Driver not found"})
		return
	}

	// Publish Kafka event
	_ = config.PublishKafkaMessage(config.TopicDriverKycStatus, driverOID.Hex(), map[string]interface{}{
		"driverId": driverOID.Hex(),
		"status":   req.Status,
	})

	// Log audit
	adminID, _ := c.Get("userId")
	adminOID, _ := adminID.(bson.ObjectID)
	LogAudit(&adminOID, "Admin", "VERIFY_DRIVER", map[string]interface{}{
		"driverId": driverOID.Hex(),
		"status":   req.Status,
	}, c.ClientIP())

	updated.Password = ""
	updated.TwoFactorSecret = ""

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Driver verification status updated",
		"data":    gin.H{"driver": updated},
	})
}

// PUT /api/v1/admin/drivers/:id/toggle-active
func ToggleDriverActive(c *gin.Context) {
	driverOID, err := bson.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid driver ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var driver models.Driver
	if err := config.GetCollection("drivers").FindOne(ctx, bson.M{"_id": driverOID}).Decode(&driver); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Driver not found"})
		return
	}

	newStatus := !driver.IsActive
	_, _ = config.GetCollection("drivers").UpdateOne(ctx,
		bson.M{"_id": driverOID},
		bson.M{"$set": bson.M{"isActive": newStatus, "updatedAt": time.Now()}},
	)
	driver.IsActive = newStatus

	adminID, _ := c.Get("userId")
	adminOID, _ := adminID.(bson.ObjectID)
	LogAudit(&adminOID, "Admin", "TOGGLE_DRIVER_ACTIVE", map[string]interface{}{
		"driverId": driverOID.Hex(),
		"isActive": newStatus,
	}, c.ClientIP())

	driver.Password = ""
	driver.TwoFactorSecret = ""

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Driver status toggled",
		"data":    gin.H{"driver": driver},
	})
}

// DELETE /api/v1/admin/drivers/:id
func SoftDeleteDriver(c *gin.Context) {
	driverOID, err := bson.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid driver ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	now := time.Now()
	var driver models.Driver
	err = config.GetCollection("drivers").FindOneAndUpdate(ctx,
		bson.M{"_id": driverOID, "deletedAt": nil},
		bson.M{"$set": bson.M{
			"deletedAt":    now,
			"isActive":     false,
			"availability": "offline",
			"updatedAt":    now,
		}},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&driver)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Driver not found or already deleted"})
		return
	}

	adminID, _ := c.Get("userId")
	adminOID, _ := adminID.(bson.ObjectID)
	LogAudit(&adminOID, "Admin", "SOFT_DELETE_DRIVER", map[string]interface{}{
		"driverId": driverOID.Hex(),
	}, c.ClientIP())

	driver.Password = ""
	driver.TwoFactorSecret = ""

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Driver deleted successfully",
		"data":    gin.H{"driver": driver},
	})
}

// GET /api/v1/admin/users
func GetAllUsers(c *gin.Context) {
	pageNum, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if pageNum < 1 {
		pageNum = 1
	}
	limitNum := utils.ClampLimit(c.Query("limit"), 20, 100)
	skip := int64((pageNum - 1) * limitNum)

	filter := bson.M{"deletedAt": nil}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	total, _ := config.GetCollection("users").CountDocuments(ctx, filter)
	findOpts := options.Find().SetSort(bson.M{"createdAt": -1}).SetSkip(skip).SetLimit(int64(limitNum))
	cursor, err := config.GetCollection("users").Find(ctx, filter, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to fetch users"})
		return
	}
	defer cursor.Close(ctx)

	var users []models.User
	if err := cursor.All(ctx, &users); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to decode users"})
		return
	}
	if users == nil {
		users = []models.User{}
	}

	for i := range users {
		users[i].Password = ""
		users[i].TwoFactorSecret = ""
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Users retrieved",
		"data": gin.H{
			"users":      users,
			"pagination": utils.BuildPagination(total, pageNum, limitNum),
		},
	})
}

// PUT /api/v1/admin/users/:id/toggle-active
func ToggleUserActive(c *gin.Context) {
	userOID, err := bson.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid user ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user models.User
	if err := config.GetCollection("users").FindOne(ctx, bson.M{"_id": userOID}).Decode(&user); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "User not found"})
		return
	}

	newStatus := !user.IsActive
	_, _ = config.GetCollection("users").UpdateOne(ctx,
		bson.M{"_id": userOID},
		bson.M{"$set": bson.M{"isActive": newStatus, "updatedAt": time.Now()}},
	)
	user.IsActive = newStatus

	adminID, _ := c.Get("userId")
	adminOID, _ := adminID.(bson.ObjectID)
	LogAudit(&adminOID, "Admin", "TOGGLE_USER_ACTIVE", map[string]interface{}{
		"userId":   userOID.Hex(),
		"isActive": newStatus,
	}, c.ClientIP())

	user.Password = ""
	user.TwoFactorSecret = ""

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "User status toggled",
		"data":    gin.H{"user": user},
	})
}

// DELETE /api/v1/admin/users/:id
func SoftDeleteUser(c *gin.Context) {
	userOID, err := bson.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid user ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	now := time.Now()
	var user models.User
	err = config.GetCollection("users").FindOneAndUpdate(ctx,
		bson.M{"_id": userOID, "deletedAt": nil},
		bson.M{"$set": bson.M{
			"deletedAt": now,
			"isActive":  false,
			"updatedAt": now,
		}},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&user)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "User not found or already deleted"})
		return
	}

	adminID, _ := c.Get("userId")
	adminOID, _ := adminID.(bson.ObjectID)
	LogAudit(&adminOID, "Admin", "SOFT_DELETE_USER", map[string]interface{}{
		"userId": userOID.Hex(),
	}, c.ClientIP())

	user.Password = ""
	user.TwoFactorSecret = ""

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "User deleted successfully",
		"data":    gin.H{"user": user},
	})
}

// GET /api/v1/admin/bookings
func GetAllBookings(c *gin.Context) {
	status := c.Query("status")
	pageNum, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if pageNum < 1 {
		pageNum = 1
	}
	limitNum := utils.ClampLimit(c.Query("limit"), 20, 100)
	skip := int64((pageNum - 1) * limitNum)

	filter := bson.M{}
	if status != "" {
		filter["status"] = status
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	total, _ := config.GetCollection("bookings").CountDocuments(ctx, filter)
	findOpts := options.Find().SetSort(bson.M{"createdAt": -1}).SetSkip(skip).SetLimit(int64(limitNum))
	cursor, err := config.GetCollection("bookings").Find(ctx, filter, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to fetch bookings"})
		return
	}
	defer cursor.Close(ctx)

	var bookings []models.Booking
	if err := cursor.All(ctx, &bookings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to decode bookings"})
		return
	}
	if bookings == nil {
		bookings = []models.Booking{}
	}

	// Populate user & driver
	for i := range bookings {
		var u models.User
		if err := config.GetCollection("users").FindOne(ctx, bson.M{"_id": bookings[i].User}).Decode(&u); err == nil {
			bookings[i].UserObj = &models.UserSummary{
				ID:   u.ID,
				Name: u.Name,
			}
		}

		var d models.Driver
		if err := config.GetCollection("drivers").FindOne(ctx, bson.M{"_id": bookings[i].Driver}).Decode(&d); err == nil {
			bookings[i].DriverObj = &models.DriverSummary{
				ID:   d.ID,
				Name: d.Name,
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Bookings retrieved",
		"data": gin.H{
			"bookings":   bookings,
			"pagination": utils.BuildPagination(total, pageNum, limitNum),
		},
	})
}

// GET /api/v1/admin/bookings/export
func ExportBookingsCSV(c *gin.Context) {
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", "attachment; filename=\"bookings.csv\"")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	findOpts := options.Find().SetSort(bson.M{"createdAt": -1})
	cursor, err := config.GetCollection("bookings").Find(ctx, bson.M{}, findOpts)
	if err != nil {
		c.String(http.StatusInternalServerError, "Failed to stream bookings")
		return
	}
	defer cursor.Close(ctx)

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	// Header
	_ = writer.Write([]string{"ID", "User", "Driver", "Status", "Amount", "Date"})

	for cursor.Next(ctx) {
		var b models.Booking
		if err := cursor.Decode(&b); err == nil {
			userName := ""
			driverName := ""

			var u models.User
			if err := config.GetCollection("users").FindOne(ctx, bson.M{"_id": b.User}).Decode(&u); err == nil {
				userName = u.Name
			}
			var d models.Driver
			if err := config.GetCollection("drivers").FindOne(ctx, bson.M{"_id": b.Driver}).Decode(&d); err == nil {
				driverName = d.Name
			}

			_ = writer.Write([]string{
				b.ID.Hex(),
				userName,
				driverName,
				b.Status,
				fmt.Sprintf("%.2f", b.TotalAmount),
				b.CreatedAt.Format(time.RFC3339),
			})
			writer.Flush()
		}
	}
}
