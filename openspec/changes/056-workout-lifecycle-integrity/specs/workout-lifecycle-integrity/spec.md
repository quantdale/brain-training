# Spec — workout-lifecycle-integrity

## ADDED Requirements

### Requirement: Reconcile preserves played history and substitutes retired future legs

The system SHALL repair a drifted persisted workout instance by keeping the
played prefix `gameIds[0, currentIndex)` byte-identical (even when a played
game is no longer eligible), filtering only unplayed positions to eligible
games (first-occurrence order, duplicates collapsed), and filling the
remaining slots — up to the stored instance length — with eligible games in
pool order, excluding every id already present in the repaired list.

The substitution MUST be pure and deterministic: the same
`(instance, eligibleIds)` inputs always yield the same repaired instance, so
re-running reconciliation converges instead of churning durable state.

#### Scenario: Retired future leg is substituted, length preserved, no completion

- GIVEN an active instance `gameIds=[a,b,c,d]`, `currentIndex=3`
- WHEN reconciling against eligible `[a,b,c,e]`
- THEN `gameIds=[a,b,c,e]`, `currentIndex=3`, `status=active`, `changed=true`.

#### Scenario: Played history is immutable across retirement

- GIVEN an active instance `gameIds=[a,b,c,d]`, `currentIndex=2` (a, b played)
- WHEN reconciling against eligible `[b,c,d]` (a retired)
- THEN `gameIds=[a,b,c,d]`, `currentIndex=2`, `status=active`, `changed=false`
  (the retired played leg stays; resume still points at c).

#### Scenario: No eligible substitute falls back to honest truncation

- GIVEN an active instance `gameIds=[a,b]`, `currentIndex=1`
- WHEN reconciling against eligible `[a]` (no substitute for b)
- THEN `gameIds=[a]`, `currentIndex=1`, `status=completed`, `changed=true`.

#### Scenario: Completed instances are never resurrected

- GIVEN a `completed` instance with any eligible set
- WHEN reconciling
- THEN `status` remains `completed` and `currentIndex` is clamped into
  `[0, gameIds.length]`.

#### Scenario: Empty repaired list signals regeneration

- GIVEN any instance whose repaired list is empty (e.g. corrupt `[]` row)
- WHEN reconciling
- THEN return `null` with `changed=true` so callers regenerate.

### Requirement: Leg-index envelope matches the longest real workout

The system SHALL accept exactly leg indices `0..5` (longest real workout is
`extended` = 6 games). The bound is derived once as `MAX_WORKOUT_LEG_INDEX`
in `workout/templates`; the route envelope keeps a startup-safe literal and a
contract test asserts equality so the two can never drift. Provenance
validation SHALL enforce the same upper bound and additionally cap
`instanceKey`/`gameId` string lengths.

#### Scenario: Out-of-range leg index rejected at the boundary

- GIVEN a deep link with `workoutIndex=6` (or 31)
- WHEN parsing route params
- THEN the result is `null` (standalone fallback), never a claimed leg.

#### Scenario: Valid legs still parse

- GIVEN indices `0` and `5`
- WHEN parsing
- THEN both are accepted.

### Requirement: No UI-reachable advance without session ownership

The system SHALL NOT expose the unconditional `advance()` primitive through
the `useWorkout` hook return. Leg transitions reachable from UI SHALL go
through `advanceWorkoutForSession` → `advanceForSession` (conditional,
ownership-checked, exactly-once).

#### Scenario: Hook surface has no bypass

- GIVEN the `useWorkout()` return value
- WHEN inspected
- THEN it has no `advance` property (compile-time enforced by removal).

### Requirement: Empty workout rows cannot complete via direct writes

The system SHALL throw (never transition to `completed`) when `advance()` or
`applyReroll()` is called on an instance with an empty `gameIds` list, so a
corrupt row heals through the reconcile → regenerate path instead of being
counted as a completed workout.

#### Scenario: Advance on empty row throws

- GIVEN a persisted instance with `gameIds=[]`
- WHEN calling `advance()`
- THEN it throws and the row is unchanged.

### Requirement: Launch-map recovery contracts hold across restart and retry

The system SHALL re-establish launch ownership when a session begins from
route params after the in-memory map was lost (process restart), SHALL keep
the map entry when the persist transaction fails (so the same completion
retry recovers ownership), and SHALL honor explicit record provenance even
with no map entry.

#### Scenario: Restart re-registration

- GIVEN an empty launch map and valid route-derived provenance
- WHEN `registerWorkoutSessionLaunch` runs at session begin
- THEN `peekWorkoutSessionLaunch` returns the tuple.

#### Scenario: Failed persist keeps the map

- GIVEN a registered launch whose `completeSession` transaction fails
- WHEN the same completion is retried
- THEN ownership decorates the committed row.

## MODIFIED Requirements

### Requirement: Reconcile pure-repair semantics (supersedes truncation)

The previous truncate-and-clamp repair (drop every ineligible id, advance the
index past invalidated games, complete at the shortened end) is REPLACED by
the substitute-and-preserve repair above. Existing tests pinning truncation
MUST be updated; the new behavior is the contract.

#### Scenario: Truncation expectations no longer hold

- GIVEN an active instance `gameIds=[a,b,c,d]`, `currentIndex=1`
- WHEN reconciling against eligible `[a,c,d,e]` (b retired, unplayed, spare e)
- THEN the repaired list has length 4 (`[a,c,d,e]`, a substitute fills b's
  slot) instead of the old truncated length-3 list.
- AND WHEN the eligible pool has no spare (`[a,c,d]`), the repair honestly
  truncates to length 3 (degenerate pool-exhausted fallback, covered by the
  fallback scenario above).

## REMOVED Requirements

None. No product behavior outside workout drift-repair, route bounds, and
the hook surface changes.
