// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { ADAPTIVE_PARAMS, LOGIC_DIFFICULTY_PARAMS } from '../difficulty';
import {
  MAX_PUZZLE_ATTEMPTS,
  RECIPE_TIERS,
  buildDistractors,
  describePattern,
  generatePuzzle,
  isNearDuplicatePuzzle,
  solveSequence,
} from '../generator';
import type { LogicPuzzle } from '../types';
import type { DifficultyLevel } from '@/sdk';

function sessionPuzzles(
  seed: string,
  level: Exclude<DifficultyLevel, 'adaptive'>,
): LogicPuzzle[] {
  const params = LOGIC_DIFFICULTY_PARAMS[level];
  const rng = createRng(seed);
  const puzzles: LogicPuzzle[] = [];
  let prev: LogicPuzzle | null = null;
  for (let round = 0; round < params.rounds; round += 1) {
    const puzzle = generatePuzzle({
      rng,
      roundIndex: round,
      tier: params.recipeTier,
      params,
      prevPuzzle: prev,
    });
    puzzles.push(puzzle);
    prev = puzzle;
  }
  return puzzles;
}

describe('solveSequence — family detection', () => {
  it('recognizes arithmetic', () => {
    expect(solveSequence([2, 4, 6, 8])).toEqual({
      family: 'arithmetic',
      next: 10,
      params: { difference: 2 },
    });
    expect(solveSequence([5, 3, 1])).toEqual({
      family: 'arithmetic',
      next: -1,
      params: { difference: -2 },
    });
  });

  it('recognizes geometric with integer ratio ≥ 2', () => {
    expect(solveSequence([3, 6, 12, 24])).toEqual({
      family: 'geometric',
      next: 48,
      params: { ratio: 2 },
    });
    expect(solveSequence([2, 6, 18, 54])).toEqual({
      family: 'geometric',
      next: 162,
      params: { ratio: 3 },
    });
  });

  it('recognizes squares and cubes with offsets', () => {
    expect(solveSequence([4, 9, 16, 25])).toEqual({
      family: 'squares',
      next: 36,
      params: { base: 2, offset: 0 },
    });
    expect(solveSequence([3, 6, 11, 18])).toEqual({
      family: 'squares',
      next: 27,
      params: { base: 1, offset: 2 },
    });
    expect(solveSequence([8, 27, 64, 125])).toEqual({
      family: 'cubes',
      next: 216,
      params: { base: 2, offset: 0 },
    });
  });

  it('recognizes fibonacci-like sequences', () => {
    expect(solveSequence([1, 1, 2, 3, 5])).toEqual({
      family: 'fibonacci',
      next: 8,
      params: { first: 1, second: 1 },
    });
    expect(solveSequence([1, 2, 3, 5, 8])).toEqual({
      family: 'fibonacci',
      next: 13,
      params: { first: 1, second: 2 },
    });
  });

  it('recognizes alternating two-step patterns', () => {
    expect(solveSequence([1, 4, 3, 7, 5])).toEqual({
      family: 'alternating',
      next: 10,
      params: { first: 1, stepA: 2, stepB: 3 },
    });
    expect(solveSequence([2, 5, 4, 9, 6])).toEqual({
      family: 'alternating',
      next: 13,
      params: { first: 2, stepA: 2, stepB: 4 },
    });
  });

  it('recognizes growing-step increments', () => {
    expect(solveSequence([2, 4, 8, 14, 22])).toEqual({
      family: 'increments',
      next: 32,
      params: { first: 2, firstDiff: 2, increment: 2 },
    });
    expect(solveSequence([3, 5, 9, 15])).toEqual({
      family: 'increments',
      next: 23,
      params: { first: 3, firstDiff: 2, increment: 2 },
    });
  });

  it('applies the documented priority order', () => {
    // Fibonacci beats alternating on the classic sequence.
    expect(solveSequence([1, 2, 3, 5])?.family).toBe('fibonacci');
    // Geometric beats increments on powers of two.
    expect(solveSequence([1, 2, 4, 8])).toEqual({
      family: 'geometric',
      next: 16,
      params: { ratio: 2 },
    });
    // Two terms are always arithmetic under the priority.
    expect(solveSequence([1, 2])).toEqual({
      family: 'arithmetic',
      next: 3,
      params: { difference: 1 },
    });
    // Squares beat increments (both continuations agree: k=2 squares == k=2 increments).
    const squares = solveSequence([4, 9, 16, 25]);
    expect(squares?.family).toBe('squares');
    expect(squares?.next).toBe(36);
  });

  it('returns null for degenerate input', () => {
    expect(solveSequence([])).toBeNull();
    expect(solveSequence([7])).toBeNull();
    // Constant sequences are arithmetic with difference 0.
    expect(solveSequence([3, 3, 3])).toEqual({
      family: 'arithmetic',
      next: 3,
      params: { difference: 0 },
    });
  });

  it('never throws on arbitrary integer input', () => {
    for (const terms of [
      [1, 2, 4, 7],
      [0, 5, 10, 15],
      [9, 8, 6, 3],
      [1, 1, 1, 1],
      [2, 2, 4, 4],
    ]) {
      expect(() => solveSequence(terms)).not.toThrow();
    }
  });
});

