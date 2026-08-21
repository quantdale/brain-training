// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  BASE_POINTS,
  MAX_SPEED_BONUS,
  PERFECT_ROUND_SCORE,
  accuracyOf,
  clamp01,
  normalizeSpatialCoordinateTurnResult,
  perfectSessionScore,
  roundScore,
  speedScoreOf,
  spatialCoordinateTurnPerformanceNormalizer,
} from '../scoring';
import { DIFFICULTY_PARAMS } from '../difficulty';
import { GAME_ID } from '../types';
import type { SpatialCoordinateTurnRawResult } from '../types';

function raw(overrides: Partial<SpatialCoordinateTurnRawResult> = {}): SpatialCoordinateTurnRawResult {
  return {
    score: 0,
    totalRounds: 10,
    roundsPlayed: 10,
    correctPicks: 10,
    mistakes: 0,
    accuracy: 1,
    bestStreak: 10,
    totalResponseMs: 0,
    scoredPicks: 10,
    averageResponseMs: 0,
    speedScore: 1,
    positionTrials: 0,
    positionCorrect: 0,
    directions: 4,
    rounds: 10,
    minSteps: 3,
    maxSteps: 4,
    moveMax: 3,
    askPosition: false,
    speedTargetMs: 5000,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {} as SpatialCoordinateTurnRawResult['diagnosticMetadata'],
    ...overrides,
  };
}

describe('roundScore', () => {
  it('scores a wrong answer as zero regardless of speed', () => {
    expect(roundScore(false, 0, 5000)).toBe(0);
    expect(roundScore(false, 100_000, 5000)).toBe(0);
  });

  it('rewards instant answers with the full speed bonus', () => {
    expect(roundScore(true, 0, 5000)).toBe(BASE_POINTS + MAX_SPEED_BONUS);
    expect(PERFECT_ROUND_SCORE).toBe(BASE_POINTS + MAX_SPEED_BONUS);
  });

  it('decays linearly to the base points at the speed target', () => {
    expect(roundScore(true, 2500, 5000)).toBe(BASE_POINTS + MAX_SPEED_BONUS / 2); // half window
    expect(roundScore(true, 5000, 5000)).toBe(BASE_POINTS); // at target
  });

  it('clamps slow answers at the base points (never below)', () => {
    expect(roundScore(true, 50_000, 5000)).toBe(BASE_POINTS);
  });
});

describe('perfectSessionScore', () => {
  it('sums the per-round maximum for every level', () => {
    expect(perfectSessionScore(DIFFICULTY_PARAMS.easy)).toBe(8 * PERFECT_ROUND_SCORE);
    expect(perfectSessionScore(DIFFICULTY_PARAMS.normal)).toBe(10 * PERFECT_ROUND_SCORE);
    expect(perfectSessionScore(DIFFICULTY_PARAMS.hard)).toBe(10 * PERFECT_ROUND_SCORE);
    expect(perfectSessionScore(DIFFICULTY_PARAMS.expert)).toBe(12 * PERFECT_ROUND_SCORE);
  });
});

describe('accuracyOf', () => {
  it('is 0 with no rounds and divides correctly otherwise', () => {
    expect(accuracyOf(0, 0)).toBe(0);
    expect(accuracyOf(3, 5)).toBeCloseTo(0.6);
    expect(accuracyOf(10, 10)).toBe(1);
  });
});

describe('speedScoreOf', () => {
  it('maps the response window into [0, 1]', () => {
    expect(speedScoreOf(0, 5000)).toBe(1);
    expect(speedScoreOf(2500, 5000)).toBeCloseTo(0.5);
    expect(speedScoreOf(5000, 5000)).toBe(0);
  });

  it('clamps beyond both ends of the window', () => {
    expect(speedScoreOf(-100, 5000)).toBe(1); // faster than instant
    expect(speedScoreOf(99_999, 5000)).toBe(0);
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

describe('normalizeSpatialCoordinateTurnResult', () => {
  const context = { gameId: GAME_ID, difficulty: 'normal' as const, durationMs: 1000 };

  it('yields 1 for a perfect session (all correct + instant)', () => {
    const perfect = normalizeSpatialCoordinateTurnResult(raw(), context);
    expect(perfect.value).toBe(1);
    expect(perfect.scale).toBe('0..1');
  });

  it('yields 0 when nothing was answered correctly', () => {
    const zero = normalizeSpatialCoordinateTurnResult(
      raw({ correctPicks: 0, accuracy: 0 }),
      context,
    );
    expect(zero.value).toBe(0);
  });

  it('lets speed contribute up to 30% on top of accuracy', () => {
    // Half accuracy, instant answers → 0.5 * 1.0 = 0.5.
    const half = normalizeSpatialCoordinateTurnResult(
      raw({ correctPicks: 5, accuracy: 0.5 }),
      context,
    );
    expect(half.value).toBeCloseTo(0.5);

    // Half accuracy, answers exactly at the speed target → 0.5 * 0.7 = 0.35.
    const slow = normalizeSpatialCoordinateTurnResult(
      raw({ correctPicks: 5, accuracy: 0.5, averageResponseMs: 5000, speedScore: 0 }),
      context,
    );
    expect(slow.value).toBeCloseTo(0.35);
  });

  it('stays within [0, 1] for extreme inputs', () => {
    const extreme = normalizeSpatialCoordinateTurnResult(
      raw({ correctPicks: 10, accuracy: 1, averageResponseMs: -5000, speedScore: 2 }),
      context,
    );
    expect(extreme.value).toBeLessThanOrEqual(1);
    expect(extreme.value).toBeGreaterThanOrEqual(0);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const result = normalizeSpatialCoordinateTurnResult(raw({ seed: 'diag' }), context);
    expect((result.raw as SpatialCoordinateTurnRawResult).seed).toBe('diag');
  });

  it('exposes an SDK-conformant normalizer bound to the game id', () => {
    expect(spatialCoordinateTurnPerformanceNormalizer.gameId).toBe(GAME_ID);
    const viaSdk = spatialCoordinateTurnPerformanceNormalizer.normalize(raw(), context);
    expect(viaSdk.value).toBe(1);
  });
});
