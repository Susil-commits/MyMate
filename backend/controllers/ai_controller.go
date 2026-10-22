package controllers

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"mymate-backend/config"
	"mymate-backend/models"
	"mymate-backend/services"
)

type chatReq struct {
	Message string                    `json:"message" binding:"required"`
	History []services.ChatHistoryItem `json:"history"`
}

type verifyKycReq struct {
	ImageURL string `json:"imageUrl" binding:"required"`
	DriverID string `json:"driverId"`
}

// GET /api/v1/ai/recommend
func RecommendDrivers(c *gin.Context) {
	hireType := c.Query("hireType")
	vehicleType := c.Query("vehicleType")
	latStr := c.Query("lat")
	lngStr := c.Query("lng")

	userLat, err1 := strconv.ParseFloat(latStr, 64)
	userLng, err2 := strconv.ParseFloat(lngStr, 64)
	hasLocation := err1 == nil && err2 == nil

	filter := bson.M{
		"kycStatus": "approved",
		"isActive":  true,
		"deletedAt": nil,
	}

	if vehicleType != "" {
		vTypes := []string{}
		for _, vt := range strings.Split(vehicleType, ",") {
			trimmed := strings.TrimSpace(vt)
			if trimmed != "" {
				vTypes = append(vTypes, trimmed)
			}
		}
		if len(vTypes) > 0 {
			filter["vehicleTypes"] = bson.M{"$in": vTypes}
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := config.GetCollection("drivers").Find(ctx, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to query drivers"})
		return
	}
	defer cursor.Close(ctx)

	var drivers []models.Driver
	_ = cursor.All(ctx, &drivers)
	if drivers == nil {
		drivers = []models.Driver{}
	}

	// Try Gemini AI Ranking if configured and drivers found
	if config.AppConfig.GeminiAPIKey != "" && len(drivers) > 0 {
		type driverSum struct {
			ID      string   `json:"id"`
			Rating  float64  `json:"rating"`
			Exp     float64  `json:"exp"`
			VTypes  []string `json:"vTypes"`
			DistKm  string   `json:"distKm"`
			Reviews int      `json:"reviews"`
		}
		var summaries []driverSum
		for _, d := range drivers {
			distStr := "unknown"
			if hasLocation && len(d.Location.Coordinates) == 2 {
				dKm := services.HaversineKm(userLat, userLng, d.Location.Coordinates[1], d.Location.Coordinates[0])
				distStr = fmt.Sprintf("%.1f", dKm)
			}
			summaries = append(summaries, driverSum{
				ID:      d.ID.Hex(),
				Rating:  d.AverageRating,
				Exp:     d.ExperienceYears,
				VTypes:  d.VehicleTypes,
				DistKm:  distStr,
				Reviews: d.TotalReviews,
			})
		}

		sumBytes, _ := json.Marshal(summaries)
		prompt := fmt.Sprintf(`You are a smart matchmaking AI for MyMate, a premium driver booking platform.
User needs: VehicleType="%s", HireType="%s".
Available drivers (JSON): %s
Rank the top 3 best-matching drivers. Prioritise: highest rating, most experience, closest distance, most reviews.
Return ONLY a JSON array of the top 3 driver IDs in order. Example: ["id1","id2","id3"]. No markdown, no explanation.`,
			vehicleType, hireType, string(sumBytes))

		contents := []map[string]interface{}{
			{
				"role":  "user",
				"parts": []map[string]string{{"text": prompt}},
			},
		}

		aiResp, err := services.CallGeminiCascade(contents, "You are an AI driver matchmaking engine. Return only JSON arrays.")
		if err == nil {
			cleanJSON := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(aiResp, "```json", ""), "```", ""))
			var rankedIDs []string
			if err := json.Unmarshal([]byte(cleanJSON), &rankedIDs); err == nil && len(rankedIDs) > 0 {
				type scoredDriver struct {
					models.Driver
					AIScore    int    `json:"aiScore"`
					AIRankedBy string `json:"aiRankedBy"`
				}
				var rankedDrivers []scoredDriver
				score := 99
				for _, id := range rankedIDs {
					for _, d := range drivers {
						if d.ID.Hex() == id {
							d.Password = ""
							d.TwoFactorSecret = ""
							rankedDrivers = append(rankedDrivers, scoredDriver{
								Driver:     d,
								AIScore:    score,
								AIRankedBy: "gemini",
							})
							score--
							break
						}
					}
				}
				if len(rankedDrivers) > 0 {
					limit := 3
					if limit > len(rankedDrivers) {
						limit = len(rankedDrivers)
					}
					c.JSON(http.StatusOK, gin.H{
						"recommended": rankedDrivers[:limit],
						"rankedBy":    "gemini",
					})
					return
				}
			}
		}
	}

	// Heuristic Fallback Ranking
	type scoredDriver struct {
		models.Driver
		AIScore    int    `json:"aiScore"`
		AIRankedBy string `json:"aiRankedBy"`
	}
	var scoredList []scoredDriver
	for _, d := range drivers {
		s := (d.AverageRating / 5.0) * 40.0
		expCap := math.Min(float64(d.ExperienceYears), 10.0)
		s += (expCap / 10.0) * 30.0

		if hasLocation && len(d.Location.Coordinates) == 2 {
			dist := services.HaversineKm(userLat, userLng, d.Location.Coordinates[1], d.Location.Coordinates[0])
			s += math.Max(0, 30.0-dist*1.5)
		} else {
			s += 15.0
		}

		d.Password = ""
		d.TwoFactorSecret = ""
		scoredList = append(scoredList, scoredDriver{
			Driver:     d,
			AIScore:    int(math.Round(s)),
			AIRankedBy: "heuristic",
		})
	}

	sort.Slice(scoredList, func(i, j int) bool {
		return scoredList[i].AIScore > scoredList[j].AIScore
	})

	limit := 3
	if limit > len(scoredList) {
		limit = len(scoredList)
	}

	c.JSON(http.StatusOK, gin.H{
		"recommended": scoredList[:limit],
		"rankedBy":    "heuristic",
	})
}

