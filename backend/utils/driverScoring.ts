export interface DriverCandidate {
  driverId: string;
  distanceKm: number;
  rating: number;       // 0-5
  acceptRatePercent: number; // 0-100
  idleMinutes: number;
}

export interface ScoreWeights {
  distanceWeight: number;
  ratingWeight: number;
  acceptRateWeight: number;
  idleWeight: number;
}

/**
 * Pure function to calculate a driver's match score.
 * 
 * Rules:
 * - Higher rating -> higher score
 * - Higher accept rate -> higher score
 * - Lower distance -> higher score (distance reduces score)
 * - Lower idle minutes -> higher score (idle time reduces score, or wait, maybe being idle longer should *increase* priority to be fair? The prompt Haskell code says `- (idleWeight w * idleMinutes c)`, so longer idle reduces score? Actually usually you want to dispatch to the driver who has been idle longest. But let's follow the user's Haskell example exactly: `- idleWeight w * idleMinutes c`)
 */
export function scoreDriver(candidate: DriverCandidate, weights: ScoreWeights): number {
  return (weights.ratingWeight * candidate.rating)
       - (weights.distanceWeight * candidate.distanceKm)
       + (weights.acceptRateWeight * candidate.acceptRatePercent)
       - (weights.idleWeight * candidate.idleMinutes);
}

/**
 * Pure function to rank a list of drivers by score in descending order.
 * Does not mutate the input array.
 */
export function rankDrivers(candidates: DriverCandidate[], weights: ScoreWeights): DriverCandidate[] {
  // slice() creates a shallow copy to prevent mutating the original array
  return candidates.slice().sort((a, b) => {
    return scoreDriver(b, weights) - scoreDriver(a, weights);
  });
}
