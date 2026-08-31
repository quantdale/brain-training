# Execution Prompt — Campaign 018: Engagement Temporal Integrity

**Status:** ACTIVE
**Change:** `018-engagement-temporal-integrity`
**Start-SHA:** `27c9174` (owner-authorized sequence baseline)
**Planned-At:** 2026-08-30
**Target-Branch:** `main`
**Predecessor:** `017-persistence-boundary-hardening` (VALIDATED)

## Objective

Close the remaining engagement-layer integrity gaps: strict quest/streak input
boundaries, canonical calendar coverage, time-safe reward claims, and bounded
progression reconciliation across rollover and catalog drift.

## Required order

1. Reconcile repository and campaign state.
2. Implement and test quest/streak boundary validation.
3. Exercise all reward/inbox and progression reconciliation paths.
4. Run the complete static/test matrix and classify platform/manual limits.
5. Update durable state, commit and push a coherent 018 closure, then activate
   019 atomically.

## Stop conditions

Do not claim success for unavailable Android/manual/iOS UX checks. Stop for a
real blocker only after safe local alternatives are exhausted and the blocker
has been recorded durably. Do not add games or deferred systems.
