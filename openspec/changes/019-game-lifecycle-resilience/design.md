# Design — Campaign 019 Game Lifecycle Resilience

## Shared contracts

- `useGameSession` owns session identity and exactly-once finalization; async
  persistence callbacks must prove they still belong to the active session.
- Pause-aware timers cancel while paused and deadline timers preserve remaining
  active budget using the injected monotonic clock.
- Workout provenance is the immutable `(instanceKey, legIndex, gameId)` tuple;
  malformed route/result values become standalone sessions and cannot claim a
  workout leg.
- Reconciliation is a pure, deterministic repair of persisted game lists and
  indices; invalid/non-finite state never becomes a navigable resume position.

## Verification

Use shared-hook tests with fake clocks and fake timers, real workout repository
tests for persisted ownership/idempotency, and a source-level catalog test for
all 42 screens. Android canaries/certification are a separate evidence layer;
if the dedicated AVD remains unavailable they stay BLOCKED/NOT VALIDATED.
