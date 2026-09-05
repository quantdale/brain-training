# Execution Prompt — Campaign 022: Release-Candidate Certification

**Status:** ACTIVE
**Change:** `022-release-candidate-certification`
**Start-SHA:** `76a58dccf819c57364d5531c2ca4c2bc3c375e46` (head declaring 021 VALIDATED with all four workflows green)
**Planned-At:** 2026-09-05
**Target-Branch:** `main`
**Predecessor:** `021-release-gate-reconvergence` (VALIDATED)

## Objective

Move the repository from repository-owned automation completeness to the
strongest defensible release candidate: debt disposition with adversarial
proof (priority `xp_awards` idempotency), a clean inspected standalone Android
release artifact, broad real-runtime certification (games, Workout V3,
lifecycle torture, real SQLite soak, backup/restore equivalence, offline,
accessibility, SAF, physical device, performance), honest platform-evidence
classification, full automated matrix + all four workflows green at the exact
final SHA, and an evidence-backed GO / CONDITIONAL GO / NO-GO verdict.

## Required order

1. Debt triage: fix or prove-safe each tracked item; no speculative churn.
2. Clean release artifact: install → doctor → prebuild → Gradle → inspection.
3. Standalone runtime on `braintraining-qa36` + broad game certification.
4. Workout V3 + lifecycle torture + DB soak + backup/restore certification.
5. Platform evidence per host capability; never fabricate.
6. Full regression matrix + current-head CI at final SHA.
7. Release-readiness matrix + verdict + durable-state truth repair.

## Stop conditions

Stop for a user decision only on a genuine external blocker (infrastructure,
credentials, absent platform hardware) proven with concrete evidence. Never
convert unavailable evidence into PASS. No games, no deferred systems, no gate
weakening.
