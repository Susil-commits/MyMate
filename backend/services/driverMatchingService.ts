// @ts-nocheck
import Driver from "../models/Driver.js";
import { DriverCandidate, ScoreWeights, rankDrivers } from "../utils/driverScoring.js";

/**
 * Haversine formula — accurate great-circle distance in km.
 * Replaces the old Euclidean placeholder that was inaccurate for geographic coords.
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
 * Impure Shell for Pure-Core Driver Matching
 *
 * Architecture:
 *   1. IMPURE  — Read approved, active drivers from MongoDB
 *   2. IMPURE  — Read scoring weights (from env/config)
 *   3. PURE    — Functional rankDrivers() — no I/O, no side-effects
 *   4. IMPURE  — Slice top-N and return to caller
 *
 * This implements the "Functional Core / Imperative Shell" pattern
 * (Haskell-inspired, see fp-poc/Main.hs for the pure equivalent).
 */
export async function findBestDrivers(
  userLat: number,
  userLng: number,
  limit: number = 3
): Promise<DriverCandidate[]> {
  // ── IMPURE: I/O — Database read ───────────────────────────────────────────
  const driversFromDb = await Driver.find({ kycStatus: "approved", isActive: true })
    .select("_id location averageRating experienceYears")
    .lean();

  // Map DB documents → pure DriverCandidate interface
  const candidates: DriverCandidate[] = driversFromDb.map((d) => {
    const driverLng = d.location?.coordinates?.[0] ?? userLng;
    const driverLat = d.location?.coordinates?.[1] ?? userLat;

    const distKm = haversineKm(userLat, userLng, driverLat, driverLng);

    return {
      driverId: String(d._id),
      distanceKm: isNaN(distKm) ? 10 : distKm,
      rating: d.averageRating || 4.0,
      // These two fields are not yet persisted in the Driver schema.
      // They default to reasonable values until the schema is extended.
      acceptRatePercent: (d as any).acceptRatePercent ?? 80,
      idleMinutes: (d as any).idleMinutes ?? 10,
    };
  });

  // ── IMPURE: Config read (weights could come from Redis/DB/feature flags) ───
  const currentWeights: ScoreWeights = {
    distanceWeight: parseFloat(process.env.AI_WEIGHT_DISTANCE ?? "2"),
    ratingWeight: parseFloat(process.env.AI_WEIGHT_RATING ?? "10"),
    acceptRateWeight: parseFloat(process.env.AI_WEIGHT_ACCEPT_RATE ?? "0.5"),
    idleWeight: parseFloat(process.env.AI_WEIGHT_IDLE ?? "1"),
  };

  // ── PURE: Business logic — zero I/O ───────────────────────────────────────
  const ranked = rankDrivers(candidates, currentWeights);

  // ── IMPURE: Return top-N ──────────────────────────────────────────────────
  return ranked.slice(0, limit);
}
