// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  accuracyOf,
  bestOf,
  clamp01,
  hitPoints,
  meanOf,
  meanSpeedOf,
  normalizeTapRushResult,
  perfectRoundBonus,
  perfectSessionScore,
  speedFactor,
} from '../scoring';
import { TAP_RUSH_DIFFICULTY_PARAMS } from '../difficulty';
import type { TapRushRawResult } from '../types';

describe('speedFactor', () => {
  it('is 1 for an instant tap and 0 exactly at the deadline', () => {
    expect(speedFactor(1100, 0)).toBe(1);
    expect(speedFactor(1100, 1100)).toBe(0);
  });

  it('scales linearly in between', () => {
    expect(speedFactor(1100, 550)).toBeCloseTo(0.5);
    expect(speedFactor(1100, 825)).toBeCloseTo(0.25);
  });

  it('clamps negative reactions (clock skew) to 1', () => {
    expect(speedFactor(1100, -50)).toBe(1);
  });

  it('rejects non-finite windows', () => {
    expect(() => speedFactor(0, 100)).toThrow(RangeError);
    expect(() => speedFactor(Number.NaN, 100)).toThrow(RangeError);
  });
});

describe('hitPoints', () => {
  it('awards 100 base points plus up to 50 speed bonus', () => {
    expect(hitPoints(1100, 1100)).toBe(100);
    expect(hitPoints(1100, 0)).toBe(150);
    expect(hitPoints(1100, 550)).toBeCloseTo(125);
  });
});

describe('perfectRoundBonus / perfectSessionScore', () => {
  it('adds 50 points per target for a perfect round', () => {
    expect(perfectRoundBonus(10)).toBe(500);
    expect(perfectRoundBonus(8)).toBe(400);
  });

  it('scores a perfect session at 200 points per target', () => {
    // normal: 4 rounds × 10 targets × 200
    expect(perfectSessionScore(TAP_RUSH_DIFFICULTY_PARAMS.normal)).toBe(8000);
    // easy: 3 rounds × 8 targets × 200
    expect(perfectSessionScore(TAP_RUSH_DIFFICULTY_PARAMS.easy)).toBe(4800);
  });
});

describe('accuracyOf', () => {
  it('computes the hit ratio over resolved targets', () => {
    expect(accuracyOf(8, 2)).toBe(0.8);
    expect(accuracyOf(10, 0)).toBe(1);
    expect(accuracyOf(0, 10)).toBe(0);
  });

  it('guards division by zero', () => {
    expect(accuracyOf(0, 0)).toBe(0);
  });
});

describe('meanOf / bestOf / meanSpeedOf', () => {
  it('meanOf averages and reports null for empty lists', () => {
    expect(meanOf([1, 2, 3])).toBe(2);
    expect(meanOf([])).toBeNull();
  });

  it('bestOf finds the smallest value and reports null for empty lists', () => {
    expect(bestOf([3, 1, 2])).toBe(1);
    expect(bestOf([])).toBeNull();
  });

  it('meanSpeedOf averages speed factors and returns 0 with no hits', () => {
    expect(meanSpeedOf([0.5, 1])).toBeCloseTo(0.75);
    expect(meanSpeedOf([])).toBe(0);
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

function rawResult(overrides: Partial<TapRushRawResult>): TapRushRawResult {
  return {
    score: 0,
    totalTargets: 40,
    targetsHit: 0,
    targetsMissed: 0,
    wrongTaps: 0,
    accuracy: 0,
    reactions: [],
    speedFactors: [],
    meanReactionMs: null,
    bestReactionMs: null,
    meanSpeed: 0,
    bestStreak: 0,
    perfectRounds: 0,
    roundsPlayed: 0,
    roundsPassed: 0,
    finalWindowMs: 1100,
    initialWindowMs: 1100,
    count: 10,
    targetRadius: 0.075,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {
      gameId: 'speed-tap-rush',
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

describe('normalizeTapRushResult (documented formula)', () => {
  it('reaches 1.0 for a perfect session with instant taps', () => {
    const normalized = normalizeTapRushResult(
      rawResult({
        targetsHit: 40,
        targetsMissed: 0,
        accuracy: 1,
        reactions: Array.from({ length: 40 }, () => 0),
        speedFactors: Array.from({ length: 40 }, () => 1),
        meanSpeed: 1,
      }),
      { gameId: 'speed-tap-rush', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.scale).toBe('0..1');
    expect(normalized.value).toBe(1);
  });

  it('is 0 when nothing was hit', () => {
    const normalized = normalizeTapRushResult(
      rawResult({ targetsHit: 0, targetsMissed: 10, accuracy: 0 }),
      { gameId: 'speed-tap-rush', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(0);
  });

  it('blends accuracy (0.6) with mean speed (0.4)', () => {
    // 8/10 hits at speed 0.5 → 0.6 * 0.8 + 0.4 * 0.5 = 0.68
    const normalized = normalizeTapRushResult(
      rawResult({
        targetsHit: 8,
        targetsMissed: 2,
        accuracy: 0.8,
        speedFactors: [0.5],
        meanSpeed: 0.5,
      }),
      { gameId: 'speed-tap-rush', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBeCloseTo(0.68);
  });

  it('caps accuracy-only value below 1 when taps are slow', () => {
    // perfect accuracy but every tap at the deadline → 0.6 * 1 + 0.4 * 0 = 0.6
    const normalized = normalizeTapRushResult(
      rawResult({
        targetsHit: 10,
        targetsMissed: 0,
        accuracy: 1,
        speedFactors: Array.from({ length: 10 }, () => 0),
        meanSpeed: 0,
      }),
      { gameId: 'speed-tap-rush', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBeCloseTo(0.6);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const raw = rawResult({ targetsHit: 1, targetsMissed: 0, accuracy: 1 });
    const normalized = normalizeTapRushResult(raw, {
      gameId: 'speed-tap-rush',
      difficulty: 'normal',
      durationMs: 0,
    });
    expect(normalized.raw).toEqual(expect.objectContaining({ seed: 's', difficulty: 'normal' }));
  });
});