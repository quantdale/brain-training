# Execution Entry — Campaign 018 Engagement Temporal Integrity

**Status:** ACTIVE
**Change:** `018-engagement-temporal-integrity`
**Baseline:** `27c9174` plus validated Campaign 017 hardening
**Target branch:** `main`
**Predecessor:** `017-persistence-boundary-hardening` (VALIDATED)

## Mission

Make quests, streak protection, rewards, and progression projections resistant
to malformed inputs, impossible dates, future-dated events, rollover races, and
catalog drift while preserving the existing offline-first product behavior.

## Execution order

1. Audit and validate quest/streak input boundaries.
2. Extend the as-of claim contract and reconcile engagement projections.
3. Run focused real-DB adversarial tests.
4. Run the complete static/test gate, update durable evidence, and activate 019
   only after 018 is machine-consistently validated.

## Scope guard

No game #43, new feature family, cloud/auth/AI/monetization/social system,
signing, store publication, or unrelated dependency churn is in scope.
