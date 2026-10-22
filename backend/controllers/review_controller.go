package controllers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"mymate-backend/config"
	"mymate-backend/models"
)

type createReviewReq struct {
	BookingID string  `json:"bookingId" binding:"required"`
	DriverID  string  `json:"driverId" binding:"required"`
	Rating    float64 `json:"rating" binding:"required,min=1,max=5"`
	Comment   string  `json:"comment"`
}

type updateReviewReq struct {
	Rating  *float64 `json:"rating"`
	Comment *string  `json:"comment"`
}

// Recalculates driver averageRating and totalReviews
func recalculateDriverRating(ctx context.Context, driverOID bson.ObjectID) {
	cursor, err := config.GetCollection("reviews").Find(ctx, bson.M{"driver": driverOID})
	if err != nil {
		return
	}
	defer cursor.Close(ctx)

	var totalRating float64
	var count int
	for cursor.Next(ctx) {
		var r models.Review
		if err := cursor.Decode(&r); err == nil {
			totalRating += r.Rating
			count++
		}
	}

	avg := 5.0
	if count > 0 {
		avg = totalRating / float64(count)
	}

	_, _ = config.GetCollection("drivers").UpdateOne(ctx,
		bson.M{"_id": driverOID},
		bson.M{"$set": bson.M{"averageRating": avg, "totalReviews": count, "updatedAt": time.Now()}},
	)
}

// POST /api/v1/reviews
func CreateReview(c *gin.Context) {
	var req createReviewReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request: " + err.Error()})
		return
	}

	bookingOID, err := bson.ObjectIDFromHex(req.BookingID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid booking ID"})
		return
	}
	driverOID, err := bson.ObjectIDFromHex(req.DriverID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid driver ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var booking models.Booking
	if err := config.GetCollection("bookings").FindOne(ctx, bson.M{"_id": bookingOID}).Decode(&booking); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Booking not found"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)
	if booking.User != userOID {
		c.JSON(http.StatusForbidden, gin.H{"message": "Not authorized"})
		return
	}
	if booking.Status != "completed" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "You can only review completed bookings"})
		return
	}
	if booking.PaymentStatus != "paid" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Please complete the payment before reviewing"})
		return
	}
	if booking.Driver != driverOID {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Driver does not match this booking"})
		return
	}

	var existing models.Review
	if err := config.GetCollection("reviews").FindOne(ctx, bson.M{"booking": bookingOID}).Decode(&existing); err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "You have already reviewed this booking"})
		return
	}

	now := time.Now()
	review := models.Review{
		ID:        bson.NewObjectID(),
		User:      userOID,
		Driver:    driverOID,
		Booking:   bookingOID,
		Rating:    req.Rating,
		Comment:   req.Comment,
		CreatedAt: now,
		UpdatedAt: now,
	}

	_, err = config.GetCollection("reviews").InsertOne(ctx, review)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create review", "error": err.Error()})
		return
	}

	recalculateDriverRating(ctx, driverOID)

	notif := models.Notification{
		ID:        bson.NewObjectID(),
		User:      driverOID,
		UserModel: "Driver",
		Title:     "New Review",
		Message:   fmt.Sprintf("You received a %.1f-star review.", req.Rating),
		Type:      "review",
		Link:      "/driver/bookings",
		CreatedAt: now,
		UpdatedAt: now,
	}
	_, _ = config.GetCollection("notifications").InsertOne(ctx, notif)

	c.JSON(http.StatusCreated, gin.H{"review": review})
}

// GET /api/v1/reviews/driver/:driverId
func GetDriverReviews(c *gin.Context) {
	driverOID, err := bson.ObjectIDFromHex(c.Param("driverId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid driver ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	findOpts := options.Find().SetSort(bson.M{"createdAt": -1})
	cursor, err := config.GetCollection("reviews").Find(ctx, bson.M{"driver": driverOID}, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch reviews"})
		return
	}
	defer cursor.Close(ctx)

	var reviews []models.Review
	if err := cursor.All(ctx, &reviews); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to decode reviews"})
		return
	}
	if reviews == nil {
		reviews = []models.Review{}
	}

	// Populate user name and avatar
	for i := range reviews {
		var u models.User
		if err := config.GetCollection("users").FindOne(ctx, bson.M{"_id": reviews[i].User}).Decode(&u); err == nil {
			reviews[i].UserObj = &models.UserSummary{
				ID:     u.ID,
				Name:   u.Name,
				Avatar: u.Avatar,
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"reviews": reviews})
}

// GET /api/v1/reviews/booking/:bookingId
func GetBookingReview(c *gin.Context) {
	bookingOID, err := bson.ObjectIDFromHex(c.Param("bookingId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid booking ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var booking models.Booking
	if err := config.GetCollection("bookings").FindOne(ctx, bson.M{"_id": bookingOID}).Decode(&booking); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Booking not found"})
		return
	}

	role, _ := c.Get("userRole")
	userRole, _ := role.(string)
	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)

	isOwner := userRole == "admin" ||
		(userRole == "user" && booking.User == userOID) ||
		(userRole == "driver" && booking.Driver == userOID)

	if !isOwner {
		c.JSON(http.StatusForbidden, gin.H{"message": "Not authorized"})
		return
	}

	var review models.Review
	if err := config.GetCollection("reviews").FindOne(ctx, bson.M{"booking": bookingOID}).Decode(&review); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "No review yet"})
		return
	}

	var u models.User
	if err := config.GetCollection("users").FindOne(ctx, bson.M{"_id": review.User}).Decode(&u); err == nil {
		review.UserObj = &models.UserSummary{
			ID:     u.ID,
			Name:   u.Name,
			Avatar: u.Avatar,
		}
	}

	c.JSON(http.StatusOK, gin.H{"review": review})
}

// PUT /api/v1/reviews/:id
func UpdateReview(c *gin.Context) {
	reviewOID, err := bson.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid review ID"})
		return
	}

	var req updateReviewReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var review models.Review
	if err := config.GetCollection("reviews").FindOne(ctx, bson.M{"_id": reviewOID}).Decode(&review); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Review not found"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)
	if review.User != userOID {
		c.JSON(http.StatusForbidden, gin.H{"message": "Not authorized"})
		return
	}

	updateFields := bson.M{"updatedAt": time.Now()}
	if req.Rating != nil {
		review.Rating = *req.Rating
		updateFields["rating"] = *req.Rating
	}
	if req.Comment != nil {
		review.Comment = *req.Comment
		updateFields["comment"] = *req.Comment
	}

	_, _ = config.GetCollection("reviews").UpdateOne(ctx, bson.M{"_id": reviewOID}, bson.M{"$set": updateFields})
	recalculateDriverRating(ctx, review.Driver)

	c.JSON(http.StatusOK, gin.H{"review": review})
}

// DELETE /api/v1/reviews/:id
func DeleteReview(c *gin.Context) {
	reviewOID, err := bson.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid review ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var review models.Review
	if err := config.GetCollection("reviews").FindOne(ctx, bson.M{"_id": reviewOID}).Decode(&review); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Review not found"})
		return
	}

	role, _ := c.Get("userRole")
	userRole, _ := role.(string)
	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)

	isAuthor := review.User == userOID
	isAdmin := userRole == "admin"
	if !isAuthor && !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"message": "Not authorized"})
		return
	}

	_, _ = config.GetCollection("reviews").DeleteOne(ctx, bson.M{"_id": reviewOID})
	recalculateDriverRating(ctx, review.Driver)

	c.JSON(http.StatusOK, gin.H{"message": "Review deleted"})
}
