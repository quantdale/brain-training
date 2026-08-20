// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  BASE_POINTS,
  MAX_SPEED_BONUS,
  PERFECT_ROUND_SCORE,
  accuracyOf,
  clamp01,
  hardAccuracyOf,
  normalizeSpatialGridNavResult,
  perfectSessionScore,
  roundScore,
  speedScoreOf,
  spatialGridNavPerformanceNormalizer,
} from '../scoring';
import { DIFFICULTY_PARAMS } from '../difficulty';
import type { SpatialGridNavRawResult } from '../types';

function rawResult(overrides: Partial<SpatialGridNavRawResult> = {}): SpatialGridNavRawResult {
  return {
    score: 0,
    totalRounds: 5,
    roundsPlayed: 0,
    correctPicks: 0,
    mistakes: 0,
    accuracy: 0,
    bestStreak: 0,
    totalResponseMs: 0,
    scoredPicks: 0,
    averageResponseMs: 0,
    speedScore: 0,
    hardPlayed: 0,
    hardCorrect: 0,
    hardAccuracy: 0,
    gridSide: 5,
    minCommandCount: 4,
    maxCommandCount: 5,
    allowBack: true,
    options: 3,
    speedTargetMs: 5000,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {
      gameId: 'spatial-grid-nav',
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

describe('roundScore', () => {
  it('awards base points plus speed bonus for a correct answer', () => {
    expect(roundScore(true, 0, 5000)).toBe(BASE_POINTS + MAX_SPEED_BONUS);
    expect(roundScore(true, 0, 5000)).toBe(PERFECT_ROUND_SCORE);
    expect(roundScore(false, 0, 5000)).toBe(0);
  });

  it('rewards faster answers', () => {
    const fast = roundScore(true, 500, 5000);
    const slow = roundScore(true, 4500, 5000);
    expect(fast).toBeGreaterThan(slow);
  });
});

describe('perfectSessionScore', () => {
  it('sums round scores for a perfect run', () => {
    expect(perfectSessionScore(DIFFICULTY_PARAMS.easy)).toBe(6 * PERFECT_ROUND_SCORE);
    expect(perfectSessionScore(DIFFICULTY_PARAMS.normal)).toBe(7 * PERFECT_ROUND_SCORE);
    expect(perfectSessionScore(DIFFICULTY_PARAMS.expert)).toBe(9 * PERFECT_ROUND_SCORE);
  });
});

describe('accuracyOf', () => {
  it('computes the ratio', () => {
    expect(accuracyOf(3, 5)).toBe(0.6);
    expect(accuracyOf(5, 5)).toBe(1);
    expect(accuracyOf(0, 4)).toBe(0);
  });

  it('guards division by zero', () => {
    expect(accuracyOf(0, 0)).toBe(0);
  });
});

describe('hardAccuracyOf', () => {
  it('computes the ratio when hard rounds were played', () => {
    expect(hardAccuracyOf(3, 5)).toBe(0.6);
    expect(hardAccuracyOf(5, 5)).toBe(1);
  });

  it('is 0 when no hard rounds were played', () => {
    expect(hardAccuracyOf(0, 0)).toBe(0);
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

describe('speedScoreOf', () => {
  it('is 1 when answering instantly', () => {
    expect(speedScoreOf(0, 1500)).toBe(1);
  });

  it('is ~0 when answering very slowly', () => {
    expect(speedScoreOf(20_000, 1500)).toBeCloseTo(0, 1);
  });

  it('scales linearly in between', () => {
    const mid = speedScoreOf(2500, 5000);
    expect(mid).toBeCloseTo(0.5, 5);
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.6);
  });
});

describe('normalizeSpatialGridNavResult (documented formula)', () => {
  it('scores a perfect instant run at 0.8 when no hard rounds were played', () => {
    const normalized = normalizeSpatialGridNavResult(
      rawResult({
        roundsPlayed: 5,
        correctPicks: 5,
        averageResponseMs: 0,
        hardPlayed: 0,
        hardCorrect: 0,
        speedTargetMs: 5000,
        accuracy: 1,
      }),
      { gameId: 'spatial-grid-nav', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBeCloseTo(0.8, 5);
  });

  it('is 0 when no round was passed', () => {
    const normalized = normalizeSpatialGridNavResult(
      rawResult({ roundsPlayed: 5, correctPicks: 0 }),
      { gameId: 'spatial-grid-nav', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(0);
  });

  it('rewards speed and hard-round accuracy at perfect accuracy', () => {
    const fast = normalizeSpatialGridNavResult(
      rawResult({
        roundsPlayed: 5,
        correctPicks: 5,
        averageResponseMs: 100,
        hardPlayed: 5,
        hardCorrect: 5,
        speedTargetMs: 5000,
        accuracy: 1,
      }),
      { gameId: 'spatial-grid-nav', difficulty: 'normal', durationMs: 0 },
    );
    const slow = normalizeSpatialGridNavResult(
      rawResult({
        roundsPlayed: 5,
        correctPicks: 5,
        averageResponseMs: 10_000,
        hardPlayed: 5,
        hardCorrect: 0,
        speedTargetMs: 5000,
        accuracy: 1,
      }),
      { gameId: 'spatial-grid-nav', difficulty: 'normal', durationMs: 0 },
    );
    expect(fast.value).toBeGreaterThan(slow.value);
    expect(fast.value).toBeLessThanOrEqual(1);
  });

  it('never exceeds 1', () => {
    const normalized = normalizeSpatialGridNavResult(
      rawResult({
        roundsPlayed: 5,
        correctPicks: 5,
        averageResponseMs: 0,
        hardPlayed: 5,
        hardCorrect: 5,
        speedTargetMs: 5000,
        accuracy: 1,
      }),
      { gameId: 'spatial-grid-nav', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBeLessThanOrEqual(1);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const raw = rawResult({ roundsPlayed: 1, correctPicks: 1 });
    const normalized = normalizeSpatialGridNavResult(raw, {
      gameId: 'spatial-grid-nav',
      difficulty: 'normal',
      durationMs: 0,
    });
    expect(normalized.raw).toEqual(expect.objectContaining({ seed: 's', difficulty: 'normal' }));
  });

  it('is reachable through the exported normalizer instance', () => {
    expect(spatialGridNavPerformanceNormalizer.gameId).toBe('spatial-grid-nav');
    expect(spatialGridNavPerformanceNormalizer.normalize).toBe(normalizeSpatialGridNavResult);
  });
});
