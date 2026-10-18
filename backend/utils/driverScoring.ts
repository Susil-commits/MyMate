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
 * Dispatch Scoring Model:
 * - Higher rating -> higher score (rewards service quality)
 * - Higher accept rate -> higher score (rewards driver responsiveness)
 * - Lower distance -> higher score (minimizes customer pickup wait time)
 * - Higher idle minutes -> higher score (fleet fairness: prioritizes drivers who have
 *   been waiting longest to prevent driver starvation and distribute trip earnings equitably)
 */
export function scoreDriver(candidate: DriverCandidate, weights: ScoreWeights): number {
  return (weights.ratingWeight * candidate.rating)
       - (weights.distanceWeight * candidate.distanceKm)
       + (weights.acceptRateWeight * candidate.acceptRatePercent)
       + (weights.idleWeight * candidate.idleMinutes);
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
