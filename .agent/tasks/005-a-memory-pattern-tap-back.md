# Packet 005-a: Memory — Pattern Tap Back

**Game ID:** `memory-pattern-tap-back`
**Primary Category:** `Memory`
**Write surface:** `apps/mobile/src/games/memory-pattern-tap-back/` (own dir only)
**No commits. No touches to other dirs.**

## Mechanic

A grid of tiles is shown. A subset of tiles lights up in a specific sequence
(observation phase). The sequence fades. The player must tap the tiles in the
same order (recall phase). Each round adds one more step to the sequence.
The game ends when the player makes a mistake or completes all rounds.

This is distinct from the existing Memory game (grid-reveal pair matching)
and Sequence Memory (time-bounded Simon-style score attack). Pattern Tap Back
is a sequential recall task with no time pressure during recall — pure
working memory span.

## Difficulty Tiers

| Level | Grid Size | Sequence Start | Sequence Max | Rounds |
|-------|-----------|----------------|--------------|--------|
| Easy | 3×3 | 3 | 6 | 4 |
| Normal | 3×3 | 4 | 8 | 5 |
| Hard | 4×4 | 5 | 10 | 6 |
| Expert | 4×4 | 6 | 12 | 7 |
| Adaptive | 3×3→4×4 | 3→6 | 6→12 | 5 |

## Generator Invariants

- Same seed → same sequence of tile positions (deterministic).
- Each round's sequence is a new random walk on the grid (no immediate
  backtracking, no tile lit twice in the same sequence).
- Grid positions are normalized (0..1) like the memory game.
- Observation duration scales with sequence length (500ms + 200ms × step).

## Scoring

- 100 points per correct round + 10 × sequenceLength bonus.
- Normalization: `roundsCompleted / totalRounds × (0.5 + 0.5 × avgLengthProgress)`.
- No time pressure during recall — pure accuracy scoring.

## Session Rules

- Phases: intro → observe → recall → roundResult → results
- Observation phase: tiles light up in sequence, then fade.
- Recall phase: player taps tiles in order; wrong tap ends the round.
- Pause freezes observation timer; resume continues.
- Auto-pause on backgrounding.

## QA Hooks

- `qa/force-win`: complete all rounds perfectly.
- `qa/force-lose`: fail the current round immediately.
- `qa/force-state`: inject seed + difficulty (intro only).
- All gated behind `assertDevOnly()` + `isDevBuild()`.

## Test Requirements

Mirror `apps/mobile/src/games/memory/` structure:
- `__tests__/generator.test.ts` — determinism, sequence validity, no backtracking
- `__tests__/difficulty.test.ts` — tier params, adaptive escalation
- `__tests__/scoring.test.ts` — normalization formula
- `__tests__/reducer.test.ts` — all action types, phase transitions
- `__tests__/session.test.ts` — seed mapping, persistence seam
- `__tests__/hooks.test.ts` — QA dispatch
- `__tests__/screen.test.tsx` — intro, observe, recall, roundResult, QA

Expected: ~7 suites, ~85-95 tests.