// POST /api/v1/ai/chat
func Chat(c *gin.Context) {
	var req chatReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Message is required and cannot be empty."})
		return
	}

	cleanMessage := strings.TrimSpace(req.Message)
	if cleanMessage == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Message is required and cannot be empty."})
		return
	}
	if len(cleanMessage) > 1000 {
		cleanMessage = cleanMessage[:1000]
	}

	// If Gemini key is not configured, seamlessly serve via local platform knowledge engine
	if config.AppConfig.GeminiAPIKey == "" {
		fallbackResp := services.GetLocalPlatformResponse(cleanMessage)
		updatedHistory := append(req.History,
			services.ChatHistoryItem{Role: "user", Text: cleanMessage},
			services.ChatHistoryItem{Role: "model", Text: fallbackResp},
		)
		c.JSON(http.StatusOK, gin.H{
			"response": fallbackResp,
			"history":  updatedHistory,
			"source":   "local-engine",
		})
		return
	}

	contents, safeHistory := services.SanitizeConversationHistory(req.History, cleanMessage)
	responseText, err := services.CallGeminiCascade(contents, services.SystemInstruction)

	source := "ai"
	if err != nil || strings.TrimSpace(responseText) == "" {
		responseText = services.GetLocalPlatformResponse(cleanMessage)
		source = "local-engine"
	}

	updatedHistory := append(safeHistory,
		services.ChatHistoryItem{Role: "user", Text: cleanMessage},
		services.ChatHistoryItem{Role: "model", Text: responseText},
	)

	c.JSON(http.StatusOK, gin.H{
		"response": responseText,
		"history":  updatedHistory,
		"source":   source,
	})
}

