# Durable Project State

**Last update:** 2026-09-13 — Campaign 026 closed VALIDATED (visual identity rebuild, "Neon Arcade").
**Canonical branch:** `main`
**Active campaign:** none
**Last campaign:** `026-visual-identity-rebuild`
**Last campaign status:** VALIDATED

## Current status

Campaign 026 replaced the visual/interaction identity itself: a new
design-language-v3 token system (warm-paper light / deep-plum ink dark,
vermillion primary, volt/violet reward tones, eight vivid domain identities,
heavier display type, tactile button lip), a rebuilt UI kit (`Spark`,
`Confetti`, `StreakStrip` identity primitives), recomposed shell routes and
restyled game chrome — while gameplay, scoring, generators, persistence and
every testID stayed untouched. Its closure SHA is `3f01a01` (plus this closure
docs commit).

## Terminal evidence summary (Campaign 026, closure SHA `3f01a01`)

- Matrix at closure: **Jest 536 suites / 6412 tests PASS** (4 suites / 5 tests
  allowlisted skips), `tsc --noEmit` clean, `expo lint` clean, all repository
  validators PASS (repo-state, task-ownership, registry, provenance, offline
  968 files CLEAN, secrets 1978 files CLEAN, OpenSpec 13/13).
- Runtime: autobot canaries **8/8 PASS**; daily-workout journey **PASS** (4/4 +
  relaunch shows persisted completion); a11y audit **0 violations across 22
  surfaces** in both themes.
- Native evidence: `qa-artifacts/campaign026/after/**` (22 frames, 11 surfaces
  × light/dark) against `qa-artifacts/campaign026/before/**` (six frames
  regenerated from `6f420cc` into `before-recovery/**` and merged into the
  baseline manifest).
- Release artifact rebuilt from the campaign head: 109,496,133 bytes, SHA-256
  `2E89B783495EFE66D1EAD57FCBE487AF60A79E245C22A69558A6027B94D36EC4`.
- QA tooling hardening shipped with the campaign: `ui-capture.mjs` waits for a
  visible warm frame, detects uniform/black frames and retries per surface;
  `a11y-audit.mjs` classifies viewport-clipped nodes as `clipped` instead of
  miscounting them as undersized targets.
- The emulator app-surface wedge (black frames after hours of restarts) was
  root-caused to the environment and cleared by an emulator cold restart;
  recorded in `.agent/KNOWN_ISSUES.md` and `VALIDATION.md`.

## Continuation rule

There is **no active campaign**. A successor campaign requires an explicit
owner directive or a separately justified planning pass against current
repository evidence. Owner acceptance of Campaign 026 is the before/after
capture sets under `qa-artifacts/campaign026/`.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `.agent/VALIDATION.md` and `.agent/KNOWN_ISSUES.md`
7. `openspec/changes/026-visual-identity-rebuild/` (proposal → design → specs →
   tasks → EXECUTION.md) and `docs/DESIGN_SYSTEM.md`
