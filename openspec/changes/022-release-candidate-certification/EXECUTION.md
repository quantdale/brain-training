# Execution Entry — Campaign 022 Release-Candidate Certification

**Status:** ACTIVE
**Change:** `022-release-candidate-certification`
**Baseline:** `76a58dccf819c57364d5531c2ca4c2bc3c375e46` (head declaring 021 VALIDATED with all four workflows green)
**Target branch:** `main`
**Predecessor:** `021-release-gate-reconvergence` (VALIDATED)

## Mission

Move the repository from "repository-owned automation complete" to the
strongest defensible release candidate: disposition release-relevant tracked
debt with adversarial proof; build, inspect, and standalone-run a clean
Android release artifact; execute broad runtime certification (games, Workout
V3, lifecycle/process death, real SQLite, backup/restore, offline,
accessibility, SAF, physical device, performance); classify every platform
evidence domain honestly; re-prove the full automated matrix and all four
workflows at the exact final SHA; and issue an evidence-backed
GO / CONDITIONAL GO / NO-GO verdict.

## Execution order

1. Debt triage (priority: `xp_awards` idempotency) — fix or prove-safe.
2. Clean release artifact build + inspection.
3. Standalone artifact runtime on `braintraining-qa36` + broad game
   certification.
4. Workout V3 + lifecycle torture + DB soak + backup/restore certification.
5. Platform evidence (accessibility, SAF, physical device, perf, offline,
   security, iOS per host capability).
6. Full regression matrix + current-head CI at final SHA.
7. Release-readiness matrix, verdict, durable-state truth repair, closure.

## Scope guard

No game #43+, new systems, cloud/auth/monetization/AI/social/notifications,
architecture or database replacement, unrelated dependency upgrades, or
speculative cleanups. Validators, tests, and gates may be strengthened, never
weakened. Generated native directories follow repository gitignore policy.

## Stop conditions

Stop for a user decision only on a proven external blocker (credentials,
absent platform hardware, irreversible publication). Never convert
unavailable evidence into PASS. Physical-device/iOS/macOS absence must not
stall executable Android certification work.
