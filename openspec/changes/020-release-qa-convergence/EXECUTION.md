# Execution Entry — Campaign 020 Release-QA Convergence

**Status:** ACTIVE
**Change:** `020-release-qa-convergence`
**Baseline:** `27c9174` plus validated Campaigns 017–019
**Target branch:** `main`
**Predecessor:** `019-game-lifecycle-resilience` (VALIDATED)

## Mission

Converge the release-QA, source-identity, security, dependency, and final
whole-codebase hardening signals into an exact, reproducible evidence set.

## Execution order

1. Reconcile the campaign state and audit all release certification scripts.
2. Verify/fix certification, source identity, artifact, and secret boundaries.
3. Run the final whole-codebase static, test, build, and dependency matrix.
4. Classify unavailable Android/manual evidence honestly, update all durable
   records, and close 020 before the final owner-requested second hardening
   report.

## Scope guard

No game #43, product feature expansion, cloud/auth/AI/monetization/social
system, signing, store publication, or unsafe dependency churn is in scope.
