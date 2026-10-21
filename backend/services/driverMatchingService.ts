import Driver from "../models/Driver.js";
import { DriverCandidate, ScoreWeights, rankDrivers } from "../utils/driverScoring.js";

/**
 * Haversine formula for calculating great-circle distance in km.
 * Retained as fallback when 2dsphere index is unavailable (e.g. mock test DBs).
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Service to retrieve and rank available drivers using the scoring engine.
 * Leverages Driver collection's 2dsphere index via $geoNear aggregation
 * for O(log N) geospatial distance computation in MongoDB, with graceful
 * fallback to in-memory Haversine if geospatial index is unavailable.
 */
export async function findBestDrivers(
  userLat: number,
  userLng: number,
  limit: number = 3
): Promise<DriverCandidate[]> {
  let candidates: DriverCandidate[] = [];

  try {
    const geoDrivers = await Driver.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [userLng, userLat],
          },
          distanceField: "distanceMeters",
          spherical: true,
          query: { kycStatus: "approved", isActive: true, deletedAt: null },
        },
      },
      {
        $project: {
          _id: 1,
          location: 1,
          averageRating: 1,
          experienceYears: 1,
          distanceMeters: 1,
        },
      },
      {
        $limit: 50,
      },
    ]);

    candidates = geoDrivers.map((d: any) => {
      const distKm = typeof d.distanceMeters === "number" ? d.distanceMeters / 1000 : 10;
      return {
        driverId: String(d._id),
        distanceKm: Math.round(distKm * 100) / 100,
        rating: d.averageRating || 4.0,
        acceptRatePercent: d.acceptRatePercent ?? 80,
        idleMinutes: d.idleMinutes ?? 10,
      };
    });
  } catch {
    // Fallback if 2dsphere index is missing (e.g., in-memory mock MongoDB in tests)
    const driversFromDb = await Driver.find({ kycStatus: "approved", isActive: true, deletedAt: null })
      .select("_id location averageRating experienceYears")
      .lean();

    candidates = driversFromDb.map((d) => {
      const driverLng = d.location?.coordinates?.[0] ?? userLng;
      const driverLat = d.location?.coordinates?.[1] ?? userLat;
      const distKm = haversineKm(userLat, userLng, driverLat, driverLng);

      return {
        driverId: String(d._id),
        distanceKm: isNaN(distKm) ? 10 : Math.round(distKm * 100) / 100,
        rating: d.averageRating || 4.0,
        acceptRatePercent: (d as any).acceptRatePercent ?? 80,
        idleMinutes: (d as any).idleMinutes ?? 10,
      };
    });
  }

  // Read scoring weights from configuration
  const currentWeights: ScoreWeights = {
    distanceWeight: parseFloat(process.env.AI_WEIGHT_DISTANCE ?? "2"),
    ratingWeight: parseFloat(process.env.AI_WEIGHT_RATING ?? "10"),
    acceptRateWeight: parseFloat(process.env.AI_WEIGHT_ACCEPT_RATE ?? "0.5"),
    idleWeight: parseFloat(process.env.AI_WEIGHT_IDLE ?? "1"),
  };

  // Compute ranks using deterministic algorithm
  const ranked = rankDrivers(candidates, currentWeights);

  return ranked.slice(0, limit);
}