describe('buildDistractors — near-miss candidates', () => {
  it('returns three distinct values in range that never equal the answer', () => {
    for (const [family, visible, answer, params] of [
      ['arithmetic', [2, 4, 6], 8, { first: 2, difference: 2 }],
      ['geometric', [1, 2, 4], 8, { first: 1, ratio: 2 }],
      ['squares', [4, 9, 16], 25, { base: 2, offset: 0 }],
      ['cubes', [8, 27, 64], 125, { base: 2, offset: 0 }],
      ['alternating', [1, 4, 3, 7], 5, { first: 1, stepA: 2, stepB: 3 }],
      ['fibonacci', [1, 1, 2, 3], 5, { first: 1, second: 1 }],
      ['increments', [2, 4, 8, 14], 22, { first: 2, firstDiff: 2, increment: 2 }],
    ] as const) {
      const rng = createRng(`distractors-${family}`);
      const distractor = buildDistractors(
        family,
        visible,
        answer,
        params,
        rng,
        0,
        1000,
      );
      expect(distractor).not.toBeNull();
      if (distractor !== null) {
        expect(distractor).toHaveLength(3);
        expect(new Set(distractor).size).toBe(3);
        expect(distractor).not.toContain(answer);
        for (const value of distractor) {
          expect(Number.isInteger(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1000);
        }
      }
    }
  });

  it('is deterministic for a fixed rng', () => {
    const a = buildDistractors(
      'arithmetic',
      [2, 4, 6],
      8,
      { first: 2, difference: 2 },
      createRng('det'),
      0,
      100,
    );
    const b = buildDistractors(
      'arithmetic',
      [2, 4, 6],
      8,
      { first: 2, difference: 2 },
      createRng('det'),
      0,
      100,
    );
    expect(a).toEqual(b);
  });
});

describe('generatePuzzle — emitted-puzzle invariants', () => {
  it('is deterministic: the same seed reproduces the same full session', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      expect(sessionPuzzles('seed-42', level)).toEqual(sessionPuzzles('seed-42', level));
    }
  });

  it('produces different sessions for different seeds', () => {
    const a = sessionPuzzles('seed-a', 'normal');
    const b = sessionPuzzles('seed-b', 'normal');
    expect(a[0].options).not.toEqual(b[0].options);
  });

  it('solver validates every emitted puzzle across many seeds and levels', () => {
    let checked = 0;
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const params = LOGIC_DIFFICULTY_PARAMS[level];
      for (let seed = 1; seed <= 100; seed += 1) {
        const rng = createRng(`invariant-${level}-${seed}`);
        let prev: LogicPuzzle | null = null;
        for (let round = 0; round < params.rounds; round += 1) {
          const puzzle = generatePuzzle({
            rng,
            roundIndex: round,
            tier: params.recipeTier,
            params,
            prevPuzzle: prev,
          });
          // Solver identifies the intended family and continuation.
          const solved = solveSequence(puzzle.terms);
          expect(solved).not.toBeNull();
          expect(solved?.family).toBe(puzzle.family);
          expect(solved?.next).toBe(puzzle.answer);
          checked += 1;
          prev = puzzle;
        }
      }
    }
    expect(checked).toBe(100 * (4 + 5 + 6 + 7)); // 2200 puzzles
  });

  it('emits four distinct integer options with exactly one correct answer, in bounds', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const params = LOGIC_DIFFICULTY_PARAMS[level];
      for (let seed = 1; seed <= 50; seed += 1) {
        const puzzle = generatePuzzle({
          rng: createRng(`options-${level}-${seed}`),
          roundIndex: 0,
          tier: params.recipeTier,
          params,
          prevPuzzle: null,
        });
        expect(puzzle.options).toHaveLength(4);
        expect(new Set(puzzle.options).size).toBe(4);
        expect(puzzle.options.filter((value) => value === puzzle.answer)).toHaveLength(1);
        expect(puzzle.options[puzzle.answerIndex]).toBe(puzzle.answer);
        for (const value of [...puzzle.terms, puzzle.answer, ...puzzle.options]) {
          expect(Number.isInteger(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(params.minValue);
          expect(value).toBeLessThanOrEqual(params.maxValue);
        }
      }
    }
  });

  it('is difficulty-appropriate: visible length and recipe pool match the tier', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const params = LOGIC_DIFFICULTY_PARAMS[level];
      for (let seed = 1; seed <= 25; seed += 1) {
        const puzzle = generatePuzzle({
          rng: createRng(`tier-${level}-${seed}`),
          roundIndex: 0,
          tier: params.recipeTier,
          params,
          prevPuzzle: null,
        });
        expect(puzzle.terms).toHaveLength(3 + params.recipeTier);
        expect(RECIPE_TIERS[params.recipeTier]).toContain(puzzle.family);
      }
    }
  });

  it('serves every adaptive tier within the adaptive value bounds', () => {
    for (let tier = 0; tier < RECIPE_TIERS.length; tier += 1) {
      for (let seed = 1; seed <= 50; seed += 1) {
        const puzzle = generatePuzzle({
          rng: createRng(`adaptive-${tier}-${seed}`),
          roundIndex: 0,
          tier,
          params: ADAPTIVE_PARAMS,
          prevPuzzle: null,
        });
        expect(puzzle.terms).toHaveLength(3 + tier);
        expect(RECIPE_TIERS[tier]).toContain(puzzle.family);
        for (const value of [...puzzle.terms, puzzle.answer, ...puzzle.options]) {
          expect(value).toBeGreaterThanOrEqual(ADAPTIVE_PARAMS.minValue);
          expect(value).toBeLessThanOrEqual(ADAPTIVE_PARAMS.maxValue);
        }
      }
    }
  });

  it('avoids near-duplicate consecutive puzzles', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const puzzles = sessionPuzzles(`dup-${seed}`, 'normal');
      for (let round = 1; round < puzzles.length; round += 1) {
        expect(isNearDuplicatePuzzle(puzzles[round], puzzles[round - 1])).toBe(false);
      }
    }
  });

  it('is bounded: generation always terminates with a valid puzzle', () => {
    // An adversarial previous puzzle (same answer as many candidates) still
    // terminates deterministically within the documented attempt budget.
    const adversarial: LogicPuzzle = {
      family: 'arithmetic',
      terms: [2, 4, 6, 8],
      answer: 10,
      options: [10, 12, 8, 14],
      answerIndex: 0,
      params: { first: 2, difference: 2 },
    };
    const rng = createRng('budget');
    const puzzle = generatePuzzle({
      rng,
      roundIndex: 1,
      tier: 1,
      params: LOGIC_DIFFICULTY_PARAMS.normal,
      prevPuzzle: adversarial,
    });
    expect(MAX_PUZZLE_ATTEMPTS).toBeGreaterThan(0);
    expect(new Set(puzzle.options).size).toBe(4);
    expect(puzzle.options).toContain(puzzle.answer);
  });
});

