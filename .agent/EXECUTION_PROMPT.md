# Execution Prompt — Campaign 025: Game Board Feedback Consistency

**Status:** VALIDATED
**Change:** `025-game-board-feedback-consistency`
**Start-SHA:** `2a1ba4e`
**Closure-SHA:** `fe80a2c`
**Planned-At:** 2026-09-11
**Target-Branch:** `main`
**Predecessor:** `024-frontend-ux-modernization` (VALIDATED)

## Archived execution prompt — DO NOT RESTART

The objective was to finish what Campaign 024 started: map the 31 remaining
game boards onto the shared verdict language, wire real round progress into
the shared HUD where a game knows its round count, and change no mechanics.

That objective was completed. All 42 boards share the verdict language; 41 of
42 games report `roundProgress` (the one omission is a time-boxed score attack
with no total in state, documented in `tasks.md`). Evidence lives in
`.agent/VALIDATION.md` (Campaign 025 section), `change.json`
`validationNote`, `tasks.md`, and
`qa-artifacts/campaign025/{boards-before,boards-after,after-dev}/**`.

A fresh agent must not execute this prompt. Read `.agent/GOVERNANCE.json` and
`.agent/STATE.md`; with `activeCampaign` null, a successor campaign requires
explicit owner authorization or a planning pass — the owner's recorded
redesign directive is activated as its own Campaign 026.
