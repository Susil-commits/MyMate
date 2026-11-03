package controllers

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"mymate-backend/config"
	"mymate-backend/models"
)

type CreateOrgInput struct {
	Name          string   `json:"name" binding:"required"`
	GSTIN         string   `json:"gstin" binding:"required"`
	BillingEmail  string   `json:"billingEmail" binding:"required,email"`
	Phone         string   `json:"phone" binding:"required"`
	Address       string   `json:"address" binding:"required"`
	MonthlyBudget float64  `json:"monthlyBudget"`
	CostCenters   []string `json:"costCenters"`
}

type AddMemberInput struct {
	Email string `json:"email" binding:"required,email"`
}

// POST /api/v1/corporate/organization
func CreateOrganization(c *gin.Context) {
	var input CreateOrgInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request: " + err.Error()})
		return
	}

	// Validate 15-character Indian GSTIN format
	gstinRegex := regexp.MustCompile(`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`)
	cleanGSTIN := strings.ToUpper(strings.TrimSpace(input.GSTIN))
	if !gstinRegex.MatchString(cleanGSTIN) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid Indian GSTIN format (e.g. 27AAAAA0000A1Z5)"})
		return
	}

	if config.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "Database is not connected"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Check if GSTIN already registered
	count, _ := config.GetCollection("organizations").CountDocuments(ctx, bson.M{"gstin": cleanGSTIN})
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"message": "An organization with this GSTIN is already registered"})
		return
	}

	costCenters := input.CostCenters
	if len(costCenters) == 0 {
		costCenters = []string{"General", "Executive", "Operations"}
	}

	now := time.Now()
	org := models.Organization{
		ID:                bson.NewObjectID(),
		Name:              strings.TrimSpace(input.Name),
		GSTIN:             cleanGSTIN,
		BillingEmail:      strings.ToLower(strings.TrimSpace(input.BillingEmail)),
		Phone:             strings.TrimSpace(input.Phone),
		Address:           strings.TrimSpace(input.Address),
		MonthlyBudget:     input.MonthlyBudget,
		CurrentMonthSpend: 0,
		CostCenters:       costCenters,
		AdminUser:         userOID,
		Members:           []bson.ObjectID{userOID},
		IsActive:          true,
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	_, err := config.GetCollection("organizations").InsertOne(ctx, org)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create organization"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":      "Corporate organization registered successfully",
		"organization": org,
	})
}

// GET /api/v1/corporate/organization
func GetMyOrganization(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "Database is not connected"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var org models.Organization
	filter := bson.M{
		"$or": bson.A{
			bson.M{"adminUser": userOID},
			bson.M{"members": userOID},
		},
		"isActive": true,
	}

	err := config.GetCollection("organizations").FindOne(ctx, filter).Decode(&org)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "No corporate organization associated with this account"})
		return
	}

	var memberProfiles []gin.H
	if len(org.Members) > 0 {
		userCursor, err := config.GetCollection("users").Find(ctx, bson.M{"_id": bson.M{"$in": org.Members}})
		if err == nil {
			var users []models.User
			_ = userCursor.All(ctx, &users)
			for _, u := range users {
				memberProfiles = append(memberProfiles, gin.H{
					"id":        u.ID.Hex(),
					"name":      u.Name,
					"email":     u.Email,
					"phone":     u.Phone,
					"locality":  u.Locality,
					"avatar":    u.Avatar.URL,
					"isAdmin":   u.ID == org.AdminUser,
					"createdAt": u.CreatedAt,
				})
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"organization": org,
		"membersList":  memberProfiles,
	})
}

// POST /api/v1/corporate/organization/members
func AddCorporateMember(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "Database is not connected"})
		return
	}

	var input AddMemberInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Valid email is required"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var org models.Organization
	err := config.GetCollection("organizations").FindOne(ctx, bson.M{"adminUser": userOID, "isActive": true}).Decode(&org)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": "Only corporate administrators can manage organization members"})
		return
	}

	memberEmail := strings.ToLower(strings.TrimSpace(input.Email))
	var member models.User
	err = config.GetCollection("users").FindOne(ctx, bson.M{"email": memberEmail}).Decode(&member)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "User not found with this email"})
		return
	}

	// Add to members list if not already present
	_, _ = config.GetCollection("organizations").UpdateOne(ctx,
		bson.M{"_id": org.ID},
		bson.M{"$addToSet": bson.M{"members": member.ID}},
	)

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Added %s (%s) to %s corporate account", member.Name, member.Email, org.Name),
	})
}

// GET /api/v1/corporate/organization/invoice
func GetCorporateMonthlyTaxInvoice(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "Database is not connected"})
		return
	}

	userID, _ := c.Get("userId")
	userOID, _ := userID.(bson.ObjectID)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
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
		c.JSON(http.StatusNotFound, gin.H{"message": "Corporate organization not found"})
		return
	}

	monthStr := c.DefaultQuery("month", time.Now().Format("2006-01"))
	startTime, _ := time.Parse("2006-01", monthStr)
	endTime := startTime.AddDate(0, 1, 0)

	bookingFilter := bson.M{
		"user":          bson.M{"$in": org.Members},
		"paymentStatus": "paid",
		"createdAt": bson.M{
			"$gte": startTime,
			"$lt":  endTime,
		},
	}

	cursor, err := config.GetCollection("bookings").Find(ctx, bookingFilter, options.Find().SetSort(bson.M{"createdAt": -1}))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to aggregate monthly rides"})
		return
	}
	defer cursor.Close(ctx)

	var bookings []models.Booking
	_ = cursor.All(ctx, &bookings)

	totalFares := 0.0
	for _, b := range bookings {
		totalFares += b.TotalAmount
	}

	// GST Breakdown (18% Integrated GST on driver tech intermediary services)
	taxableValue := totalFares / 1.18
	gstAmount := totalFares - taxableValue
	cgst := gstAmount / 2.0
	sgst := gstAmount / 2.0

	providerName := config.AppConfig.CompanyLegalName
	providerGstin := config.AppConfig.CompanyGSTIN
	providerPan := config.AppConfig.CompanyPAN
	providerAddress := config.AppConfig.CompanyAddress
	sacCode := config.AppConfig.CompanySAC

	c.JSON(http.StatusOK, gin.H{
		"invoiceNumber":   fmt.Sprintf("CORP-INV-%s-%s", org.ID.Hex()[:6], startTime.Format("200601")),
		"billingMonth":    monthStr,
		"organization":    org.Name,
		"gstin":           org.GSTIN,
		"billingEmail":    org.BillingEmail,
		"address":         org.Address,
		"providerName":    providerName,
		"providerGstin":   providerGstin,
		"providerPan":     providerPan,
		"providerAddress": providerAddress,
		"sacCode":         sacCode,
		"totalTrips":      len(bookings),
		"taxableValue":    math.Round(taxableValue*100) / 100,
		"cgst":            math.Round(cgst*100) / 100,
		"sgst":            math.Round(sgst*100) / 100,
		"totalGst":        math.Round(gstAmount*100) / 100,
		"totalAmountINR":  math.Round(totalFares*100) / 100,
		"currency":        "INR",
		"generatedAt":     time.Now().UTC().Format(time.RFC3339),
	})
}
