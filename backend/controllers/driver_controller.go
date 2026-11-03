package controllers

import (
	"context"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"mymate-backend/config"
	"mymate-backend/middleware"
	"mymate-backend/models"
	"mymate-backend/services"
	"mymate-backend/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// GET /api/v1/drivers
func GetDrivers(c *gin.Context) {
	locality := c.Query("locality")
	minExp := c.Query("minExperience")
	minRating := c.Query("minRating")
	vehicleType := c.Query("vehicleType")
	hireType := c.Query("hireType")
	languages := c.Query("languages")
	minRate := c.Query("minRate")
	maxRate := c.Query("maxRate")
	sortParam := c.Query("sort")
	search := c.Query("search")
	page := utils.ParseIntDefault(c.Query("page"), 1)
	limit := utils.ClampLimit(c.Query("limit"), 12, 50)
	skip := int64((page - 1) * limit)

	if config.DB == nil {
		c.JSON(http.StatusOK, gin.H{
			"drivers":    []models.SanitizedDriver{},
			"pagination": utils.BuildPagination(0, page, limit),
		})
		return
	}

	filter := bson.M{
		"kycStatus": "approved",
		"isActive":  true,
		"deletedAt": nil,
	}

	if search != "" {
		filter["$text"] = bson.M{"$search": search}
	}
	if locality != "" {
		filter["locality"] = bson.M{"$regex": locality, "$options": "i"}
	}
	if minExp != "" {
		if exp, err := strconv.ParseFloat(minExp, 64); err == nil {
			filter["experienceYears"] = bson.M{"$gte": exp}
		}
	}
	if minRating != "" {
		if r, err := strconv.ParseFloat(minRating, 64); err == nil {
			filter["averageRating"] = bson.M{"$gte": r}
		}
	}
	if vehicleType != "" {
		types := []string{}
		for _, t := range strings.Split(vehicleType, ",") {
			trimmed := strings.TrimSpace(t)
			if trimmed != "" {
				types = append(types, trimmed)
			}
		}
		if len(types) > 0 {
			filter["vehicleTypes"] = bson.M{"$in": types}
		}
	}
	if languages != "" {
		langs := []string{}
		for _, l := range strings.Split(languages, ",") {
			trimmed := strings.TrimSpace(l)
			if trimmed != "" {
				langs = append(langs, trimmed)
			}
		}
		if len(langs) > 0 {
			filter["languages"] = bson.M{"$in": langs}
		}
	}

	if hireType != "" {
		rateFilter := bson.M{}
		if minRate != "" {
			if mr, err := strconv.ParseFloat(minRate, 64); err == nil {
				rateFilter["$gte"] = mr
			}
		}
		if maxRate != "" {
			if mr, err := strconv.ParseFloat(maxRate, 64); err == nil {
				rateFilter["$lte"] = mr
			}
		}
		if len(rateFilter) > 0 {
			if hireType == "temporary" {
				filter["hourlyRate"] = rateFilter
			} else {
				filter["dailyRate"] = rateFilter
			}
		}
	}

	sortDoc := bson.D{{Key: "averageRating", Value: -1}, {Key: "totalReviews", Value: -1}}
	switch sortParam {
	case "experience":
		sortDoc = bson.D{{Key: "experienceYears", Value: -1}}
	case "price_low":
		sortDoc = bson.D{{Key: "hourlyRate", Value: 1}}
	case "price_high":
		sortDoc = bson.D{{Key: "hourlyRate", Value: -1}}
	case "newest":
		sortDoc = bson.D{{Key: "createdAt", Value: -1}}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	findOpts := options.Find().
		SetSort(sortDoc).
		SetSkip(skip).
		SetLimit(int64(limit))

	total, _ := config.DB.Collection("drivers").CountDocuments(ctx, filter)
	cursor, err := config.DB.Collection("drivers").Find(ctx, filter, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Query failed", "error": err.Error()})
		return
	}
	defer cursor.Close(ctx)

	var drivers []models.Driver
	_ = cursor.All(ctx, &drivers)

	var sanitized []models.SanitizedDriver
	for _, d := range drivers {
		sanitized = append(sanitized, models.SanitizeDriver(&d, false))
	}

	c.JSON(http.StatusOK, gin.H{
		"drivers":    sanitized,
		"pagination": utils.BuildPagination(total, page, limit),
	})
}

type RadarDriver struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	Avatar          string   `json:"avatar"`
	Locality        string   `json:"locality"`
	AverageRating   float64  `json:"averageRating"`
	TotalReviews    int      `json:"totalReviews"`
	VehicleTypes    []string `json:"vehicleTypes"`
	HourlyRate      float64  `json:"hourlyRate"`
	DailyRate       float64  `json:"dailyRate"`
	ExperienceYears float64  `json:"experienceYears"`
	DistanceKm      float64  `json:"distanceKm"`
	EtaMins         int      `json:"etaMins"`
	Lat             float64  `json:"lat"`
	Lng             float64  `json:"lng"`
	Status          string   `json:"status"`
}

// GET /api/v1/drivers/radar
func GetNearbyDriversRadar(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")
	if latStr == "" || lngStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Query parameters 'lat' and 'lng' are required for spatial radar"})
		return
	}

	userLat, errLat := strconv.ParseFloat(latStr, 64)
	userLng, errLng := strconv.ParseFloat(lngStr, 64)
	if errLat != nil || errLng != nil || userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid latitude or longitude coordinates"})
		return
	}

	radiusKm := 25.0
	if rStr := c.Query("radius"); rStr != "" {
		if r, err := strconv.ParseFloat(rStr, 64); err == nil && r > 0 && r <= 100 {
			radiusKm = r
		}
	}

	limit := utils.ClampLimit(c.Query("limit"), 20, 50)
	vehicleFilter := c.Query("vehicleType")

	if config.DB == nil {
		c.JSON(http.StatusOK, gin.H{
			"center":   gin.H{"lat": userLat, "lng": userLng},
			"radiusKm": radiusKm,
			"total":    0,
			"drivers":  []RadarDriver{},
			"source":   "none",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var radarDrivers []RadarDriver
	source := "mongodb_geo"

	// 1. Check Redis GEO first for active live online drivers
	if config.RedisClient != nil {
		geoLocs, err := config.GeoSearchNearbyDrivers(ctx, "drivers:active", userLng, userLat, radiusKm, limit)
		if err == nil && len(geoLocs) > 0 {
			source = "redis_geo"
			driverDistMap := make(map[string]float64)
			var oids []bson.ObjectID
			for _, gl := range geoLocs {
				driverDistMap[gl.Name] = gl.Dist
				if oid, err := bson.ObjectIDFromHex(gl.Name); err == nil {
					oids = append(oids, oid)
				}
			}

			if len(oids) > 0 {
				filter := bson.M{
					"_id":       bson.M{"$in": oids},
					"kycStatus": "approved",
					"isActive":  true,
					"deletedAt": nil,
				}
				if vehicleFilter != "" {
					filter["vehicleTypes"] = vehicleFilter
				}

				cursor, err := config.DB.Collection("drivers").Find(ctx, filter)
				if err == nil {
					var docs []models.Driver
					_ = cursor.All(ctx, &docs)
					for _, d := range docs {
						dist := driverDistMap[d.ID.Hex()]
						eta := int(math.Round((dist / 30.0) * 60.0)) + 3
						if dist < 0.5 {
							eta = 2
						}
						lat := 0.0
						lng := 0.0
						if len(d.Location.Coordinates) >= 2 {
							lng = d.Location.Coordinates[0]
							lat = d.Location.Coordinates[1]
						}
						radarDrivers = append(radarDrivers, RadarDriver{
							ID:              d.ID.Hex(),
							Name:            d.Name,
							Avatar:          d.Avatar.URL,
							Locality:        d.Locality,
							AverageRating:   d.AverageRating,
							TotalReviews:    d.TotalReviews,
							VehicleTypes:    d.VehicleTypes,
							HourlyRate:      d.HourlyRate,
							DailyRate:       d.DailyRate,
							ExperienceYears: d.ExperienceYears,
							DistanceKm:      math.Round(dist*100) / 100,
							EtaMins:         eta,
							Lat:             lat,
							Lng:             lng,
							Status:          "online",
						})
					}
				}
			}
		}
	}

	// 2. Fallback to MongoDB if Redis GEO yielded no results (e.g. initial boot or offline pool)
	if len(radarDrivers) == 0 {
		source = "mongodb_geo"
		filter := bson.M{
			"kycStatus":            "approved",
			"isActive":             true,
			"deletedAt":            nil,
			"location.coordinates": bson.M{"$exists": true, "$ne": nil},
		}
		if vehicleFilter != "" {
			filter["vehicleTypes"] = vehicleFilter
		}

		cursor, err := config.DB.Collection("drivers").Find(ctx, filter, options.Find().SetLimit(100))
		if err == nil {
			var docs []models.Driver
			_ = cursor.All(ctx, &docs)

			type distCandidate struct {
				driver models.Driver
				dist   float64
				lat    float64
				lng    float64
			}
			var candidates []distCandidate

			for _, d := range docs {
				if len(d.Location.Coordinates) >= 2 {
					dLng := d.Location.Coordinates[0]
					dLat := d.Location.Coordinates[1]
					if dLat != 0 || dLng != 0 {
						dist := services.HaversineKm(userLat, userLng, dLat, dLng)
						if dist <= radiusKm {
							candidates = append(candidates, distCandidate{
								driver: d,
								dist:   dist,
								lat:    dLat,
								lng:    dLng,
							})
						}
					}
				}
			}

			sort.Slice(candidates, func(i, j int) bool {
				return candidates[i].dist < candidates[j].dist
			})

			for i := 0; i < len(candidates) && i < limit; i++ {
				c := candidates[i]
				d := c.driver
				eta := int(math.Round((c.dist / 30.0) * 60.0)) + 3
				if c.dist < 0.5 {
					eta = 2
				}
				radarDrivers = append(radarDrivers, RadarDriver{
					ID:              d.ID.Hex(),
					Name:            d.Name,
					Avatar:          d.Avatar.URL,
					Locality:        d.Locality,
					AverageRating:   d.AverageRating,
					TotalReviews:    d.TotalReviews,
					VehicleTypes:    d.VehicleTypes,
					HourlyRate:      d.HourlyRate,
					DailyRate:       d.DailyRate,
					ExperienceYears: d.ExperienceYears,
					DistanceKm:      math.Round(c.dist*100) / 100,
					EtaMins:         eta,
					Lat:             c.lat,
					Lng:             c.lng,
					Status:          "active",
				})
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"center":   gin.H{"lat": userLat, "lng": userLng},
		"radiusKm": radiusKm,
		"total":    len(radarDrivers),
		"drivers":  radarDrivers,
		"source":   source,
	})
}

// GET /api/v1/drivers/stats
func GetPublicStats(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusOK, gin.H{
			"driverCount":      0,
			"tripCount":        0,
			"cityCount":        0,
			"averageRating":    0.0,
			"totalDrivers":     0,
			"availableDrivers": 0,
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	driverCount, _ := config.DB.Collection("drivers").CountDocuments(ctx, bson.M{
		"kycStatus": "approved", "isActive": true, "deletedAt": nil,
	})
	tripCount, _ := config.DB.Collection("bookings").CountDocuments(ctx, bson.M{
		"status": "completed",
	})

	var cities []string
	_ = config.DB.Collection("drivers").Distinct(ctx, "locality", bson.M{
		"kycStatus": "approved", "isActive": true, "locality": bson.M{"$ne": ""}, "deletedAt": nil,
	}).Decode(&cities)

	var avgRating float64
	pipeline := mongo.Pipeline{
		bson.D{{Key: "$match", Value: bson.D{
			{Key: "kycStatus", Value: "approved"},
			{Key: "isActive", Value: true},
			{Key: "deletedAt", Value: nil},
		}}},
		bson.D{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: nil},
			{Key: "avgRating", Value: bson.D{{Key: "$avg", Value: "$averageRating"}}},
		}}},
	}
	aggCursor, err := config.DB.Collection("drivers").Aggregate(ctx, pipeline)
	if err == nil {
		defer aggCursor.Close(ctx)
		var aggRes []struct {
			AvgRating float64 `bson:"avgRating"`
		}
		if aggCursor.All(ctx, &aggRes) == nil && len(aggRes) > 0 {
			avgRating = math.Round(aggRes[0].AvgRating*10) / 10
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"driverCount":      driverCount,
		"tripCount":        tripCount,
		"cityCount":        len(cities),
		"averageRating":    avgRating,
		"totalDrivers":     driverCount,
		"availableDrivers": driverCount,
	})
}

// GET /api/v1/drivers/:id
func GetDriverByID(c *gin.Context) {
	idStr := c.Param("id")
	objID, err := bson.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid driver ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var driver models.Driver
	err = config.DB.Collection("drivers").FindOne(ctx, bson.M{"_id": objID, "deletedAt": nil}).Decode(&driver)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Driver not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"driver": models.SanitizeDriver(&driver, false)})
}

