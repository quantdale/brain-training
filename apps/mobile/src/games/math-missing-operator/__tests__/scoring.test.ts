// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import { MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS } from '../difficulty';
import {
  accuracyOf,
  avgResponseMs,
  clamp01,
  mathMissingOperatorPerformanceNormalizer,
  normalizeMathMissingOperatorResult,
  perfectSessionScore,
  roundScore,
} from '../scoring';
import type { MathMissingOperatorRawResult, MathMissingOperatorStats } from '../types';

function raw(overrides: Partial<MathMissingOperatorRawResult> = {}): MathMissingOperatorRawResult {
  return {
    score: 0,
    totalRounds: 7,
    roundsPlayed: 0,
    roundsCorrect: 0,
    accuracy: 0,
    bestStreak: 0,
    timeouts: 0,
    avgResponseMs: 0,
    totalResponseMs: 0,
    baseTimeMs: 10000,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: '42',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {
      gameId: 'math-missing-operator',
      sdkVersion: '0.1.0',
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      seed: '42',
      difficulty: 'normal',
      startedAtMs: 0,
      activeDurationMs: 0,
      pausedDurationMs: 0,
    },
    ...overrides,
  };
}

describe('roundScore', () => {
  it('awards 100 base plus a speed bonus of up to 50', () => {
    expect(roundScore(true, 0, 10000)).toBe(150);
    expect(roundScore(true, 5000, 10000)).toBe(125); // half budget → half bonus
    expect(roundScore(true, 10000, 10000)).toBe(100); // at budget → no bonus
    expect(roundScore(true, 20000, 10000)).toBe(100); // over budget → clamped
    expect(roundScore(false, 1000, 10000)).toBe(0);
  });

  it('is monotone in speed for a fixed budget', () => {
    expect(roundScore(true, 1, 9300)).toBeGreaterThan(roundScore(true, 5000, 9300));
    expect(roundScore(true, 5000, 9300)).toBeGreaterThan(roundScore(true, 9000, 9300));
  });
});

describe('perfectSessionScore', () => {
  it('is 150 per round (100 base + 50 max bonus)', () => {
    expect(perfectSessionScore(MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS.normal)).toBe(1050);
    expect(perfectSessionScore(MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS.expert)).toBe(1350);
  });
});

describe('accuracyOf / avgResponseMs / clamp01', () => {
  it('guards division by zero', () => {
    expect(accuracyOf(0, 0)).toBe(0);
    expect(accuracyOf(3, 4)).toBe(0.75);
  });

  it('averages over answered (non-timeout) rounds only', () => {
    const stats: MathMissingOperatorStats = {
      score: 0,
      roundsPlayed: 6,
      roundsCorrect: 4,
      bestStreak: 0,
      streak: 0,
      totalResponseMs: 3000,
      timeouts: 2,
    };
    expect(avgResponseMs(stats)).toBe(750); // 3000 / (6 − 2)
    expect(avgResponseMs({ ...stats, roundsPlayed: 2, timeouts: 2 })).toBe(0);
  });

  it('clamps to [0, 1] and rejects non-finite input', () => {
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(1.4)).toBe(1);
    expect(clamp01(0.42)).toBe(0.42);
    expect(() => clamp01(Number.NaN)).toThrow(/finite/);
    expect(() => clamp01(Number.POSITIVE_INFINITY)).toThrow(/finite/);
  });
});

describe('normalizeMathMissingOperatorResult', () => {
  it('is 0 when nothing was played', () => {
    expect(normalizeMathMissingOperatorResult(raw(), { gameId: 'x', difficulty: 'normal', durationMs: 0 }).value).toBe(0);
  });

  it('is 1 for a perfect instant session', () => {
    const result = normalizeMathMissingOperatorResult(
      raw({ roundsPlayed: 7, roundsCorrect: 7, accuracy: 1, avgResponseMs: 0 }),
      { gameId: 'x', difficulty: 'normal', durationMs: 1000 },
    );
    expect(result.value).toBe(1);
    expect(result.scale).toBe('0..1');
  });

  it('is 0 when nothing was answered correctly', () => {
    const result = normalizeMathMissingOperatorResult(
      raw({ roundsPlayed: 7, roundsCorrect: 0, avgResponseMs: 500 }),
      { gameId: 'x', difficulty: 'normal', durationMs: 1000 },
    );
    expect(result.value).toBe(0);
  });

  it('blends accuracy with speed: accuracy × (0.6 + 0.4 × speed)', () => {
    // Accuracy 1, average response 2s of a 10s budget → speed 0.8 → 0.92.
    const result = normalizeMathMissingOperatorResult(
      raw({ roundsPlayed: 7, roundsCorrect: 7, accuracy: 1, avgResponseMs: 2000, baseTimeMs: 10000 }),
      { gameId: 'x', difficulty: 'normal', durationMs: 1000 },
    );
    expect(result.value).toBeCloseTo(0.92, 10);
    // Slow but perfect: speed 0 → value 0.6.
    const slow = normalizeMathMissingOperatorResult(
      raw({ roundsPlayed: 7, roundsCorrect: 7, accuracy: 1, avgResponseMs: 12000, baseTimeMs: 10000 }),
      { gameId: 'x', difficulty: 'normal', durationMs: 1000 },
    );
    expect(slow.value).toBeCloseTo(0.6, 10);
  });

  it('exposes the raw snapshot', () => {
    const r = raw({ roundsPlayed: 4, roundsCorrect: 3, accuracy: 0.75 });
    const result = normalizeMathMissingOperatorResult(r, {
      gameId: 'x',
      difficulty: 'normal',
      durationMs: 1000,
    });
    expect(result.raw).toEqual(expect.objectContaining({ roundsCorrect: 3 }));
  });
});

describe('mathMissingOperatorPerformanceNormalizer', () => {
  it('is bound to the game id', () => {
    expect(mathMissingOperatorPerformanceNormalizer.gameId).toBe('math-missing-operator');
  });
});
