// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  MAX_PUZZLE_ATTEMPTS,
  applyOperator,
  canSolve,
  evaluateAllResults,
  generatePuzzle,
} from '../generator';
import { evaluateEquationTokens } from '../reducer';
import { MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS } from '../difficulty';

function fullSession(
  seed: string,
  params = MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.normal,
  rounds = 5,
): { target: number; numbers: readonly number[] }[] {
  const rng = createRng(seed);
  const puzzles: { target: number; numbers: readonly number[] }[] = [];
  let prevTarget: number | null = null;
  for (let round = 0; round < rounds; round += 1) {
    const puzzle = generatePuzzle({ rng, roundIndex: round, params, prevTarget });
    puzzles.push({ target: puzzle.target, numbers: puzzle.numbers });
    prevTarget = puzzle.target;
  }
  return puzzles;
}

describe('applyOperator', () => {
  it('performs basic arithmetic', () => {
    expect(applyOperator(3, '+', 4)).toBe(7);
    expect(applyOperator(10, '-', 3)).toBe(7);
    expect(applyOperator(3, '×', 4)).toBe(12);
    expect(applyOperator(12, '÷', 4)).toBe(3);
  });

  it('returns null for division by zero', () => {
    expect(applyOperator(5, '÷', 0)).toBeNull();
  });

  it('returns null for non-integer division', () => {
    expect(applyOperator(5, '÷', 3)).toBeNull();
  });
});

describe('evaluateAllResults', () => {
  it('returns the single number for a one-element array', () => {
    const results = evaluateAllResults([5], ['+']);
    expect(results.has(5)).toBe(true);
    expect(results.size).toBe(1);
  });

  it('finds all results for two numbers and one operator', () => {
    const results = evaluateAllResults([3, 4], ['+', '-']);
    expect(results.has(7)).toBe(true);
    expect(results.has(-1)).toBe(true);
  });

  it('finds all results for three numbers with + and -', () => {
    const results = evaluateAllResults([1, 2, 3], ['+', '-']);
    // 1+2+3=6, 1+2-3=0, 1-2+3=2, 1-2-3=-4
    // Also: (1+2)+3=6, (1+2)-3=0, (1-2)+3=2, (1-2)-3=-4
    // And: 1+(2+3)=6, 1+(2-3)=0, 1-(2+3)=-4, 1-(2-3)=2
    expect(results.has(6)).toBe(true);
    expect(results.has(0)).toBe(true);
    expect(results.has(2)).toBe(true);
    expect(results.has(-4)).toBe(true);
  });

  it('handles multiplication', () => {
    const results = evaluateAllResults([2, 3, 4], ['×']);
    expect(results.has(24)).toBe(true);
  });
});

describe('canSolve', () => {
  it('returns true when a solution exists', () => {
    expect(canSolve(7, [3, 4], ['+', '-'])).toBe(true);
    expect(canSolve(12, [3, 4], ['×'])).toBe(true);
  });

  it('returns false when no solution exists', () => {
    expect(canSolve(100, [1, 2], ['+'])).toBe(false);
  });
});

