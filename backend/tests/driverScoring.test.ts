import { DriverCandidate, ScoreWeights, scoreDriver, rankDrivers } from '../utils/driverScoring';

describe('driverScoring Pure Functions', () => {
  const defaultWeights: ScoreWeights = {
    distanceWeight: 2,
    ratingWeight: 10,
    acceptRateWeight: 0.5,
    idleWeight: 1
  };

  const c1: DriverCandidate = {
    driverId: 'd1',
    distanceKm: 5,
    rating: 4.8,
    acceptRatePercent: 90,
    idleMinutes: 10
  };

  const c2: DriverCandidate = {
    driverId: 'd2',
    distanceKm: 2,
    rating: 4.5,
    acceptRatePercent: 85,
    idleMinutes: 5
  };

  describe('scoreDriver', () => {
    it('is pure: called twice with identical inputs yields identical output', () => {
      const score1 = scoreDriver(c1, defaultWeights);
      const score2 = scoreDriver(c1, defaultWeights);
      expect(score1).toEqual(score2);
    });

    it('monotonicity: increasing distanceKm while holding everything else constant never increases the score', () => {
      const baseScore = scoreDriver(c1, defaultWeights);
      
      const furtherCandidate = { ...c1, distanceKm: c1.distanceKm + 5 };
      const furtherScore = scoreDriver(furtherCandidate, defaultWeights);
      
      expect(furtherScore).toBeLessThan(baseScore);
    });

    it('snapshot regression test for known input/output pairs', () => {
      // (10 * 4.8) - (2 * 5) + (0.5 * 90) - (1 * 10) = 48 - 10 + 45 - 10 = 73
      expect(scoreDriver(c1, defaultWeights)).toBe(73);

      // (10 * 4.5) - (2 * 2) + (0.5 * 85) - (1 * 5) = 45 - 4 + 42.5 - 5 = 78.5
      expect(scoreDriver(c2, defaultWeights)).toBe(78.5);
    });
  });

  describe('rankDrivers', () => {
    it('does not mutate the input array', () => {
      const candidates = [c1, c2];
      const snapshot = JSON.stringify(candidates);
      
      const ranked = rankDrivers(candidates, defaultWeights);
      
      // Original array remains exactly the same reference
      expect(JSON.stringify(candidates)).toEqual(snapshot);
      // c2 has higher score (78.5) than c1 (73)
      expect(ranked[0].driverId).toBe('d2');
      expect(ranked[1].driverId).toBe('d1');
    });
  });
});
