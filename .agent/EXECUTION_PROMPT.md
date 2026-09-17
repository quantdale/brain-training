# Execution Prompt — Campaign 031: Golden-path redesign

**Status:** VALIDATED
**Change:** `031-golden-path-redesign`
**Planned-From:** `44ba1533f4eb5ebcd795723f801633caee914e17`
**Start-SHA:** `44ba1533f4eb5ebcd795723f801633caee914e17`
**Planned-At:** 2026-09-17
**Target-Branch:** `main`
**Predecessor:** `029-artemis-runtime-qa-migration`

## Authority

Read and execute the complete
`.agent/CAMPAIGN031_GOLDEN_PATH_REDESIGN_IMPLEMENTATION_PROMPT.md`. It is the
authoritative product task specification for this campaign. Campaign 030B
real-pixel/runtime evidence is the before baseline. Do not begin Campaign 032.

## Mission

Make the golden path obvious, coherent, focused, trustworthy, and polished:

`Home → Start/Continue → Intro/Tutorial → Gameplay → Result → Next → Workout completion`

Implement structural hierarchy before cosmetic polish. Keep Today/Home's
primary CTA singular; keep the intro concise; keep active play focused; make
Results outcome-first with one primary Next/Finish action; and make completion
explicit and idempotent.

## Protected behavior

Do not change SQLite schema/version semantics, workout instance identity,
selection/generator/scoring versions, provenance, session identity or
exactly-once finalization, pause/background lifecycle, rating/XP/currency and
reward writes, tutorial persistence, registry determinism, offline behavior,
or required semantic IDs. Use the existing durable CAS advance and persistence
seams rather than adding a second transition path.

## Scope exclusions

Games discovery, full catalog redesign, full Progress redesign, Profile,
Rewards architecture, economy, schema migrations without a proven blocker,
dependency maintenance, CI repair, and unrelated technical debt are out of
scope.

## Required validation and handoff

Run the full repository/native matrix from the campaign specification,
including typecheck, lint, focused and full Jest, workout/persistence and
idempotency checks, registry/provenance/offline/security/ownership/OpenSpec
validators, disposable normal Android AVD real-pixel light/dark golden-path
evidence, pause/resume/relaunch/persistence, accessibility, and representative
game-family canaries. Perform independent human validation only when genuinely
available; otherwise create the exact pending handoff without invented
findings. Update all Campaign 031 evidence/state documents, commit and push
`main`, and verify `main == origin/main` with a clean worktree.

Campaign 031 is now terminally validated. The required evidence package and
explicit human/ARTEMIS pending classifications are under
`docs/redesign/evidence/campaign031/`; Campaign 032 was not started.
