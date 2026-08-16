// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  BASE_PROBLEM_POINTS,
  SPEED_BONUS_POINTS,
  accuracyOf,
  clamp01,
  normalizeMathResult,
  perfectSessionScore,
  problemScore,
  speedFactor,
} from '../scoring';
import { MATH_DIFFICULTY_PARAMS } from '../difficulty';
import type { MathRawResult } from '../types';

function rawResult(overrides: Partial<MathRawResult>): MathRawResult {
  return {
    score: 0,
    totalProblems: 5,
    problemsPlayed: 0,
    problemsCorrect: 0,
    accuracy: 0,
    bestStreak: 0,
    fastestMs: null,
    avgCorrectMs: null,
    timeBudgetMs: 8_000,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {
      gameId: 'math-fast-math',
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

describe('problemScore', () => {
  it('pays the base plus a speed bonus that decays linearly', () => {
    expect(problemScore(0, 8_000)).toBe(BASE_PROBLEM_POINTS + SPEED_BONUS_POINTS); // 150
    expect(problemScore(4_000, 8_000)).toBe(125);
    expect(problemScore(8_000, 8_000)).toBe(BASE_PROBLEM_POINTS); // 100
  });

  it('pays a flat base for untimed problems regardless of elapsed time', () => {
    expect(problemScore(3_000, 0)).toBe(BASE_PROBLEM_POINTS);
    expect(problemScore(0, 0)).toBe(BASE_PROBLEM_POINTS);
  });

  it('clamps elapsed time past the budget to the base', () => {
    expect(problemScore(16_000, 8_000)).toBe(BASE_PROBLEM_POINTS);
  });
});

describe('perfectSessionScore', () => {
  it('is rounds × (base + max bonus) for a perfect instant run', () => {
    expect(perfectSessionScore(MATH_DIFFICULTY_PARAMS.normal)).toBe(5 * 150); // 750
    expect(perfectSessionScore(MATH_DIFFICULTY_PARAMS.easy)).toBe(4 * 150); // 600
    expect(perfectSessionScore(MATH_DIFFICULTY_PARAMS.expert)).toBe(7 * 150); // 1050
  });
});

describe('accuracyOf', () => {
  it('computes the correct ratio', () => {
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

describe('speedFactor', () => {
  it('is 1 for untimed sessions (no time pressure)', () => {
    expect(speedFactor(1_000, 0)).toBe(1);
    expect(speedFactor(null, 0)).toBe(1);
  });

  it('is 1 at instant responses and 0 at/beyond the budget', () => {
    expect(speedFactor(0, 8_000)).toBe(1);
    expect(speedFactor(8_000, 8_000)).toBe(0);
    expect(speedFactor(16_000, 8_000)).toBe(0);
  });

  it('scales linearly in between', () => {
    expect(speedFactor(4_000, 8_000)).toBe(0.5);
    expect(speedFactor(2_000, 8_000)).toBe(0.75);
  });

  it('is 0 when no correct answer exists', () => {
    expect(speedFactor(null, 8_000)).toBe(0);
  });
});

describe('normalizeMathResult (documented formula)', () => {
  it('scores a perfect instant run at 1', () => {
    const normalized = normalizeMathResult(
      rawResult({
        problemsPlayed: 5,
        problemsCorrect: 5,
        accuracy: 1,
        avgCorrectMs: 0,
      }),
      { gameId: 'math-fast-math', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.scale).toBe('0..1');
    expect(normalized.value).toBe(1);
  });

  it('is 0 when nothing was answered correctly', () => {
    const normalized = normalizeMathResult(
      rawResult({ problemsPlayed: 5, problemsCorrect: 0, avgCorrectMs: null }),
      { gameId: 'math-fast-math', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(0);
  });

  it('rewards speed at perfect accuracy: half value for at-budget responses', () => {
    const normalized = normalizeMathResult(
      rawResult({ problemsPlayed: 5, problemsCorrect: 5, accuracy: 1, avgCorrectMs: 8_000 }),
      { gameId: 'math-fast-math', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(0.5); // 1 * (0.5 + 0.5 * 0)
  });

  it('blends accuracy and speed (documented: accuracy × (0.5 + 0.5 × speed))', () => {
    // accuracy 0.8, speed 0.75 → 0.8 * (0.5 + 0.375) = 0.7
    const normalized = normalizeMathResult(
      rawResult({ problemsPlayed: 5, problemsCorrect: 4, accuracy: 0.8, avgCorrectMs: 2_000 }),
      { gameId: 'math-fast-math', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBeCloseTo(0.7);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const raw = rawResult({ problemsPlayed: 1, problemsCorrect: 1, avgCorrectMs: 500 });
    const normalized = normalizeMathResult(raw, {
      gameId: 'math-fast-math',
      difficulty: 'normal',
      durationMs: 0,
    });
    expect(normalized.raw).toEqual(expect.objectContaining({ seed: 's', difficulty: 'normal' }));
  });
});
