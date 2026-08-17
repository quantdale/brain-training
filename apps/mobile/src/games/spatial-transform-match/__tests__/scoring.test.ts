// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  accuracyOf,
  clamp01,
  normalizeResult,
  perfectSessionScore,
  roundScore,
  speedProgress,
  CORRECT_POINTS,
} from '../scoring';
import { DIFFICULTY_PARAMS } from '../difficulty';
import type { SpatialTransformMatchRawResult } from '../types';

function rawResult(overrides: Partial<SpatialTransformMatchRawResult> = {}): SpatialTransformMatchRawResult {
  return {
    score: 0,
    totalRounds: 5,
    roundsPlayed: 0,
    roundsPassed: 0,
    accuracy: 0,
    averageAnswerMs: 0,
    bestStreak: 0,
    gridSize: 9,
    filledCells: 4,
    sourceRevealMs: 1500,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {
      gameId: 'spatial-transform-match',
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
  it('awards CORRECT_POINTS for a correct answer', () => {
    expect(roundScore()).toBe(CORRECT_POINTS);
    expect(roundScore()).toBe(100);
  });
});

describe('perfectSessionScore', () => {
  it('sums round scores for a perfect run', () => {
    expect(perfectSessionScore(DIFFICULTY_PARAMS.easy)).toBe(4 * 100);
    expect(perfectSessionScore(DIFFICULTY_PARAMS.normal)).toBe(5 * 100);
    expect(perfectSessionScore(DIFFICULTY_PARAMS.expert)).toBe(7 * 100);
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

describe('speedProgress', () => {
  it('is 1 when answering instantly', () => {
    expect(speedProgress(0, 1500)).toBe(1);
  });

  it('is ~0 when answering very slowly', () => {
    expect(speedProgress(20_000, 1500)).toBeCloseTo(0, 1);
  });

  it('scales linearly in between', () => {
    const mid = speedProgress(5000, 1500);
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
  });
});

describe('normalizeResult (documented formula)', () => {
  it('scores a perfect fast run high', () => {
    const normalized = normalizeResult(
      rawResult({
        roundsPlayed: 5,
        roundsPassed: 5,
        averageAnswerMs: 500,
        bestStreak: 5,
        accuracy: 1,
      }),
      { gameId: 'spatial-transform-match', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.scale).toBe('0..1');
    expect(normalized.value).toBeGreaterThan(0.8);
    expect(normalized.value).toBeLessThanOrEqual(1);
  });

  it('is 0 when no round was passed', () => {
    const normalized = normalizeResult(
      rawResult({ roundsPlayed: 5, roundsPassed: 0 }),
      { gameId: 'spatial-transform-match', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(0);
  });

  it('rewards speed at perfect accuracy', () => {
    const fast = normalizeResult(
      rawResult({ roundsPlayed: 5, roundsPassed: 5, averageAnswerMs: 100, accuracy: 1 }),
      { gameId: 'spatial-transform-match', difficulty: 'normal', durationMs: 0 },
    );
    const slow = normalizeResult(
      rawResult({ roundsPlayed: 5, roundsPassed: 5, averageAnswerMs: 10_000, accuracy: 1 }),
      { gameId: 'spatial-transform-match', difficulty: 'normal', durationMs: 0 },
    );
    expect(fast.value).toBeGreaterThan(slow.value);
  });

  it('never exceeds 1', () => {
    const normalized = normalizeResult(
      rawResult({
        roundsPlayed: 5,
        roundsPassed: 5,
        averageAnswerMs: 0,
        accuracy: 1,
      }),
      { gameId: 'spatial-transform-match', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBeLessThanOrEqual(1);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const raw = rawResult({ roundsPlayed: 1, roundsPassed: 1 });
    const normalized = normalizeResult(raw, {
      gameId: 'spatial-transform-match',
      difficulty: 'normal',
      durationMs: 0,
    });
    expect(normalized.raw).toEqual(expect.objectContaining({ seed: 's', difficulty: 'normal' }));
  });
});