// PUT /api/v1/drivers/profile
func UpdateDriverProfile(c *gin.Context) {
	driverObj, exists := c.Get("driver")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
		return
	}
	driver := driverObj.(*models.Driver)

	name := c.PostForm("name")
	phone := c.PostForm("phone")
	nationality := c.PostForm("nationality")
	locality := c.PostForm("locality")
	experienceYears := utils.ParseIntDefault(c.PostForm("experienceYears"), int(driver.ExperienceYears))
	hourlyRate := utils.ParseIntDefault(c.PostForm("hourlyRate"), int(driver.HourlyRate))
	dailyRate := utils.ParseIntDefault(c.PostForm("dailyRate"), int(driver.DailyRate))
	bio := c.PostForm("bio")
	availability := c.PostForm("availability")
	languagesRaw := c.PostForm("languages")
	vehicleTypesRaw := c.PostFormArray("vehicleTypes")
	if len(vehicleTypesRaw) == 0 && c.PostForm("vehicleTypes") != "" {
		vehicleTypesRaw = strings.Split(c.PostForm("vehicleTypes"), ",")
	}

	updateDoc := bson.M{
		"updatedAt": time.Now(),
	}

	if name != "" {
		updateDoc["name"] = name
		driver.Name = name
	}
	if phone != "" {
		updateDoc["phone"] = phone
		driver.Phone = phone
	}
	if nationality != "" {
		updateDoc["nationality"] = nationality
		driver.Nationality = nationality
	}
	if locality != "" {
		updateDoc["locality"] = locality
		driver.Locality = locality
	}
	if experienceYears > 0 {
		updateDoc["experienceYears"] = float64(experienceYears)
		driver.ExperienceYears = float64(experienceYears)
	}
	if hourlyRate > 0 {
		updateDoc["hourlyRate"] = float64(hourlyRate)
		driver.HourlyRate = float64(hourlyRate)
	}
	if dailyRate > 0 {
		updateDoc["dailyRate"] = float64(dailyRate)
		driver.DailyRate = float64(dailyRate)
	}
	if bio != "" {
		updateDoc["bio"] = bio
		driver.Bio = bio
	}
	if availability != "" {
		updateDoc["availability"] = availability
		driver.Availability = availability
	}

	if len(vehicleTypesRaw) > 0 {
		var vt []string
		for _, v := range vehicleTypesRaw {
			trimmed := strings.TrimSpace(v)
			if trimmed != "" {
				vt = append(vt, trimmed)
			}
		}
		if len(vt) > 0 {
			updateDoc["vehicleTypes"] = vt
			driver.VehicleTypes = vt
		}
	}

	if languagesRaw != "" {
		var langs []string
		for _, l := range strings.Split(languagesRaw, ",") {
			trimmed := strings.TrimSpace(l)
			if trimmed != "" {
				langs = append(langs, trimmed)
			}
		}
		if len(langs) > 0 {
			updateDoc["languages"] = langs
			driver.Languages = langs
		}
	}

	// Avatar upload
	if file, err := c.FormFile("avatar"); err == nil && file != nil {
		_ = os.MkdirAll("uploads/mymate/avatars", 0755)
		filename := filepath.Join("uploads/mymate/avatars", driver.ID.Hex()+"-"+file.Filename)
		if saveErr := c.SaveUploadedFile(file, filename); saveErr == nil {
			driver.Avatar = models.ImageRef{
				URL: "/" + filepath.ToSlash(filename),
			}
			updateDoc["avatar"] = driver.Avatar
		}
	}

	// License Image upload
	if file, err := c.FormFile("licenseImage"); err == nil && file != nil {
		_ = os.MkdirAll("uploads/mymate/licenses", 0755)
		filename := filepath.Join("uploads/mymate/licenses", driver.ID.Hex()+"-"+file.Filename)
		if saveErr := c.SaveUploadedFile(file, filename); saveErr == nil {
			driver.LicenseImage = models.ImageRef{
				URL: "/" + filepath.ToSlash(filename),
			}
			updateDoc["licenseImage"] = driver.LicenseImage

			if c.PostForm("resubmitKyc") == "true" {
				updateDoc["kycStatus"] = "pending"
				driver.KycStatus = "pending"
			}
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := config.DB.Collection("drivers").UpdateOne(ctx,
		bson.M{"_id": driver.ID},
		bson.M{"$set": updateDoc},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update profile", "error": err.Error()})
		return
	}

	middleware.ClearCachePrefix("drivers")
	middleware.ClearCachePrefix("stats")

	c.JSON(http.StatusOK, gin.H{
		"message": "Profile updated",
		"driver":  models.SanitizeDriver(driver, true),
	})
}

// GET /api/v1/drivers/wallet
func GetDriverWallet(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusOK, gin.H{
			"walletBalance": 0.0,
			"transactions":  []models.WalletTransaction{},
		})
		return
	}

	driverObj, exists := c.Get("driver")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
		return
	}
	driver := driverObj.(*models.Driver)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(50)
	cursor, err := config.DB.Collection("wallet_transactions").Find(ctx, bson.M{
		"owner":      driver.ID,
		"ownerModel": "Driver",
	}, opts)

	var txs []models.WalletTransaction
	if err == nil {
		_ = cursor.All(ctx, &txs)
	}
	if txs == nil {
		txs = []models.WalletTransaction{}
	}

	c.JSON(http.StatusOK, gin.H{
		"walletBalance": driver.WalletBalance,
		"transactions":  txs,
	})
}
