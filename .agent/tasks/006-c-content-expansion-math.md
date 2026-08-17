# Packet 006-c: Content Pack Expansion — Math Games

**Write surface:** `apps/mobile/src/games/math-equation-builder/` (equation templates), `apps/mobile/src/games/math-missing-operator/` (equation templates), `apps/mobile/src/games/math-fast-math/` (problem templates)
**No commits. No touches to other dirs.**

## Objective

Expand content packs for all 3 Math games to increase variety.

## Tasks

### 1. Equation Builder — Add More Puzzle Templates

Edit `apps/mobile/src/games/math-equation-builder/generator.ts`:
- Add 20 new number sets that are guaranteed solvable (verify with the brute-force solver).
- Each set: array of 3-5 numbers (range 2-20) + target number.
- Ensure no duplicate targets in consecutive puzzles.
- Add a `PUZZLE_TEMPLATES` constant with the new templates.

### 2. Missing Operator — Add More Equation Templates

Edit `apps/mobile/src/games/math-missing-operator/generator.ts`:
- Add 20 new equation templates (numbers + operators + result).
- Each template: `{ numbers: number[], operators: string[], result: number }`.
- Ensure unique solutions (only one operator combination works).
- Follow existing format and validation.

### 3. Fast Math — Add More Problem Templates

Edit `apps/mobile/src/games/math-fast-math/generator.ts`:
- Add 20 new problem templates (operands + operator + result).
- Each template: `{ a: number, b: number, operator: string, result: number }`.
- Cover all difficulty levels (easy: +, normal: +-, hard: +-, expert: +-×÷).
- Ensure no division by zero and integer results.

## Validation

From `apps/mobile`:
1. `npx jest src/games/math-equation-builder` — must pass.
2. `npx jest src/games/math-missing-operator` — must pass.
3. `npx jest src/games/math-fast-math` — must pass.
4. `npx tsc --noEmit` — must be clean.

## Notes

- All new templates must be verified by the existing generator tests.
- Maintain deterministic generation (same seed → same puzzles).
- Avoid trivial puzzles (e.g., 1+1=2) at higher difficulty levels.
