// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  accuracyOf,
  clamp01,
  normalizeSpeedColorMatchResult,
  speedFactor,
  streakFactor,
  streakBonus,
  trialScore,
} from '../scoring';
import type { SpeedColorMatchRawResult } from '../types';

function rawResult(overrides: Partial<SpeedColorMatchRawResult>): SpeedColorMatchRawResult {
  return {
    score: 0,
    totalTrials: 20,
    trialsPlayed: 0,
    trialsCorrect: 0,
    accuracy: 0,
    bestStreak: 0,
    avgReactionMs: 0,
    fastestReactionMs: Infinity,
    slowestReactionMs: 0,
    incongruentRatio: 0.4,
    stimulusTimeoutMs: 4_000,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {
      gameId: 'speed-color-match',
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

describe('trialScore', () => {
  it('awards 100 base points plus speed bonus', () => {
    expect(trialScore(0, 4_000)).toBe(150); // max speed bonus
    expect(trialScore(2_000, 4_000)).toBe(125); // 50% speed bonus
    expect(trialScore(4_000, 4_000)).toBe(100); // no speed bonus
  });

  it('never drops below 100', () => {
    expect(trialScore(10_000, 4_000)).toBe(100);
  });
});

describe('streakBonus', () => {
  it('returns streak × 10', () => {
    expect(streakBonus(0)).toBe(0);
    expect(streakBonus(1)).toBe(10);
    expect(streakBonus(5)).toBe(50);
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

describe('speedFactor', () => {
  it('maps reaction time to [0, 1] where 0ms → 1.0 and timeout → 0.0', () => {
    expect(speedFactor(0, 4_000)).toBe(1);
    expect(speedFactor(2_000, 4_000)).toBe(0.5);
    expect(speedFactor(4_000, 4_000)).toBe(0);
    expect(speedFactor(6_000, 4_000)).toBe(0); // clamped
  });
});

describe('streakFactor', () => {
  it('maps bestStreak / totalTrials into [0, 1]', () => {
    expect(streakFactor(0, 20)).toBe(0);
    expect(streakFactor(10, 20)).toBe(0.5);
    expect(streakFactor(20, 20)).toBe(1);
    expect(streakFactor(0, 0)).toBe(0);
  });
});

describe('normalizeSpeedColorMatchResult (documented formula)', () => {
  it('scores a perfect fast session high', () => {
    // accuracy 1, speedFactor ≈1 (1ms avg), streakFactor 1 (20/20)
    // 1 × (0.4 + 0.3×1 + 0.3×1) = 1 × 1.0 → clamped to 1.0
    const normalized = normalizeSpeedColorMatchResult(
      rawResult({
        trialsPlayed: 20,
        trialsCorrect: 20,
        bestStreak: 20,
        avgReactionMs: 1,
        stimulusTimeoutMs: 4_000,
      }),
      { gameId: 'speed-color-match', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.scale).toBe('0..1');
    expect(normalized.value).toBeCloseTo(1.0);
  });

  it('is 0 when no trial was correct', () => {
    const normalized = normalizeSpeedColorMatchResult(
      rawResult({ trialsPlayed: 20, trialsCorrect: 0 }),
      { gameId: 'speed-color-match', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(0);
  });

  it('rewards speed even at perfect accuracy', () => {
    const fast = normalizeSpeedColorMatchResult(
      rawResult({
        trialsPlayed: 20,
        trialsCorrect: 20,
        bestStreak: 10,
        avgReactionMs: 1,
        stimulusTimeoutMs: 4_000,
      }),
      { gameId: 'speed-color-match', difficulty: 'normal', durationMs: 0 },
    );
    const slow = normalizeSpeedColorMatchResult(
      rawResult({
        trialsPlayed: 20,
        trialsCorrect: 20,
        bestStreak: 10,
        avgReactionMs: 3_500,
        stimulusTimeoutMs: 4_000,
      }),
      { gameId: 'speed-color-match', difficulty: 'normal', durationMs: 0 },
    );
    expect(fast.value).toBeGreaterThan(slow.value);
  });

  it('never exceeds 1', () => {
    const normalized = normalizeSpeedColorMatchResult(
      rawResult({
        trialsPlayed: 20,
        trialsCorrect: 20,
        bestStreak: 20,
        avgReactionMs: 1,
        stimulusTimeoutMs: 4_000,
      }),
      { gameId: 'speed-color-match', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBeLessThanOrEqual(1);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const raw = rawResult({ trialsPlayed: 1, trialsCorrect: 1, avgReactionMs: 100 });
    const normalized = normalizeSpeedColorMatchResult(raw, {
      gameId: 'speed-color-match',
      difficulty: 'normal',
      durationMs: 0,
    });
    expect(normalized.raw).toEqual(expect.objectContaining({ seed: 's', difficulty: 'normal' }));
  });
});