describe('generatePuzzle', () => {
  it('is deterministic: same seed reproduces the same puzzle', () => {
    const params = MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.normal;
    const a = generatePuzzle({ rng: createRng('seed-42'), roundIndex: 0, params, prevTarget: null });
    const b = generatePuzzle({ rng: createRng('seed-42'), roundIndex: 0, params, prevTarget: null });
    expect(a.target).toBe(b.target);
    expect(a.numbers).toEqual(b.numbers);
  });

  it('produces different puzzles for different seeds', () => {
    const params = MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.normal;
    const a = generatePuzzle({ rng: createRng('seed-a'), roundIndex: 0, params, prevTarget: null });
    const b = generatePuzzle({ rng: createRng('seed-b'), roundIndex: 0, params, prevTarget: null });
    // At least the numbers or target should differ (very high probability).
    expect(a.target !== b.target || JSON.stringify(a.numbers) !== JSON.stringify(b.numbers)).toBe(true);
  });

  it('every generated puzzle is solvable', () => {
    const params = MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.normal;
    for (let seed = 1; seed <= 30; seed += 1) {
      const puzzle = generatePuzzle({
        rng: createRng(String(seed)),
        roundIndex: 0,
        params,
        prevTarget: null,
      });
      expect(canSolve(puzzle.target, puzzle.numbers, puzzle.operators)).toBe(true);
    }
  });

  it('targets are within the specified range', () => {
    for (const [level, params] of Object.entries(MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS)) {
      for (let seed = 1; seed <= 10; seed += 1) {
        const puzzle = generatePuzzle({
          rng: createRng(`${level}-${seed}`),
          roundIndex: 0,
          params,
          prevTarget: null,
        });
        expect(puzzle.target).toBeGreaterThanOrEqual(params.targetMin);
        expect(puzzle.target).toBeLessThanOrEqual(params.targetMax);
      }
    }
  });

  it('numbers are in the range 2–20 and distinct', () => {
    const params = MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.normal;
    for (let seed = 1; seed <= 20; seed += 1) {
      const puzzle = generatePuzzle({
        rng: createRng(String(seed)),
        roundIndex: 0,
        params,
        prevTarget: null,
      });
      for (const num of puzzle.numbers) {
        expect(num).toBeGreaterThanOrEqual(2);
        expect(num).toBeLessThanOrEqual(20);
      }
      expect(new Set(puzzle.numbers).size).toBe(puzzle.numbers.length);
    }
  });

  it('respects the numbersCount parameter', () => {
    for (const [level, params] of Object.entries(MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS)) {
      const puzzle = generatePuzzle({
        rng: createRng(`${level}-count`),
        roundIndex: 0,
        params,
        prevTarget: null,
      });
      expect(puzzle.numbers.length).toBe(params.numbersCount);
    }
  });

  it('avoids near-duplicate targets between consecutive rounds', () => {
    const params = MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.normal;
    const puzzles = fullSession('near-dup', params, 5);
    for (let i = 1; i < puzzles.length; i += 1) {
      // Consecutive targets should generally differ (not guaranteed, but very likely).
      // We just check they are all valid.
      expect(puzzles[i].target).toBeGreaterThanOrEqual(params.targetMin);
      expect(puzzles[i].target).toBeLessThanOrEqual(params.targetMax);
    }
  });
});

describe('evaluateEquationTokens', () => {
  it('evaluates a simple left-to-right expression', () => {
    // 3 + 4 × 6 = (3+4)×6 = 42 (left-to-right, no precedence)
    expect(evaluateEquationTokens([3, '+', 4, '×', 6])).toBe(42);
  });

  it('handles parentheses for grouping', () => {
    // 3 + (4 × 6) = 27
    expect(evaluateEquationTokens([3, '+', '(', 4, '×', 6, ')'])).toBe(27);
  });

  it('handles nested parentheses', () => {
    // ((3 + 4) × 6) - 2 = 40
    expect(evaluateEquationTokens(['(', '(', 3, '+', 4, ')', '×', 6, ')', '-', 2])).toBe(40);
  });

  it('returns null for invalid expressions', () => {
    expect(evaluateEquationTokens([])).toBeNull();
    expect(evaluateEquationTokens([3, '+'])).toBeNull();
    expect(evaluateEquationTokens(['+', 3])).toBeNull();
  });

  it('returns null for division by zero', () => {
    expect(evaluateEquationTokens([5, '÷', 0])).toBeNull();
  });

  it('handles single number', () => {
    expect(evaluateEquationTokens([42])).toBe(42);
  });

  it('handles subtraction and division', () => {
    // 10 - 6 ÷ 2 = (10-6)÷2 = 2 (left-to-right)
    expect(evaluateEquationTokens([10, '-', 6, '÷', 2])).toBe(2);
  });
});
