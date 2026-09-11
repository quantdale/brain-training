# Durable Project State

**Last update:** 2026-09-12 — Campaign 025 closed VALIDATED (game board feedback consistency).
**Canonical branch:** `main`
**Active campaign:** `026-visual-identity-rebuild`
**Last campaign:** `025-game-board-feedback-consistency`
**Last campaign status:** VALIDATED

## Current status

Campaign 025 closed its mission: all 42 game boards now share one verdict
language, every finite-round session reports HUD progress, and the wave stayed
presentation-only (no mechanics, scoring, generator, persistence or testID
changes). Campaign 024 (the shell/kit/design-language rebuild) is its
VALIDATED predecessor and remains terminal.

## Terminal evidence summary (Campaign 025, closure SHA `fe80a2c`)

- 31 remaining boards adopted fill + verdict border + ✓/✕/⏱ badge + verdict in
  the accessible name, with reducer-authoritative feedback, the prompt mounted
  through feedback, animated score read-outs and 44 dp floors.
- HUD `roundProgress` wired in 41 of 42 games; `memory-sequence-memory` is a
  time-boxed score attack with no total in state and correctly keeps the round
  chip (HUD R2).
- Matrix at closure: **Jest 535 suites / 6409 tests PASS** (5 allowlisted
  skips), `tsc --noEmit` clean, `expo lint` clean, all repository validators
  PASS (repo-state, task-ownership, provenance, offline 965 files CLEAN,
  secrets 1938 files CLEAN, registry `--check` up to date).
- Runtime: autobot canaries **8/8 PASS** on a debug build at the closure SHA
  (the first attempt ran against a release APK whose QA controls are disabled
  by design and was correctly classified as an APK-class mismatch), plus
  native before/after board pairs in
  `qa-artifacts/campaign025/boards-{before,after}/**`.
- Still **NOT VALIDATED** for this campaign: the daily-workout journey on this
  SHA and a release artifact built from this SHA.
- The wave repaired four mid-edit breakages left by an interrupted worker and
  a botched style object in `spatial-mental-rotation`; every repair is
  behaviour-preserving and covered by the game suites.

## Continuation rule

There is **no active campaign**. A successor campaign requires an explicit
owner directive or a separately justified planning pass against current
repository evidence. The owner's recorded redesign directive (drastic frontend
visual rebuild, Refero-researched, native before/after evidence) is the
candidate successor and is activated as its own campaign rather than folded
into Campaign 025.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `.agent/VALIDATION.md` and `.agent/KNOWN_ISSUES.md`
7. `openspec/changes/025-game-board-feedback-consistency/` (proposal → design →
   specs → tasks) and `docs/DESIGN_SYSTEM.md`
