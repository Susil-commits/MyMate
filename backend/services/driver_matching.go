package services

import (
	"context"
	"math"
	"time"

	"mymate-backend/config"
	"mymate-backend/models"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
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

	// Attempt MongoDB $geoNear aggregation
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

	// Fallback to in-memory Haversine if geospatial aggregation returned empty
	if len(candidates) == 0 {
		filter := bson.D{
			{Key: "kycStatus", Value: "approved"},
			{Key: "isActive", Value: true},
			{Key: "deletedAt", Value: nil},
		}
		cursor, err := config.DB.Collection("drivers").Find(ctx, filter)
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

	// Sort descending by score
	for i := 0; i < len(candidates)-1; i++ {
		for j := i + 1; j < len(candidates); j++ {
			if candidates[j].Score > candidates[i].Score {
				candidates[i], candidates[j] = candidates[j], candidates[i]
			}
		}
	}

	if limit > len(candidates) {
		limit = len(candidates)
	}
	return candidates[:limit]
}