// GET /api/v1/ai/heatmap
func GetHeatmap(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	findOpts := options.Find().SetSort(bson.M{"createdAt": -1}).SetLimit(500)
	filter := bson.M{
		"status":                 bson.M{"$in": []string{"completed", "ongoing", "accepted"}},
		"pickupCoordinates.lat": bson.M{"$exists": true},
		"pickupCoordinates.lng": bson.M{"$exists": true},
	}

	cursor, err := config.GetCollection("bookings").Find(ctx, filter, findOpts)
	var heatPoints [][3]float64
	if err == nil {
		var bookings []models.Booking
		_ = cursor.All(ctx, &bookings)
		cursor.Close(ctx)
		for _, b := range bookings {
			if b.PickupCoordinates != nil && (b.PickupCoordinates.Lat != 0 || b.PickupCoordinates.Lng != 0) {
				heatPoints = append(heatPoints, [3]float64{b.PickupCoordinates.Lat, b.PickupCoordinates.Lng, 1.0})
			}
		}
	}

	source := "live"
	if len(heatPoints) < 5 {
		source = "synthetic"
		heatPoints = [][3]float64{}
		cities := []struct {
			Lat, Lng float64
		}{
			{19.0760, 72.8777}, // Mumbai
			{12.9716, 77.5946}, // Bangalore
			{28.6139, 77.2090}, // Delhi
		}
		r := rand.New(rand.NewSource(time.Now().UnixNano()))
		for _, city := range cities {
			for i := 0; i < 17; i++ {
				lat := city.Lat + (r.Float64()-0.5)*0.12
				lng := city.Lng + (r.Float64()-0.5)*0.12
				intensity := r.Float64()*0.8 + 0.2
				heatPoints = append(heatPoints, [3]float64{lat, lng, intensity})
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"heatPoints": heatPoints,
		"source":     source,
	})
}

// POST /api/v1/ai/verify-kyc
func VerifyKyc(c *gin.Context) {
	var req verifyKycReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "imageUrl is required"})
		return
	}

	// Validate licence using pattern extractor
	result := services.ValidateLicenseNumber(req.ImageURL)

	var licenseMatch *bool
	if req.DriverID != "" && result.ExtractedLicenseNumber != "" {
		driverOID, err := bson.ObjectIDFromHex(req.DriverID)
		if err == nil {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			var driver models.Driver
			if err := config.GetCollection("drivers").FindOne(ctx, bson.M{"_id": driverOID}).Decode(&driver); err == nil {
				normalize := func(s string) string {
					return strings.ToUpper(strings.ReplaceAll(strings.ReplaceAll(s, " ", ""), "-", ""))
				}
				match := normalize(driver.LicenseNumber) == normalize(result.ExtractedLicenseNumber)
				licenseMatch = &match
			}
		}
	}

	rec := "review"
	if result.IsValid && (licenseMatch == nil || *licenseMatch) {
		rec = "approve"
	}

	c.JSON(http.StatusOK, gin.H{
		"extractedLicenseNumber": result.ExtractedLicenseNumber,
		"confidence":             result.Confidence,
		"isValid":                result.IsValid,
		"flags":                  result.Flags,
		"licenseMatch":           licenseMatch,
		"recommendation":         rec,
	})
}

// GET /api/v1/ai/match
func GetDriverMatch(c *gin.Context) {
	userLat, err1 := strconv.ParseFloat(c.Query("lat"), 64)
	userLng, err2 := strconv.ParseFloat(c.Query("lng"), 64)
	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "lat and lng query parameters are required"})
		return
	}

	limit := 3
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			if parsed > 10 {
				parsed = 10
			}
			limit = parsed
		}
	}

	candidates := services.FindBestDrivers(userLat, userLng, limit)

	c.JSON(http.StatusOK, gin.H{
		"matches":       candidates,
		"scoringMethod": "pure-functional (rating × 10 + acceptRate × 0.5 − distance × 2 − idleMin × 1)",
		"count":         len(candidates),
	})
}
