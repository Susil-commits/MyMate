# Haskell Driver Scoring Proof of Concept

This directory contains a standalone Haskell proof of concept (`Main.hs`) demonstrating the pure-functional rewrite of the driver-matching scoring logic.

## Why Pure Functions Matter for Testability

In functional programming, a **pure function** is a function that given the same input, will always return the same output, and does not produce any side effects (no mutation, no database reads, no random numbers or timestamps). 

By extracting the driver scoring logic into pure functions (`scoreDriver` and `rankDrivers`), we gain massive testability benefits:
1. **No Mocking Required:** We don't need to mock databases, Redis, or external services just to test our core business logic. We simply pass a `DriverCandidate` and a `ScoreWeights` record.
2. **Determinism:** Tests never flake because of network issues or timing differences.
3. **Property-Based Testing:** Pure functions make it trivial to assert mathematical properties, such as monotonicity (e.g., "if distance increases, the score must monotonically decrease").

## Mapping to EulerHS & Free Monads

This exact pattern—separating the pure business logic from the impure I/O—is the foundational concept behind libraries like **EulerHS** and **Presto** (built heavily upon Free Monads). In those systems, business logic is written in a pure, declarative way using a Free Monad language. The business logic itself only describes *what* I/O should happen (e.g., "Fetch the Driver from DB"), but does not execute it. 

An "interpreter" at the edge of the system (the impure shell) evaluates this pure description and actually performs the I/O. This pushes all side-effects (database access, API calls) to the absolute edges of the application, keeping the core domain logic entirely pure, instantly testable without I/O, and profoundly easier to reason about. This exercise mirrors that philosophy by keeping our `DriverCandidate` scoring 100% pure while reserving a separate "shell" function for fetching weights and drivers from the database.

## Running the PoC

If you have GHC installed, simply run:
```bash
runghc Main.hs
```
This will compile and execute the test assertions. Since Haskell enforces immutability and purity at the type level, the compiler guarantees that `scoreDriver` and `rankDrivers` cannot perform I/O or mutate lists.