describe('isNearDuplicatePuzzle', () => {
  const base: LogicPuzzle = {
    family: 'arithmetic',
    terms: [2, 4, 6, 8],
    answer: 10,
    options: [10, 12, 8, 14],
    answerIndex: 0,
    params: { first: 2, difference: 2 },
  };

  it('flags the same answer even across families', () => {
    const sameAnswer = { ...base, family: 'geometric' as const };
    expect(isNearDuplicatePuzzle(base, sameAnswer)).toBe(true);
  });

  it('flags identical terms in the same family', () => {
    const sameTerms = { ...base, answer: 12, options: [12, 10, 8, 14] };
    expect(isNearDuplicatePuzzle(base, sameTerms)).toBe(true);
  });

  it('accepts different families or different terms', () => {
    const otherFamily = { ...base, family: 'fibonacci' as const, terms: [1, 2, 3, 5], answer: 8 };
    expect(isNearDuplicatePuzzle(base, otherFamily)).toBe(false);
    const otherTerms = { ...base, terms: [3, 6, 9, 12], answer: 15 };
    expect(isNearDuplicatePuzzle(base, otherTerms)).toBe(false);
  });
});

describe('describePattern', () => {
  it('produces a player-facing explanation per family', () => {
    expect(describePattern('arithmetic', { difference: 3 })).toBe('Each step adds 3.');
    expect(describePattern('geometric', { ratio: 2 })).toBe('Each term multiplies by 2.');
    expect(describePattern('squares', { base: 1, offset: 0 })).toBe(
      'Terms are consecutive squares.',
    );
    expect(describePattern('squares', { base: 1, offset: 2 })).toBe(
      'Terms are consecutive squares plus 2.',
    );
    expect(describePattern('cubes', { base: 2, offset: 0 })).toBe('Terms are consecutive cubes.');
    expect(describePattern('alternating', { stepA: 2, stepB: 3 })).toBe(
      'The steps alternate between +2 and +3.',
    );
    expect(describePattern('fibonacci', { first: 1, second: 1 })).toBe(
      'Each term is the sum of the two previous terms.',
    );
    expect(describePattern('increments', { increment: 2 })).toBe(
      'The steps grow by 2 each time.',
    );
  });
});
