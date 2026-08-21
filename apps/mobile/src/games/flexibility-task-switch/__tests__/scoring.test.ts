// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import { flexibilityTaskSwitchPerformanceNormalizer, accuracyOf, clamp01, normalizeFlexibilityTaskSwitchResult, perfectSessionScore, roundScore, speedScoreOf, switchAccuracyOf } from '../scoring';
import { flexibilityTaskSwitchParamsFromProfile, resolveFlexibilityTaskSwitchDifficulty } from '../difficulty';
import { GAME_ID } from '../types';
import type { FlexibilityTaskSwitchRawResult } from '../types';

const NORMAL = flexibilityTaskSwitchParamsFromProfile(
  resolveFlexibilityTaskSwitchDifficulty('normal'),
);

function raw(overrides: Partial<FlexibilityTaskSwitchRawResult> = {}): FlexibilityTaskSwitchRawResult {
  return {
    score: 0,
    totalRounds: 12,
    roundsPlayed: 12,
    correctPicks: 12,
    mistakes: 0,
    accuracy: 1,
    bestStreak: 12,
    totalResponseMs: 0,
    scoredPicks: 12,
    speedScore: 1,
    switchPlayed: 6,
    switchCorrect: 6,
    switchAccuracy: 1,
    repeatPlayed: 6,
    repeatCorrect: 6,
    switchCostMs: 0,
    taskPool: ['parity', 'magnitude'],
    numColors: 3,
    numShapes: 3,
    numNumbers: 9,
    switchRate: 0.5,
    speedTargetMs: NORMAL.speedTargetMs,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {} as FlexibilityTaskSwitchRawResult['diagnosticMetadata'],
    ...overrides,
  };
}

describe('roundScore', () => {
  it('is 0 for a wrong answer regardless of speed', () => {
    expect(roundScore(false, 0, NORMAL.speedTargetMs)).toBe(0);
    expect(roundScore(false, 10_000, NORMAL.speedTargetMs)).toBe(0);
  });

  it('pays 100 base + up to 50 speed bonus for a correct answer', () => {
    expect(roundScore(true, 0, NORMAL.speedTargetMs)).toBe(150); // instant
    expect(roundScore(true, NORMAL.speedTargetMs / 2, NORMAL.speedTargetMs)).toBe(125);
    expect(roundScore(true, NORMAL.speedTargetMs, NORMAL.speedTargetMs)).toBe(100); // at target
    expect(roundScore(true, NORMAL.speedTargetMs * 5, NORMAL.speedTargetMs)).toBe(100); // clamped
  });
});

describe('perfectSessionScore', () => {
  it('is rounds × 150', () => {
    expect(perfectSessionScore(NORMAL)).toBe(12 * 150);
    expect(
      perfectSessionScore(flexibilityTaskSwitchParamsFromProfile(resolveFlexibilityTaskSwitchDifficulty('easy'))),
    ).toBe(10 * 150);
  });
});

describe('accuracyOf', () => {
  it('is 0 with no rounds and divides correctly otherwise', () => {
    expect(accuracyOf(0, 0)).toBe(0);
    expect(accuracyOf(3, 5)).toBeCloseTo(0.6);
  });
});

describe('speedScoreOf', () => {
  const target = NORMAL.speedTargetMs;
  it('is 0 when nothing was picked', () => {
    expect(speedScoreOf(0, 0, target)).toBe(0);
  });
  it('maps mean response time linearly into [0, 1]', () => {
    expect(speedScoreOf(0, 4, target)).toBe(1); // instant picks
    expect(speedScoreOf(target * 2, 4, target)).toBeCloseTo(0.5); // mean = target/2
    expect(speedScoreOf(target * 4, 4, target)).toBe(0); // mean exactly at target
    expect(speedScoreOf(target * 40, 4, target)).toBe(0); // far beyond target clamps to 0
  });
});

describe('switchAccuracyOf', () => {
  it('is 0 with no switch trials and divides correctly otherwise', () => {
    expect(switchAccuracyOf(0, 0)).toBe(0);
    expect(switchAccuracyOf(3, 4)).toBe(0.75);
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

describe('normalizeFlexibilityTaskSwitchResult', () => {
  const context = { gameId: GAME_ID, difficulty: 'normal' as const, durationMs: 1000 };

  it('gives a perfect instant switch-perfect run exactly 1', () => {
    const perfect = normalizeFlexibilityTaskSwitchResult(raw(), context);
    expect(perfect.value).toBeCloseTo(1);
    expect(perfect.scale).toBe('0..1');
  });

  it('is 0 when every pick was wrong', () => {
    const zero = normalizeFlexibilityTaskSwitchResult(
      raw({ correctPicks: 0, mistakes: 12, accuracy: 0, switchCorrect: 0, switchAccuracy: 0 }),
      context,
    );
    expect(zero.value).toBe(0);
  });

  it('weights accuracy 70%, switch accuracy up to 20%, speed up to 10%', () => {
    // Perfect accuracy but no switch data and slow picks: 1 × (0.7 + 0 + 0).
    const accOnly = normalizeFlexibilityTaskSwitchResult(
      raw({ totalResponseMs: 60_000, speedScore: 0, switchPlayed: 0, switchCorrect: 0, switchAccuracy: 0 }),
      context,
    );
    expect(accOnly.value).toBeCloseTo(0.7);

    // accuracy .8 × (0.7 + 0.2×.5 + 0.1×.5) = .8 × .85 = .68.
    const mixed = normalizeFlexibilityTaskSwitchResult(
      raw({
        roundsPlayed: 10,
        correctPicks: 8,
        accuracy: 0.8,
        switchPlayed: 4,
        switchCorrect: 2,
        switchAccuracy: 0.5,
        scoredPicks: 10,
        totalResponseMs: 22_500, // mean RT = 2250 = half of speedTargetMs
        speedScore: 0.5,
      }),
      context,
    );
    expect(mixed.value).toBeCloseTo(0.68);
  });

  it('never exceeds 1 even for out-of-range raw inputs', () => {
    const capped = normalizeFlexibilityTaskSwitchResult(
      raw({ totalResponseMs: -1000 }), // negative RT would push speed above 1 unclamped
      context,
    );
    expect(capped.value).toBeLessThanOrEqual(1);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const r = normalizeFlexibilityTaskSwitchResult(raw({ seed: 'diag' }), context);
    expect((r.raw as FlexibilityTaskSwitchRawResult).seed).toBe('diag');
  });

  it('exposes an SDK-conformant normalizer instance', () => {
    expect(flexibilityTaskSwitchPerformanceNormalizer.gameId).toBe(GAME_ID);
    const sample = raw();
    expect(flexibilityTaskSwitchPerformanceNormalizer.normalize(sample, context)).toEqual(
      normalizeFlexibilityTaskSwitchResult(sample, context),
    );
  });
});
