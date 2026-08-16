// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import { SPATIAL_DIFFICULTY_PARAMS } from '../difficulty';
import {
  accuracyOf,
  clamp01,
  normalizeSpatialResult,
  perfectSessionScore,
  roundScore,
  speedOf,
} from '../scoring';
import type { SpatialRawResult } from '../types';

function rawResult(overrides: Partial<SpatialRawResult>): SpatialRawResult {
  return {
    score: 0,
    totalRounds: 5,
    roundsPlayed: 0,
    roundsPassed: 0,
    accuracy: 0,
    speed: 0,
    bestStreak: 0,
    totalAnswers: 0,
    correctAnswers: 0,
    timeouts: 0,
    totalRemainingMs: 0,
    totalBudgetMs: 0,
    blocks: 4,
    angleMask: 10,
    timeBudgetMs: 16_000,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {
      gameId: 'spatial-mental-rotation',
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
  it('awards 100 base plus up to 50 speed bonus proportional to remaining budget', () => {
    expect(roundScore(16_000, 16_000)).toBe(150);
    expect(roundScore(16_000, 0)).toBe(100);
    expect(roundScore(16_000, 8_000)).toBe(125); // 100 + round(50 * 0.5)
    expect(roundScore(16_000, 15_000)).toBe(147); // 100 + round(46.875)
  });

  it('clamps a remaining budget above the budget (pause/resume edge)', () => {
    expect(roundScore(16_000, 20_000)).toBe(150);
  });

  it('rejects a non-positive budget', () => {
    expect(() => roundScore(0, 100)).toThrow(RangeError);
    expect(() => roundScore(Number.NaN, 100)).toThrow(RangeError);
  });
});

describe('perfectSessionScore', () => {
  it('sums instant-answer round scores for a perfect run', () => {
    // normal: 5 rounds × 150
    expect(perfectSessionScore(SPATIAL_DIFFICULTY_PARAMS.normal)).toBe(750);
    // easy: 4 rounds × 150
    expect(perfectSessionScore(SPATIAL_DIFFICULTY_PARAMS.easy)).toBe(600);
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

describe('speedOf', () => {
  it('computes the average remaining-budget share', () => {
    expect(speedOf(8_000, 16_000)).toBe(0.5);
    expect(speedOf(16_000, 16_000)).toBe(1);
    expect(speedOf(0, 16_000)).toBe(0);
  });

  it('clamps and guards division by zero', () => {
    expect(speedOf(20_000, 16_000)).toBe(1);
    expect(speedOf(0, 0)).toBe(0);
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

describe('normalizeSpatialResult (documented formula)', () => {
  it('scores a perfect fast run at 1.0', () => {
    const normalized = normalizeSpatialResult(
      rawResult({
        roundsPlayed: 5,
        roundsPassed: 5,
        accuracy: 1,
        totalRemainingMs: 80_000,
        totalBudgetMs: 80_000,
        speed: 1,
      }),
      { gameId: 'spatial-mental-rotation', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.scale).toBe('0..1');
    expect(normalized.value).toBe(1);
  });

  it('a perfect but slow run (full budget used) reaches only 0.5', () => {
    const normalized = normalizeSpatialResult(
      rawResult({
        roundsPlayed: 5,
        roundsPassed: 5,
        accuracy: 1,
        totalRemainingMs: 0,
        totalBudgetMs: 80_000,
        speed: 0,
      }),
      { gameId: 'spatial-mental-rotation', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(0.5);
  });

  it('is 0 when no round was passed', () => {
    const normalized = normalizeSpatialResult(
      rawResult({ roundsPlayed: 5, roundsPassed: 0, totalBudgetMs: 80_000 }),
      { gameId: 'spatial-mental-rotation', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(0);
  });

  it('blends accuracy and speed multiplicatively', () => {
    // accuracy 0.8, speed 0.5 → 0.8 * (0.5 + 0.25) = 0.6
    const normalized = normalizeSpatialResult(
      rawResult({
        roundsPlayed: 5,
        roundsPassed: 4,
        accuracy: 0.8,
        totalRemainingMs: 40_000,
        totalBudgetMs: 80_000,
        speed: 0.5,
      }),
      { gameId: 'spatial-mental-rotation', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBeCloseTo(0.6);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const raw = rawResult({ roundsPlayed: 1, roundsPassed: 1, totalBudgetMs: 16_000 });
    const normalized = normalizeSpatialResult(raw, {
      gameId: 'spatial-mental-rotation',
      difficulty: 'normal',
      durationMs: 0,
    });
    expect(normalized.raw).toEqual(expect.objectContaining({ seed: 's', difficulty: 'normal' }));
  });
});
