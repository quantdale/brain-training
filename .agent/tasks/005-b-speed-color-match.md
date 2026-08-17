# Packet 005-b: Speed — Color Match

**Game ID:** `speed-color-match`
**Primary Category:** `Speed`
**Write surface:** `apps/mobile/src/games/speed-color-match/` (own dir only)
**No commits. No touches to other dirs.**

## Mechanic

A color swatch is displayed along with a color name (e.g. a blue swatch with
the word "RED" in green text). The player must tap the button matching the
SWATCH color (not the text color) as fast as possible. Each trial shows a
new swatch+label pair. Some trials are congruent (swatch matches label),
others are incongruent (Stroop-like interference). The game measures
reaction time and accuracy across many rapid-fire trials.

This is distinct from the existing Reaction Time (simple stimulus detection)
and Tap Rush (rapid spatial targeting). Color Match is a speeded
categorization task with cognitive interference.

## Difficulty Tiers

| Level | Trials | Incongruent % | Time Budget | Stimulus Timeout |
|-------|--------|---------------|-------------|------------------|
| Easy | 15 | 20% | 45s | 5000ms |
| Normal | 20 | 40% | 40s | 4000ms |
| Hard | 25 | 60% | 35s | 3000ms |
| Expert | 30 | 80% | 30s | 2500ms |
| Adaptive | 20 | 40%±adaptive | 40s | 4000ms |

## Generator Invariants

- Same seed → same trial sequence (deterministic).
- Congruent trials: swatch color = label color.
- Incongruent trials: swatch color ≠ label color.
- No more than 3 consecutive incongruent trials.
- Color palette: 6 distinct hues (red, blue, green, yellow, purple, orange).

## Scoring

- 100 points per correct trial + speed bonus (up to +50 for fast responses).
- Bonus for streaks of correct consecutive trials (+10 per streak step).
- Normalization: `accuracy × (0.4 + 0.3 × speedFactor + 0.3 × streakBonus)`.

## Session Rules

- Time-based session with per-trial stimulus timeout.
- Wrong answer or timeout = trial failed, streak resets, next trial.
- Pause freezes trial timer; resume continues.
- Auto-pause on backgrounding.

## QA Hooks

- `qa/force-win`: all trials correct instantly.
- `qa/force-lose`: current trial failed, session ends.
- `qa/force-state`: inject seed + difficulty (intro only).
- All gated behind `assertDevOnly()` + `isDevBuild()`.

## Test Requirements

Mirror `apps/mobile/src/games/memory/` structure:
- `__tests__/generator.test.ts` — determinism, congruency ratios, no long streaks
- `__tests__/difficulty.test.ts` — tier params, adaptive ratio
- `__tests__/scoring.test.ts` — normalization formula, speed bonus
- `__tests__/reducer.test.ts` — all action types, phase transitions
- `__tests__/session.test.ts` — seed mapping, persistence seam
- `__tests__/hooks.test.ts` — QA dispatch
- `__tests__/screen.test.tsx` — intro, trial, results, QA

Expected: ~7 suites, ~80-90 tests.
