// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  accuracyOf,
  clamp01,
  normalizeOrderPathResult,
  orderPathPerformanceNormalizer,
  perfectSessionScore,
  roundScore,
  speedScoreOf,
} from '../scoring';
import { ORDER_PATH_DIFFICULTY_PARAMS } from '../difficulty';
import type { OrderPathRawResult } from '../types';

function raw(overrides: Partial<OrderPathRawResult> = {}): OrderPathRawResult {
  return {
    score: 0,
    totalRounds: 5,
    roundsPlayed: 5,
    roundsCorrect: 5,
    accuracy: 1,
    bestStreak: 5,
    bestRoundTimeMs: 0,
    totalElapsedMs: 0,
    totalBudgetMs: 125_000,
    itemCount: 5,
    roundTimeMs: 25_000,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {} as OrderPathRawResult['diagnosticMetadata'],
    ...overrides,
  };
}

describe('roundScore', () => {
  it('gives 150 for an instant answer and 100 at the full budget', () => {
    expect(roundScore(0, 25_000)).toBe(150);
    expect(roundScore(25_000, 25_000)).toBe(100);
  });

  it('scales linearly in between', () => {
    expect(roundScore(12_500, 25_000)).toBe(125);
  });

  it('rejects a non-positive budget', () => {
    expect(() => roundScore(0, 0)).toThrow();
    expect(() => roundScore(0, -1)).toThrow();
  });
});

describe('perfectSessionScore', () => {
  it('is 150 per round', () => {
    expect(perfectSessionScore(ORDER_PATH_DIFFICULTY_PARAMS.normal)).toBe(750);
    expect(perfectSessionScore(ORDER_PATH_DIFFICULTY_PARAMS.easy)).toBe(600);
    expect(perfectSessionScore(ORDER_PATH_DIFFICULTY_PARAMS.expert)).toBe(1050);
  });
});

describe('accuracyOf / speedScoreOf', () => {
  it('accuracy is 0 with no rounds and divides correctly otherwise', () => {
    expect(accuracyOf(0, 0)).toBe(0);
    expect(accuracyOf(3, 4)).toBeCloseTo(0.75);
  });

  it('speed is 1 for instant answers and 0 when the budget is consumed', () => {
    expect(speedScoreOf(0, 5)).toBe(1);
    expect(speedScoreOf(5, 5)).toBe(0);
    expect(speedScoreOf(2.5, 5)).toBeCloseTo(0.5);
    expect(speedScoreOf(0, 0)).toBe(0);
  });

  it('speed clamps over-consumed ratios to 0', () => {
    expect(speedScoreOf(10, 5)).toBe(0);
  });
});

describe('clamp01', () => {
  it('clamps into [0, 1]', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.4)).toBe(0.4);
  });

  it('rejects non-finite input', () => {
    expect(() => clamp01(NaN)).toThrow();
    expect(() => clamp01(Infinity)).toThrow();
  });
});

describe('normalizeOrderPathResult', () => {
  const context = {
    gameId: 'logic-order-path',
    difficulty: 'normal' as const,
    durationMs: 1000,
  };

  it('returns 1 for a perfect all-instant session', () => {
    const perfect = normalizeOrderPathResult(raw(), context);
    expect(perfect.value).toBe(1);
    expect(perfect.scale).toBe('0..1');
  });

  it('returns 0 when nothing was answered correctly', () => {
    const zero = normalizeOrderPathResult(
      raw({ roundsCorrect: 0, accuracy: 0, bestStreak: 0 }),
      context,
    );
    expect(zero.value).toBe(0);
  });

  it('blends accuracy with speed (documented formula)', () => {
    // accuracy 3/5 = 0.6; totalElapsed/totalBudget = 0.5
    // speed = 1 − 0.5/5 = 0.9 → value = 0.6 × (0.5 + 0.5 × 0.9) = 0.57
    const mixed = normalizeOrderPathResult(
      raw({
        roundsCorrect: 3,
        accuracy: 0.6,
        bestStreak: 2,
        totalElapsedMs: 62_500,
      }),
      context,
    );
    expect(mixed.value).toBeCloseTo(0.57);
  });

  it('never exceeds 1 even for out-of-range raw timings', () => {
    const capped = normalizeOrderPathResult(
      raw({ totalElapsedMs: -1000 }),
      context,
    );
    expect(capped.value).toBeLessThanOrEqual(1);
    expect(capped.value).toBe(1);
  });

  it('stays within [0, 1] across randomized-ish boundary inputs', () => {
    for (const [correct, played] of [
      [0, 5],
      [1, 5],
      [5, 5],
      [0, 0],
    ] as const) {
      const result = normalizeOrderPathResult(
        raw({ roundsCorrect: correct, roundsPlayed: played, accuracy: accuracyOf(correct, played) }),
        context,
      );
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const result = normalizeOrderPathResult(raw({ seed: 'diag' }), context);
    expect((result.raw as OrderPathRawResult).seed).toBe('diag');
  });

  it('exposes an SDK-conformant normalizer instance', () => {
    expect(orderPathPerformanceNormalizer.gameId).toBe('logic-order-path');
    expect(orderPathPerformanceNormalizer.normalize(raw(), context)).toEqual(
      normalizeOrderPathResult(raw(), context),
    );
  });
});
