# Packet 005-c: Math — Equation Builder

**Game ID:** `math-equation-builder`
**Primary Category:** `Math`
**Write surface:** `apps/mobile/src/games/math-equation-builder/` (own dir only)
**No commits. No touches to other dirs.**

## Mechanic

A target number is displayed (e.g. 24). A set of available numbers (e.g.
3, 4, 6, 2) is shown. The player must build an equation using ALL the
available numbers and basic operators (+, −, ×, ÷) that evaluates to the
target number. The player taps numbers and operators in sequence to build
the equation. Parentheses are implicit (left-to-right evaluation by
default, with explicit grouping via a "group" button).

This is distinct from the existing Fast Math (mental arithmetic speed drill)
and Missing Operator (find the missing operator in a completed equation).
Equation Builder is a constraint-satisfaction construction task.

## Difficulty Tiers

| Level | Numbers | Target Range | Operators | Rounds | Time Budget |
|-------|---------|--------------|-----------|--------|-------------|
| Easy | 3 | 10–30 | +, − | 4 | 60s |
| Normal | 4 | 10–50 | +, −, × | 5 | 50s |
| Hard | 4 | 20–100 | +, −, ×, ÷ | 6 | 45s |
| Expert | 5 | 50–200 | +, −, ×, ÷ | 7 | 40s |
| Adaptive | 3→5 | 10→200 | +,−→+−×÷ | 5 | 50s |

## Generator Invariants

- Same seed → same (target, numbers) pairs (deterministic).
- Every puzzle has at least one valid solution (verified by a brute-force
  solver during generation; reject and re-draw if no solution found).
- Numbers are small integers (2–20) that can combine to the target.
- No duplicate numbers in the same puzzle (except adaptiveExpert).
- Near-duplicate avoidance: consecutive puzzles have different targets.

## Scoring

- 200 points per solved puzzle + time bonus (up to +100 for fast solves).
- Partial credit: 50 points if the equation is valid but wrong target.
- Normalization: `accuracy × (0.5 + 0.5 × avgTimeBonus)`.

## Session Rules

- Per-puzzle timer (time budget from difficulty).
- Submit equation → evaluate → correct/incorrect → next puzzle.
- Pause freezes puzzle timer; resume continues.
- Auto-pause on backgrounding.

## QA Hooks

- `qa/force-win`: all puzzles solved instantly.
- `qa/force-lose`: current puzzle timeout, session ends.
- `qa/force-state`: inject seed + difficulty (intro only).
- All gated behind `assertDevOnly()` + `isDevBuild()`.

## Test Requirements

Mirror `apps/mobile/src/games/memory/` structure:
- `__tests__/generator.test.ts` — determinism, solvability, target range
- `__tests__/difficulty.test.ts` — tier params, adaptive escalation
- `__tests__/scoring.test.ts` — normalization formula
- `__tests__/reducer.test.ts` — all action types, phase transitions
- `__tests__/session.test.ts` — seed mapping, persistence seam
- `__tests__/hooks.test.ts` — QA dispatch
- `__tests__/screen.test.tsx` — intro, puzzle, results, QA

Expected: ~7 suites, ~85-95 tests.
