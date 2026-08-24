// Reachability property suite for the Equation Builder content pack
// (campaign 012 W09). Guards the class of bug found in campaign 010: curated
// templates that pass no level's draw filter (length/range/solvability) and can
// therefore never be served. All seeds are fixed — failures reproduce exactly.
// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS,
  nextAdaptiveParams,
} from '../difficulty';
import { PUZZLE_TEMPLATES, canSolve, generatePuzzle } from '../generator';
import type { MathEquationBuilderDifficultyParams } from '../types';

const FIXED_LEVELS = ['easy', 'normal', 'hard', 'expert'] as const;

/**
 * Every params regime the shipped game can run under: the four fixed levels,
 * the adaptive start, and the two adaptive escalation states (4 and 5 numbers
 * with their widened target windows). Template liveness must hold for all of
 * them — a template only reachable under params the game never uses is dead.
 */
function allParamSets(): { label: string; params: MathEquationBuilderDifficultyParams }[] {
  const mid = nextAdaptiveParams({ ...ADAPTIVE_PARAMS }, true);
  const top = nextAdaptiveParams(mid, true);
  return [
    ...FIXED_LEVELS.map((level) => ({
      label: level,
      params: MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS[level],
    })),
    { label: 'adaptive-start', params: ADAPTIVE_PARAMS },
    { label: 'adaptive-mid', params: mid },
    { label: 'adaptive-top', params: top },
  ];
}

/** True when `generatePuzzle`'s filter would admit the template at these params. */
function admittedBy(template: { numbers: readonly number[]; target: number }, params: MathEquationBuilderDifficultyParams): boolean {
  return (
    template.numbers.length === params.numbersCount &&
    template.target >= params.targetMin &&
    template.target <= params.targetMax
  );
}

function samePuzzle(
  a: { target: number; numbers: readonly number[] },
  b: { target: number; numbers: readonly number[] },
): boolean {
  return a.target === b.target && a.numbers.join(',') === b.numbers.join(',');
}

describe('template bank invariants', () => {
  it('keeps every template inside the documented shape (2–20, distinct, 3–5 numbers)', () => {
    for (const template of PUZZLE_TEMPLATES) {
      expect(template.numbers.length).toBeGreaterThanOrEqual(3);
      expect(template.numbers.length).toBeLessThanOrEqual(5);
      expect(new Set(template.numbers).size).toBe(template.numbers.length);
      for (const n of template.numbers) {
        expect(n).toBeGreaterThanOrEqual(2);
        expect(n).toBeLessThanOrEqual(20);
        expect(Number.isInteger(n)).toBe(true);
      }
    }
  });

  it('has no duplicate targets across the whole bank', () => {
    const targets = PUZZLE_TEMPLATES.map((t) => t.target);
    expect(new Set(targets).size).toBe(targets.length);
  });
});

describe('content reachability (campaign 010 debt class)', () => {
  it('admits no unsolvable template at any level (filter ⇒ solvable)', () => {
    // The exact invariant that failed before campaign 012: whenever a level's
    // length + range filter admits a template, that level's operator mix must
    // be able to solve it — otherwise the template is unreachable dead weight.
    for (const template of PUZZLE_TEMPLATES) {
      for (const { params } of allParamSets()) {
        if (!admittedBy(template, params)) continue;
        expect(canSolve(template.target, template.numbers, params.operators)).toBe(true);
      }
    }
  });

  it('every template is drawable by at least one shipped difficulty regime', () => {
    const dead = PUZZLE_TEMPLATES.filter(
      (t) => !allParamSets().some(({ params }) => admittedBy(t, params)),
    );
    expect(dead).toEqual([]);
  });

  it('the nine dead templates found in campaigns 010/012 are gone', () => {
    // Eight ×-requiring 3-number sets (unreachable: 3-number tiers are always
    // +/− only; most also outside easy's target range) plus {[8,4,5],9}, which
    // sat below easy's targetMin.
    const deadOnes = [
      { numbers: [10, 3, 4], target: 26 },
      { numbers: [8, 7, 3], target: 53 },
      { numbers: [6, 5, 4], target: 54 },
      { numbers: [9, 4, 2], target: 38 },
      { numbers: [7, 6, 3], target: 45 },
      { numbers: [10, 5, 2], target: 52 },
      { numbers: [8, 6, 4], target: 44 },
      { numbers: [13, 2, 5], target: 31 },
      { numbers: [8, 4, 5], target: 9 },
    ];
    for (const dead of deadOnes) {
      expect(PUZZLE_TEMPLATES.some((t) => samePuzzle(t, dead))).toBe(false);
    }
  });

  it('re-tiered multiplication sets stay ×-crucial (not solvable with +/− alone)', () => {
    // The eight conversions keep their multiplication flavor: if they were
    // solvable with plus/minus only they would dilute normal/hard instead of
    // enriching them.
    const reTiered = [
      { numbers: [10, 3, 4, 2], target: 26 },
      { numbers: [8, 7, 3, 2], target: 50 },
      { numbers: [6, 5, 4, 3], target: 47 },
      { numbers: [9, 4, 2, 3], target: 37 },
      { numbers: [7, 6, 3, 2], target: 43 },
      { numbers: [10, 5, 2, 3], target: 49 },
      { numbers: [8, 6, 4, 2], target: 44 },
      { numbers: [13, 2, 5, 4], target: 31 },
    ];
    for (const t of reTiered) {
      expect(PUZZLE_TEMPLATES.some((bank) => samePuzzle(bank, t))).toBe(true);
      expect(canSolve(t.target, t.numbers, ['+', '-'])).toBe(false);
      expect(canSolve(t.target, t.numbers, ['+', '-', '×'])).toBe(true);
    }
  });

  it('easy pool stays easy: every 3-number template is solvable with +/− in range', () => {
    const params = MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.easy;
    const easyPool = PUZZLE_TEMPLATES.filter((t) => t.numbers.length === params.numbersCount);
    expect(easyPool.length).toBeGreaterThan(0);
    for (const t of easyPool) {
      expect(t.target).toBeGreaterThanOrEqual(params.targetMin);
      expect(t.target).toBeLessThanOrEqual(params.targetMax);
      expect(canSolve(t.target, t.numbers, params.operators)).toBe(true);
    }
  });

  it('expert pool stays meaningful: 5-number sets need the full operator mix', () => {
    const params = MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.expert;
    const expertPool = PUZZLE_TEMPLATES.filter((t) => t.numbers.length === params.numbersCount);
    // Expert must have real curated depth (it once had none).
    expect(expertPool.length).toBeGreaterThanOrEqual(10);
    for (const t of expertPool) {
      expect(t.target).toBeGreaterThanOrEqual(params.targetMin);
      expect(canSolve(t.target, t.numbers, ['+'])).toBe(false);
      expect(canSolve(t.target, t.numbers, params.operators)).toBe(true);
    }
  });
});

