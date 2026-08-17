// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  accuracyOf,
  avgTimeBonus,
  clamp01,
  normalizeMathEquationBuilderResult,
  partialCreditScore,
  perfectSessionScore,
  puzzleScore,
} from '../scoring';
import { MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS } from '../difficulty';
import type { MathEquationBuilderRawResult } from '../types';

function rawResult(overrides: Partial<MathEquationBuilderRawResult>): MathEquationBuilderRawResult {
  return {
    score: 0,
    totalRounds: 5,
    roundsPlayed: 0,
    roundsPassed: 0,
    accuracy: 0,
    bestStreak: 0,
    totalTimeBonus: 0,
    puzzlesSolvedFirstTry: 0,
    numbersCount: 4,
    targetMin: 10,
    targetMax: 50,
    operators: ['+', '-', '×'],
    timeBudgetMs: 50_000,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {
      gameId: 'math-equation-builder',
      sdkVersion: '0.1.0',
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      seed: 's',
      difficulty: 'normal',
      startedAtMs: 0,
      activeDurationMs: 0,
      pausedDurationMs: 0,
    },
    ...overrides,
  };
}

describe('puzzleScore', () => {
  it('awards 200 base points plus time bonus', () => {
    const full = puzzleScore(50_000, 50_000);
    expect(full.base).toBe(200);
    expect(full.timeBonus).toBe(100);
    expect(full.total).toBe(300);
  });

  it('awards minimum time bonus when time is up', () => {
    const none = puzzleScore(0, 50_000);
    expect(none.base).toBe(200);
    expect(none.timeBonus).toBe(0);
    expect(none.total).toBe(200);
  });

  it('scales time bonus proportionally', () => {
    const half = puzzleScore(25_000, 50_000);
    expect(half.timeBonus).toBe(50);
  });
});

describe('partialCreditScore', () => {
  it('returns 50', () => {
    expect(partialCreditScore()).toBe(50);
  });
});

describe('perfectSessionScore', () => {
  it('calculates for normal: 5 rounds × 300', () => {
    expect(perfectSessionScore(MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.normal)).toBe(1500);
  });

  it('calculates for easy: 4 rounds × 300', () => {
    expect(perfectSessionScore(MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.easy)).toBe(1200);
  });
});

describe('accuracyOf', () => {
  it('computes the pass ratio', () => {
    expect(accuracyOf(3, 5)).toBe(0.6);
    expect(accuracyOf(5, 5)).toBe(1);
    expect(accuracyOf(0, 4)).toBe(0);
  });

  it('guards division by zero', () => {
    expect(accuracyOf(0, 0)).toBe(0);
  });
});

describe('clamp01', () => {
  it('clamps into [0, 1]', () => {
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
  });

  it('rejects non-finite input', () => {
    expect(() => clamp01(Number.NaN)).toThrow(RangeError);
    expect(() => clamp01(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('avgTimeBonus', () => {
  it('returns 0 when no rounds played', () => {
    expect(avgTimeBonus(0, 0)).toBe(0);
  });

  it('computes average time bonus', () => {
    // 300 total bonus across 3 rounds → avg 100 per round → 1.0
    expect(avgTimeBonus(300, 3)).toBe(1);
    // 150 total bonus across 3 rounds → avg 50 per round → 0.5
    expect(avgTimeBonus(150, 3)).toBeCloseTo(0.5);
  });
});

describe('normalizeMathEquationBuilderResult (documented formula)', () => {
  it('scores a perfect run high', () => {
    // accuracy 1, avgTimeBonus 1 → 1 * (0.5 + 0.5) = 1
    const normalized = normalizeMathEquationBuilderResult(
      rawResult({
        roundsPlayed: 5,
        roundsPassed: 5,
        totalTimeBonus: 500,
        bestStreak: 5,
        accuracy: 1,
      }),
      { gameId: 'math-equation-builder', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.scale).toBe('0..1');
    expect(normalized.value).toBeCloseTo(1);
  });

  it('is 0 when no round was passed', () => {
    const normalized = normalizeMathEquationBuilderResult(
      rawResult({ roundsPlayed: 5, roundsPassed: 0 }),
      { gameId: 'math-equation-builder', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(0);
  });

  it('rewards time bonus even at perfect accuracy', () => {
    const noTimeBonus = normalizeMathEquationBuilderResult(
      rawResult({ roundsPlayed: 5, roundsPassed: 5, totalTimeBonus: 0, accuracy: 1 }),
      { gameId: 'math-equation-builder', difficulty: 'normal', durationMs: 0 },
    );
    expect(noTimeBonus.value).toBe(0.5); // 1 * (0.5 + 0)
  });

  it('never exceeds 1', () => {
    const normalized = normalizeMathEquationBuilderResult(
      rawResult({
        roundsPlayed: 5,
        roundsPassed: 5,
        totalTimeBonus: 500,
        accuracy: 1,
      }),
      { gameId: 'math-equation-builder', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBeLessThanOrEqual(1);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const raw = rawResult({ roundsPlayed: 1, roundsPassed: 1, totalTimeBonus: 100 });
    const normalized = normalizeMathEquationBuilderResult(raw, {
      gameId: 'math-equation-builder',
      difficulty: 'normal',
      durationMs: 0,
    });
    expect(normalized.raw).toEqual(expect.objectContaining({ seed: 's', difficulty: 'normal' }));
  });
});
