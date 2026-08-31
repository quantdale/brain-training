# Execution Prompt — Campaign 019: Game Lifecycle Resilience

**Status:** ACTIVE
**Change:** `019-game-lifecycle-resilience`
**Start-SHA:** `27c9174` (owner-authorized sequence baseline)
**Planned-At:** 2026-08-31
**Target-Branch:** `main`
**Predecessor:** `018-engagement-temporal-integrity` (VALIDATED)

## Objective

Close the shared game/workout lifecycle gaps: stale async callback isolation,
pause/background timing fairness, exact Workout V3 provenance, and robust
catalog reconciliation for all existing 42 games.

## Required order

1. Reconcile repository and campaign state.
2. Audit/fix shared lifecycle, timer, provenance, and reconciliation seams.
3. Run focused lifecycle/workout/catalog tests.
4. Run the complete static/test matrix and classify platform/manual limits.
5. Update durable state, commit and push a coherent 019 closure, then activate
   020 atomically.

## Stop conditions

Do not claim success for unavailable Android/manual/iOS UX checks. Stop for a
real blocker only after safe local alternatives are exhausted and the blocker
has been recorded durably. Do not add games or deferred systems.
