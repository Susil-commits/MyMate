// @ts-nocheck
import Driver from "../models/Driver.js";
import { DriverCandidate, ScoreWeights, rankDrivers } from "../utils/driverScoring.js";

/**
 * Haversine formula for calculating great-circle distance in km.
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
 */
export async function findBestDrivers(
  userLat: number,
  userLng: number,
  limit: number = 3
): Promise<DriverCandidate[]> {
  // Query available drivers from MongoDB
  const driversFromDb = await Driver.find({ kycStatus: "approved", isActive: true })
    .select("_id location averageRating experienceYears")
    .lean();

  // Map database documents to driver candidate interface
  const candidates: DriverCandidate[] = driversFromDb.map((d) => {
    const driverLng = d.location?.coordinates?.[0] ?? userLng;
    const driverLat = d.location?.coordinates?.[1] ?? userLat;

    const distKm = haversineKm(userLat, userLng, driverLat, driverLng);

    return {
      driverId: String(d._id),
      distanceKm: isNaN(distKm) ? 10 : distKm,
      rating: d.averageRating || 4.0,
      acceptRatePercent: (d as any).acceptRatePercent ?? 80,
      idleMinutes: (d as any).idleMinutes ?? 10,
    };
  });

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
