module Main where

import Data.List (sortBy)
import Data.Ord (comparing)
import Control.Exception (assert)
import System.Exit (exitSuccess)

data DriverCandidate = DriverCandidate
  { driverId          :: String
  , distanceKm        :: Double
  , rating            :: Double
  , acceptRatePercent :: Double
  , idleMinutes       :: Double
  } deriving (Show, Eq)

data ScoreWeights = ScoreWeights
  { distanceWeight   :: Double
  , ratingWeight     :: Double
  , acceptRateWeight :: Double
  , idleWeight       :: Double
  } deriving (Show, Eq)

-- | Pure scoring function
-- Fleet fairness model: drivers waiting longer receive higher dispatch priority
-- to prevent driver starvation and distribute trip earnings equitably.
scoreDriver :: ScoreWeights -> DriverCandidate -> Double
scoreDriver w c = (ratingWeight w * rating c)
                - (distanceWeight w * distanceKm c)
                + (acceptRateWeight w * acceptRatePercent c)
                + (idleWeight w * idleMinutes c)

-- | Pure sorting function
rankDrivers :: ScoreWeights -> [DriverCandidate] -> [DriverCandidate]
rankDrivers w = sortBy (comparing (negate . scoreDriver w))

-- | Tests mirroring the TS tests
main :: IO ()
main = do
  putStrLn "Running Haskell DriverScoring Tests..."
  
  let defaultWeights = ScoreWeights
        { distanceWeight   = 2.0
        , ratingWeight     = 10.0
        , acceptRateWeight = 0.5
        , idleWeight       = 1.0
        }
      
      c1 = DriverCandidate
        { driverId          = "d1"
        , distanceKm        = 5.0
        , rating            = 4.8
        , acceptRatePercent = 90.0
        , idleMinutes       = 10.0
        }
      
      c2 = DriverCandidate
        { driverId          = "d2"
        , distanceKm        = 2.0
        , rating            = 4.5
        , acceptRatePercent = 85.0
        , idleMinutes       = 5.0
        }

  putStrLn "- Test: scoreDriver is pure (called twice, identical output)"
  let s1 = scoreDriver defaultWeights c1
      s2 = scoreDriver defaultWeights c1
  assert (s1 == s2) $ return ()

  putStrLn "- Test: Monotonicity (increasing distance reduces score)"
  let furtherCandidate = c1 { distanceKm = distanceKm c1 + 5.0 }
      baseScore = scoreDriver defaultWeights c1
      furtherScore = scoreDriver defaultWeights furtherCandidate
  assert (furtherScore < baseScore) $ return ()

  putStrLn "- Test: Snapshot regression tests"
  assert (scoreDriver defaultWeights c1 == 93.0) $ return ()
  assert (scoreDriver defaultWeights c2 == 88.5) $ return ()

  putStrLn "- Test: rankDrivers orders correctly (and since Haskell data is immutable, it cannot mutate the input)"
  let candidates = [c1, c2]
      ranked = rankDrivers defaultWeights candidates
  assert (driverId (head ranked) == "d1") $ return ()
  assert (driverId (ranked !! 1) == "d2") $ return ()
  -- Proof of non-mutation: `candidates` is still `[c1, c2]`
  assert (driverId (head candidates) == "d1") $ return ()

  putStrLn "All Haskell tests passed successfully!"
  exitSuccess
