# Execution Prompt — Campaign 020: Release-QA Convergence

**Status:** VALIDATED — terminal closure
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
   record the owner-requested second whole-codebase hardening report.

## Final classification

Campaign 020 is terminally `VALIDATED`. Repository-owned automated hardening
is complete. Android runtime, manual accessibility/system sheets,
physical-device, and manual iOS UX remain `BLOCKED` / `NOT VALIDATED` under the
documented external constraints.

## Stop conditions

Do not claim success for unavailable Android/manual/iOS UX checks. Stop for a
real blocker only after safe local alternatives are exhausted and the blocker
has been recorded durably. Do not add games or deferred systems.
