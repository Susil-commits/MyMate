package services

import (
	"context"
	"math"
	"sort"
	"time"

	"mymate-backend/config"
	"mymate-backend/models"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type DriverCandidate struct {
	DriverID          string  `json:"driverId"`
	DistanceKm        float64 `json:"distanceKm"`
	Rating            float64 `json:"rating"`
	AcceptRatePercent float64 `json:"acceptRatePercent"`
	IdleMinutes       float64 `json:"idleMinutes"`
	Score             float64 `json:"score,omitempty"`
}

func HaversineKm(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371.0
	dLat := (lat2 - lat1) * (math.Pi / 180.0)
	dLon := (lon2 - lon1) * (math.Pi / 180.0)
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*(math.Pi/180.0))*math.Cos(lat2*(math.Pi/180.0))*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

func ScoreDriver(c DriverCandidate, distWeight, ratingWeight, acceptWeight, idleWeight float64) float64 {
	return (ratingWeight * c.Rating) -
		(distWeight * c.DistanceKm) +
		(acceptWeight * c.AcceptRatePercent) +
		(idleWeight * c.IdleMinutes)
}

func FindBestDrivers(userLat, userLng float64, limit int) []DriverCandidate {
	cfg := config.AppConfig
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var candidates []DriverCandidate

	// Tier 1: Sub-2ms Redis GEO spatial lookup
	if config.RedisClient != nil {
		redisLocs, geoErr := config.GeoSearchNearbyDrivers(ctx, "drivers:active", userLng, userLat, 15.0, 50)
		if geoErr == nil && len(redisLocs) > 0 {
			var dOIDs []bson.ObjectID
			distMap := make(map[string]float64)
			for _, loc := range redisLocs {
				if oid, err := bson.ObjectIDFromHex(loc.Name); err == nil {
					dOIDs = append(dOIDs, oid)
					distMap[loc.Name] = math.Round(loc.Dist*100) / 100
				}
			}

			if len(dOIDs) > 0 {
				cursor, dErr := config.DB.Collection("drivers").Find(ctx, bson.M{
					"_id":       bson.M{"$in": dOIDs},
					"kycStatus": "approved",
					"isActive":  true,
					"deletedAt": nil,
				})
				if dErr == nil {
					var drivers []models.Driver
					if cursor.All(ctx, &drivers) == nil {
						for _, d := range drivers {
							candidates = append(candidates, DriverCandidate{
								DriverID:          d.ID.Hex(),
								DistanceKm:        distMap[d.ID.Hex()],
								Rating:            d.AverageRating,
								AcceptRatePercent: 85,
								IdleMinutes:       15,
							})
						}
					}
					cursor.Close(ctx)
				}
			}
		}
	}

	// Tier 2: Attempt MongoDB $geoNear aggregation if Redis returned empty
	if len(candidates) == 0 {
		pipeline := mongo.Pipeline{
			bson.D{{Key: "$geoNear", Value: bson.D{
				{Key: "near", Value: bson.D{
					{Key: "type", Value: "Point"},
					{Key: "coordinates", Value: []float64{userLng, userLat}},
				}},
				{Key: "distanceField", Value: "distanceMeters"},
				{Key: "spherical", Value: true},
				{Key: "query", Value: bson.D{
					{Key: "kycStatus", Value: "approved"},
					{Key: "isActive", Value: true},
					{Key: "deletedAt", Value: nil},
				}},
			}}},
			bson.D{{Key: "$limit", Value: 50}},
		}

		cursor, err := config.DB.Collection("drivers").Aggregate(ctx, pipeline)
		if err == nil {
			defer cursor.Close(ctx)
			var results []struct {
				ID             bson.ObjectID   `bson:"_id"`
				Location       models.GeoPoint `bson:"location"`
				AverageRating  float64         `bson:"averageRating"`
				DistanceMeters float64         `bson:"distanceMeters"`
			}
			if err := cursor.All(ctx, &results); err == nil && len(results) > 0 {
				for _, r := range results {
					distKm := math.Round((r.DistanceMeters/1000.0)*100) / 100
					candidates = append(candidates, DriverCandidate{
						DriverID:          r.ID.Hex(),
						DistanceKm:        distKm,
						Rating:            r.AverageRating,
						AcceptRatePercent: 85,
						IdleMinutes:       15,
					})
				}
			}
		}
	}

	// Fallback to in-memory Haversine if geospatial aggregation returned empty
	if len(candidates) == 0 {
		filter := bson.D{
			{Key: "kycStatus", Value: "approved"},
			{Key: "isActive", Value: true},
			{Key: "deletedAt", Value: nil},
		}
		fallbackOpts := options.Find().SetLimit(100)
		cursor, err := config.DB.Collection("drivers").Find(ctx, filter, fallbackOpts)
		if err == nil {
			defer cursor.Close(ctx)
			var drivers []models.Driver
			_ = cursor.All(ctx, &drivers)
			for _, d := range drivers {
				dLat := userLat
				dLng := userLng
				if len(d.Location.Coordinates) == 2 {
					dLng = d.Location.Coordinates[0]
					dLat = d.Location.Coordinates[1]
				}
				dist := HaversineKm(userLat, userLng, dLat, dLng)
				candidates = append(candidates, DriverCandidate{
					DriverID:          d.ID.Hex(),
					DistanceKm:        math.Round(dist*100) / 100,
					Rating:            d.AverageRating,
					AcceptRatePercent: 85,
					IdleMinutes:       10,
				})
			}
		}
	}

	// Score and rank candidates
	for i := range candidates {
		candidates[i].Score = ScoreDriver(
			candidates[i],
			cfg.AIWeightDistance,
			cfg.AIWeightRating,
			cfg.AIWeightAcceptRate,
			cfg.AIWeightIdle,
		)
	}

	// Sort descending by score using O(N log N) quicksort
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].Score > candidates[j].Score
	})

	if limit > len(candidates) {
		limit = len(candidates)
	}
	return candidates[:limit]
}
