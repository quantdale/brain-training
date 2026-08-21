// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  clearRatioOf,
  clamp01,
  correctPoints,
  meanSpeedOf,
  normalizeOrderSweepResult,
  paceMs,
  perfectRoundBonus,
  perfectSessionScore,
  speedFactor,
} from '../scoring';
import { ORDER_SWEEP_DIFFICULTY_PARAMS } from '../difficulty';
import type { OrderSweepRawResult } from '../types';

describe('raw scoring', () => {
  it('speedFactor is 1 for an instant clear and 0 at/after the average pace (paceMs = window/count)', () => {
    expect(paceMs(8000, 9)).toBeCloseTo(8000 / 9);
    expect(speedFactor(800, 0)).toBe(1);
    expect(speedFactor(800, 800)).toBe(0);
    // Negative gaps (clock skew) clamp to 1.
    expect(speedFactor(800, -50)).toBe(1);
    expect(() => paceMs(0, 9)).toThrow(RangeError);
    expect(() => speedFactor(Number.NaN, 100)).toThrow(RangeError);
  });

  it('correctPoints awards 100 base + up to 50 speed bonus; bonuses are 40/token and 190/token per perfect session', () => {
    expect(correctPoints(800, 800)).toBe(100);
    expect(correctPoints(800, 0)).toBe(150);
    expect(correctPoints(800, 400)).toBeCloseTo(125);
    expect(perfectRoundBonus(9)).toBe(360);
    expect(perfectSessionScore(ORDER_SWEEP_DIFFICULTY_PARAMS.normal)).toBe(5 * 9 * 190);
    expect(perfectSessionScore(ORDER_SWEEP_DIFFICULTY_PARAMS.easy)).toBe(4 * 6 * 190);
  });

  it('guards: clearRatioOf divides over dealt tokens, meanSpeedOf is 0 with no clears, clamp01 rejects non-finite input', () => {
    expect(clearRatioOf(27, 45)).toBeCloseTo(0.6);
    expect(clearRatioOf(0, 0)).toBe(0);
    expect(meanSpeedOf([0.5, 1])).toBeCloseTo(0.75);
    expect(meanSpeedOf([])).toBe(0);
    expect(() => clamp01(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

function rawResult(overrides: Partial<OrderSweepRawResult>): OrderSweepRawResult {
  return {
    score: 0,
    totalTokens: 45,
    tokensCleared: 0,
    tokensExpired: 0,
    wrongTaps: 0,
    clearRatio: 0,
    gaps: [],
    speedFactors: [],
    meanGapMs: null,
    bestGapMs: null,
    meanSpeed: 0,
    bestStreak: 0,
    perfectRounds: 0,
    roundsPlayed: 0,
    roundsCleared: 0,
    finalWindowMs: 8000,
    initialWindowMs: 8000,
    count: 9,
    columns: 3,
    maxValue: 40,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {
      gameId: 'speed-order-sweep',
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

describe('normalizeOrderSweepResult (documented formula)', () => {
  it('reaches 1.0 when everything is swept instantly, 0 when nothing is cleared, and blends ratio (0.6) with speed (0.4)', () => {
    const context = { gameId: 'speed-order-sweep', difficulty: 'normal' as const, durationMs: 0 };

    const perfect = normalizeOrderSweepResult(
      rawResult({
        tokensCleared: 45,
        clearRatio: 1,
        gaps: Array.from({ length: 45 }, () => 0),
        speedFactors: Array.from({ length: 45 }, () => 1),
        meanSpeed: 1,
      }),
      context,
    );
    expect(perfect.scale).toBe('0..1');
    expect(perfect.value).toBe(1);

    const empty = normalizeOrderSweepResult(rawResult({ tokensExpired: 45 }), context);
    expect(empty.value).toBe(0);

    // 36/45 cleared at speed 0.5 → 0.6 * 0.8 + 0.4 * 0.5 = 0.68
    const blended = normalizeOrderSweepResult(
      rawResult({
        tokensCleared: 36,
        tokensExpired: 9,
        clearRatio: 0.8,
        speedFactors: [0.5],
        meanSpeed: 0.5,
      }),
      context,
    );
    expect(blended.value).toBeCloseTo(0.68);
  });
});
