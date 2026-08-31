# Execution Prompt — Campaign 020: Release-QA Convergence

**Status:** ACTIVE
**Change:** `020-release-qa-convergence`
**Start-SHA:** `27c9174` (owner-authorized sequence baseline)
**Planned-At:** 2026-08-31
**Target-Branch:** `main`
**Predecessor:** `019-game-lifecycle-resilience` (VALIDATED)

## Objective

Finish the sequence with fail-closed certification signals, source/build
identity, executable secret scanning, dependency classification, and a final
whole-codebase hardening audit.

## Required order

1. Reconcile repository and campaign state.
2. Verify/fix certification, source identity, artifact, and security gates.
3. Run the final static/test/build/dependency matrix and repair any in-scope
   Critical/High regression.
4. Update durable evidence, commit and push a coherent 020 closure, then
   perform the owner-requested second whole-codebase hardening report.

## Stop conditions

Do not claim success for unavailable Android/manual/iOS UX checks. Stop for a
real blocker only after safe local alternatives are exhausted and the blocker
has been recorded durably. Do not add games or deferred systems.
