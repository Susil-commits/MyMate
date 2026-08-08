import { DriverCandidate, ScoreWeights, rankDrivers } from '../utils/driverScoring.js';
import Driver from '../models/Driver.js'; // Assuming this exists

/**
 * Impure Shell for Driver Matching
 * 
 * This function orchestrates the I/O (fetching from DB, getting current config)
 * and then delegates to the pure core for actual business logic.
 * It is inherently impure because it relies on the database state and time/randomness.
 */
export async function findBestDrivers(userLat: number, userLng: number, limit: number = 3): Promise<DriverCandidate[]> {
  // --- IMPURE: I/O (Database read) ---
  const driversFromDb = await Driver.find({ kycStatus: 'approved', isActive: true });

  // Map DB models to our pure DriverCandidate interface
  const candidates: DriverCandidate[] = driversFromDb.map(d => {
    // Basic euclidean distance placeholder, normally use Haversine or similar
    const dist = Math.sqrt(
      Math.pow(((d.location?.coordinates && d.location.coordinates[1]) || userLat) - userLat, 2) + 
      Math.pow(((d.location?.coordinates && d.location.coordinates[0]) || userLng) - userLng, 2)
    ) * 111; // roughly km
    
    return {
      driverId: d._id.toString(),
      distanceKm: isNaN(dist) ? 10 : dist, // default 10km if missing location
      rating: d.averageRating || 4.0,
      // Just mock placeholders for these since they might not be in the current schema
      acceptRatePercent: (d as any).acceptRatePercent || 80,
      idleMinutes: (d as any).idleMinutes || 15
    };
  });

  // --- IMPURE: Fetching config/weights (e.g., from DB, env, or Redis) ---
  // Mocking config fetch here
  const currentWeights: ScoreWeights = {
    distanceWeight: 2,
    ratingWeight: 10,
    acceptRateWeight: 0.5,
    idleWeight: 1
  };

  // --- PURE: Business logic execution ---
  // No I/O, no DB reads, no Date.now() in here.
  const ranked = rankDrivers(candidates, currentWeights);

  // --- IMPURE: I/O (Database write or return to caller) ---
  const topMatches = ranked.slice(0, limit);
  // (Optional: save match event to DB here)

  return topMatches;
}
