// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  MAX_SPEED_BONUS_POINTS,
  PERFECT_RESPONSE_MS,
  accuracyOf,
  clamp01,
  flipBonusFactor,
  normalizeColorStroopResult,
  perfectSessionScore,
  speedBonus,
  speedBonusPoints,
  trialScore,
} from '../scoring';
import { ADAPTIVE_PARAMS, COLOR_STROOP_DIFFICULTY_PARAMS } from '../difficulty';
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
    const fast = trialScore(300, COLOR_STROOP_DIFFICULTY_PARAMS.normal.stimulusMs, false);
    const slow = trialScore(1400, COLOR_STROOP_DIFFICULTY_PARAMS.normal.stimulusMs, false);
    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBeGreaterThanOrEqual(100);
  });

  it('adds post-flip bonus when applicable', () => {
    const stimulusMs = COLOR_STROOP_DIFFICULTY_PARAMS.normal.stimulusMs;
    expect(trialScore(500, stimulusMs, true)).toBe(trialScore(500, stimulusMs, false) + 25);
  });

  it('never drops below base at or beyond the window edge', () => {
    const stimulusMs = COLOR_STROOP_DIFFICULTY_PARAMS.easy.stimulusMs;
    expect(trialScore(stimulusMs, stimulusMs, false)).toBe(100);
    expect(trialScore(5000, stimulusMs, false)).toBe(100);
  });

  it('reaches the bonus ceiling on instant answers for EVERY level', () => {
    // Campaign 014 regression guard: the bonus is normalized against each
    // level's own stimulus window (easy 2000 … expert 1000 ms), so an instant
    // answer always earns the full bonus and the window edge always earns 0.
    const levels = { ...COLOR_STROOP_DIFFICULTY_PARAMS, adaptive: ADAPTIVE_PARAMS };
    for (const [, params] of Object.entries(levels)) {
      expect(trialScore(0, params.stimulusMs, false)).toBe(100 + MAX_SPEED_BONUS_POINTS);
      expect(trialScore(params.stimulusMs, params.stimulusMs, false)).toBe(100);
      expect(speedBonusPoints(0, params.stimulusMs)).toBe(MAX_SPEED_BONUS_POINTS);
      expect(speedBonusPoints(params.stimulusMs, params.stimulusMs)).toBe(0);
      // Monotonic within the window: halfway earns roughly half the bonus.
      expect(speedBonusPoints(Math.floor(params.stimulusMs / 2), params.stimulusMs)).toBe(
        Math.round(MAX_SPEED_BONUS_POINTS / 2),
      );
    }
  });

  it('rejects a non-positive stimulus window', () => {
    expect(() => speedBonusPoints(100, 0)).toThrow(RangeError);
    expect(() => speedBonusPoints(100, -5)).toThrow(RangeError);
  });
});

describe('perfectSessionScore', () => {
  it('computes expected perfect score for a session', () => {
    const score = perfectSessionScore(COLOR_STROOP_DIFFICULTY_PARAMS.normal, 3);
    // 15 trials × (100 base + speed bonus + occasional flip bonus)
    expect(score).toBeGreaterThan(15 * 100);
  });

  it('is arithmetically coherent with per-trial scoring on every level', () => {
    // Same formula, same constants: perfect total == sum of trialScore calls
    // at the canonical reference RT over the session's flip schedule.
    const levels = { ...COLOR_STROOP_DIFFICULTY_PARAMS, adaptive: ADAPTIVE_PARAMS };
    for (const params of Object.values(levels)) {
      let flips = 0;
      let expected = 0;
      for (let i = 0; i < params.trials; i += 1) {
        const isPostFlip = i > 0 && i % params.flipFrequency === 0;
        if (isPostFlip) flips += 1;
        expected += trialScore(PERFECT_RESPONSE_MS, params.stimulusMs, isPostFlip);
      }
      expect(perfectSessionScore(params, flips)).toBe(expected);
      // The reference pace keeps a real bonus component on every level.
      expect(perfectSessionScore(params, flips)).toBeGreaterThan(params.trials * 100);
    }
  });

  it('normal expert session has the exact documented arithmetic', () => {
    // normal: stimulusMs=1500 → speedBonus(300) = round(50 × 1200/1500) = 40.
    // 15 trials, flips at i = 4, 8, 12 → 3 flip bonuses.
    expect(perfectSessionScore(COLOR_STROOP_DIFFICULTY_PARAMS.normal, 3)).toBe(
      15 * (100 + 40) + 3 * 25,
    );
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

  it('reaches exactly 1.0 for a perfect run when totalFlips is recorded', () => {
    // Regression: the flip denominator was hardcoded to floor(totalTrials / 4),
    // which ignores flipFrequency and made a perfect run unreachable on most
    // difficulties (e.g. easy: 1 actual flip vs denominator 2).
    const raw = rawResult({
      totalTrials: 10,
      trialsPlayed: 10,
      correctTrials: 10,
      bestStreak: 10,
      postFlipCorrect: 1,
      totalFlips: 1,
      avgResponseTimeMs: 0,
      accuracy: 1,
    });
    const normalized = normalizeColorStroopResult(raw, {
      gameId: 'flexibility-color-stroop',
      difficulty: 'easy',
      durationMs: 0,
    });
    expect(normalized.value).toBe(1);
  });

  it('falls back to the legacy floor(totalTrials / 4) estimate without totalFlips', () => {
    // Records persisted before `totalFlips` existed must keep normalizing.
    const withField = normalizeColorStroopResult(
      rawResult({
        trialsPlayed: 15,
        correctTrials: 15,
        postFlipCorrect: 3,
        totalFlips: 3,
        avgResponseTimeMs: 0,
      }),
      { gameId: 'flexibility-color-stroop', difficulty: 'normal', durationMs: 0 },
    );
    const withoutField = normalizeColorStroopResult(
      rawResult({
        trialsPlayed: 15,
        correctTrials: 15,
        postFlipCorrect: 3,
        avgResponseTimeMs: 0,
      }),
      { gameId: 'flexibility-color-stroop', difficulty: 'normal', durationMs: 0 },
    );
    // floor(15 / 4) = 3 → identical result for this shape.
    expect(withoutField.value).toBe(withField.value);
  });
});