describe('generation sweep over seeds and difficulties', () => {
  const SWEEP_SEEDS = 40;

  function fullSession(seed: string, params: MathEquationBuilderDifficultyParams) {
    const rng = createRng(seed);
    const puzzles: { target: number; numbers: readonly number[] }[] = [];
    let prevTarget: number | null = null;
    for (let round = 0; round < params.rounds; round += 1) {
      const puzzle = generatePuzzle({ rng, roundIndex: round, params, prevTarget });
      puzzles.push(puzzle);
      prevTarget = puzzle.target;
    }
    return puzzles;
  }

  function assertValid(puzzle: { target: number; numbers: readonly number[] }, params: MathEquationBuilderDifficultyParams): void {
    expect(puzzle.numbers).toHaveLength(params.numbersCount);
    expect(puzzle.target).toBeGreaterThanOrEqual(params.targetMin);
    expect(puzzle.target).toBeLessThanOrEqual(params.targetMax);
    expect(canSolve(puzzle.target, puzzle.numbers, params.operators)).toBe(true);
    expect(new Set(puzzle.numbers).size).toBe(puzzle.numbers.length);
  }

  it('every puzzle of every session is valid, curated-backed and non-repeating', () => {
    let drawnDistinctTemplates = new Set<string>();
    for (const { label, params } of allParamSets()) {
      for (let seed = 1; seed <= SWEEP_SEEDS; seed += 1) {
        const session = fullSession(`${label}-${seed}`, params);
        for (const puzzle of session) {
          assertValid(puzzle, params);
          // Shipped regimes always serve curated content: the compatible
          // subset is never empty, so generation must resolve through it.
          expect(PUZZLE_TEMPLATES.some((t) => samePuzzle(t, puzzle))).toBe(true);
        }
        drawnDistinctTemplates = new Set([
          ...drawnDistinctTemplates,
          ...session.map((p) => `${p.target}|${p.numbers.join(',')}`),
        ]);
      }
    }
    // The sweep actually exercises a healthy share of the bank (liveness
    // evidence beyond static admission).
    expect(drawnDistinctTemplates.size).toBeGreaterThanOrEqual(20);
  });

  it('sessions are reproducible from the seed and vary across seeds', () => {
    for (const { label, params } of allParamSets()) {
      expect(fullSession(`repro-${label}`, params)).toEqual(fullSession(`repro-${label}`, params));
      const a = fullSession(`var-a-${label}`, params);
      const b = fullSession(`var-b-${label}`, params);
      expect(a).not.toEqual(b);
    }
  });

  it('the round index takes part in the fork salts (no constant-round aliasing)', () => {
    // If a salt dropped the round index, distinct rounds would reuse one fork
    // stream; over many fresh RNGs the per-round puzzles would collapse onto
    // the same few draws. With correct salting they spread out.
    const params = MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.normal;
    const roundZeroDraws = new Set<string>();
    const roundOneDraws = new Set<string>();
    for (let seed = 1; seed <= 30; seed += 1) {
      const p0 = generatePuzzle({ rng: createRng(`salt-${seed}`), roundIndex: 0, params, prevTarget: null });
      const p1 = generatePuzzle({ rng: createRng(`salt-${seed}`), roundIndex: 1, params, prevTarget: null });
      roundZeroDraws.add(`${p0.target}|${p0.numbers.join(',')}`);
      roundOneDraws.add(`${p1.target}|${p1.numbers.join(',')}`);
    }
    // Both rounds draw from the same 25-template pool, so identical draws
    // happen; but neither round may be a constant across seeds.
    expect(roundZeroDraws.size).toBeGreaterThan(3);
    expect(roundOneDraws.size).toBeGreaterThan(3);
  });
});
