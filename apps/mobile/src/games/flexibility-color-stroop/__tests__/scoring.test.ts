// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  accuracyOf,
  clamp01,
  flipBonusFactor,
  normalizeColorStroopResult,
  perfectSessionScore,
  speedBonus,
  trialScore,
} from '../scoring';
import { COLOR_STROOP_DIFFICULTY_PARAMS } from '../difficulty';
import type { ColorStroopRawResult } from '../types';

function rawResult(overrides: Partial<ColorStroopRawResult>): ColorStroopRawResult {
  return {
    score: 0,
    totalTrials: 15,
    trialsPlayed: 0,
    correctTrials: 0,
    accuracy: 0,
    bestStreak: 0,
    postFlipCorrect: 0,
    avgResponseTimeMs: 0,
    fastestResponseMs: 0,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {
      gameId: 'flexibility-color-stroop',
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
  it('awards base points plus speed bonus for correct answers', () => {
    const fast = trialScore(300, false);
    const slow = trialScore(1500, false);
    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBeGreaterThanOrEqual(100);
  });

  it('adds post-flip bonus when applicable', () => {
    const withFlip = trialScore(500, true);
    const withoutFlip = trialScore(500, false);
    expect(withFlip).toBe(withoutFlip + 25);
  });

  it('never drops below base for very slow responses', () => {
    expect(trialScore(5000, false)).toBeGreaterThanOrEqual(100);
  });
});

describe('perfectSessionScore', () => {
  it('computes expected perfect score for a session', () => {
    const score = perfectSessionScore(COLOR_STROOP_DIFFICULTY_PARAMS.normal, 3);
    // 15 trials × (100 base + speed bonus + occasional flip bonus)
    expect(score).toBeGreaterThan(15 * 100);
  });
});

describe('accuracyOf', () => {
  it('computes the correct ratio', () => {
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

describe('speedBonus', () => {
  it('returns higher values for faster responses', () => {
    expect(speedBonus(300)).toBeGreaterThan(speedBonus(1000));
    expect(speedBonus(1000)).toBeGreaterThan(speedBonus(2000));
  });

  it('clamps to [0, 1]', () => {
    expect(speedBonus(100)).toBe(1);
    expect(speedBonus(3000)).toBe(0);
  });
});

describe('flipBonusFactor', () => {
  it('returns higher values for more post-flip correct answers', () => {
    expect(flipBonusFactor(5, 5)).toBeGreaterThan(flipBonusFactor(2, 5));
  });

  it('returns 0.5 when no flips occurred', () => {
    expect(flipBonusFactor(0, 0)).toBe(0.5);
  });

  it('clamps to [0, 1]', () => {
    expect(flipBonusFactor(10, 5)).toBe(1);
  });
});

describe('normalizeColorStroopResult (documented formula)', () => {
  it('scores a perfect run high', () => {
    const normalized = normalizeColorStroopResult(
      rawResult({
        trialsPlayed: 15,
        correctTrials: 15,
        bestStreak: 15,
        postFlipCorrect: 4,
        avgResponseTimeMs: 500,
        accuracy: 1,
      }),
      { gameId: 'flexibility-color-stroop', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.scale).toBe('0..1');
    expect(normalized.value).toBeGreaterThan(0.5);
  });

  it('is low when no trial was correct', () => {
    const normalized = normalizeColorStroopResult(
      rawResult({ trialsPlayed: 15, correctTrials: 0 }),
      { gameId: 'flexibility-color-stroop', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(0);
  });

  it('never exceeds 1', () => {
    const normalized = normalizeColorStroopResult(
      rawResult({
        trialsPlayed: 15,
        correctTrials: 15,
        bestStreak: 15,
        postFlipCorrect: 4,
        avgResponseTimeMs: 200,
        accuracy: 1,
      }),
      { gameId: 'flexibility-color-stroop', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBeLessThanOrEqual(1);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const raw = rawResult({ trialsPlayed: 1, correctTrials: 1, avgResponseTimeMs: 500 });
    const normalized = normalizeColorStroopResult(raw, {
      gameId: 'flexibility-color-stroop',
      difficulty: 'normal',
      durationMs: 0,
    });
    expect(normalized.raw).toEqual(expect.objectContaining({ seed: 's', difficulty: 'normal' }));
  });
});