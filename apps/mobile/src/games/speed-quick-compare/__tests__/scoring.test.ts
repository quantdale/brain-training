// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import type { NormalizedPerformance } from '@/sdk';

import {
  accuracyOf,
  answerSpeed,
  applyRoundOutcome,
  bestOf,
  clamp01,
  correctPoints,
  meanOf,
  meanSpeedOf,
  normalizeQuickCompareResult,
  perfectSessionScore,
} from '../scoring';
import { buildQuickCompareRawResult } from '../session';
import { QUICK_COMPARE_DIFFICULTY_PARAMS } from '../difficulty';
import type { QuickCompareStats } from '../types';

describe('clamp01', () => {
  it('clamps to [0, 1] and rejects non-finite input', () => {
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(5)).toBe(1);
    expect(() => clamp01(NaN)).toThrow();
    expect(() => clamp01(Infinity)).toThrow();
  });
});

describe('answerSpeed / correctPoints', () => {
  it('maps reaction time to a 0..1 window fraction', () => {
    expect(answerSpeed(1000, 0)).toBe(1);
    expect(answerSpeed(1000, 1000)).toBe(0);
    expect(answerSpeed(1000, 500)).toBeCloseTo(0.5);
  });

  it('rewards an instant correct answer and a deadline answer', () => {
    expect(correctPoints(1000, 0)).toBe(150);
    expect(correctPoints(1000, 1000)).toBe(100);
    expect(correctPoints(1000, 500)).toBeCloseTo(125);
  });

  it('throws on a non-positive window', () => {
    expect(() => answerSpeed(0, 0)).toThrow();
  });
});

describe('aggregate helpers', () => {
  it('accuracyOf divides correct by total', () => {
    expect(accuracyOf(8, 10)).toBeCloseTo(0.8);
    expect(accuracyOf(0, 0)).toBe(0);
  });

  it('meanOf / bestOf handle empty lists', () => {
    expect(meanOf([])).toBeNull();
    expect(bestOf([])).toBeNull();
    expect(meanOf([2, 4, 6])).toBe(4);
    expect(bestOf([2, 4, 6])).toBe(2);
  });

  it('meanSpeedOf falls back to 0 with no factors', () => {
    expect(meanSpeedOf([])).toBe(0);
    expect(meanSpeedOf([1, 0.5])).toBeCloseTo(0.75);
  });

  it('perfectSessionScore is rounds * 150', () => {
    expect(perfectSessionScore(QUICK_COMPARE_DIFFICULTY_PARAMS.normal)).toBe(10 * 150);
  });
});

describe('applyRoundOutcome', () => {
  const base: QuickCompareStats = {
    score: 0,
    roundsTotal: 8,
    roundsCorrect: 0,
    roundsWrong: 0,
    roundsMissed: 0,
    reactions: [],
    speedFactors: [],
    bestStreak: 0,
    streak: 0,
  };

  it('folds a correct answer into score, streak, and speed factor', () => {
    const next = applyRoundOutcome(base, 'correct', 1000, 200);
    expect(next.roundsCorrect).toBe(1);
    expect(next.score).toBeCloseTo(100 + 50 * 0.8);
    expect(next.streak).toBe(1);
    expect(next.bestStreak).toBe(1);
    expect(next.reactions).toEqual([200]);
    expect(next.speedFactors[0]).toBeCloseTo(0.8);
  });

  it('breaks the streak on a wrong answer but still records the reaction', () => {
    const next = applyRoundOutcome({ ...base, streak: 4 }, 'incorrect', 1000, 400);
    expect(next.roundsWrong).toBe(1);
    expect(next.streak).toBe(0);
    expect(next.reactions).toEqual([400]);
    expect(next.score).toBe(0);
  });

  it('counts a miss without a reaction', () => {
    const next = applyRoundOutcome(base, 'miss', 1000, 1000);
    expect(next.roundsMissed).toBe(1);
    expect(next.reactions).toEqual([]);
    expect(next.streak).toBe(0);
  });
});

describe('normalizeQuickCompareResult', () => {
  function raw(overrides: Partial<Parameters<typeof buildQuickCompareRawResult>[0]>): ReturnType<typeof buildQuickCompareRawResult> {
    const full = buildQuickCompareRawResult({
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: '1.0.0',
      difficulty: 'normal',
      params: QUICK_COMPARE_DIFFICULTY_PARAMS.normal,
      challengeRating: 0.5,
      seed: '42',
      stats: {
        score: 0,
        roundsTotal: 10,
        roundsCorrect: 0,
        roundsWrong: 0,
        roundsMissed: 0,
        reactions: [],
        speedFactors: [],
        bestStreak: 0,
        streak: 0,
      },
      windowMs: 2200,
      forced: false,
      startedAtMs: 1000,
      activeDurationMs: 30000,
      pausedDurationMs: 0,
      ...overrides,
    });
    return full;
  }

  it('returns 1.0 for a perfect, instant session', () => {
    const result: NormalizedPerformance = normalizeQuickCompareResult(
      raw({
        stats: {
          score: 1500,
          roundsTotal: 10,
          roundsCorrect: 10,
          roundsWrong: 0,
          roundsMissed: 0,
          reactions: Array(10).fill(0),
          speedFactors: Array(10).fill(1),
          bestStreak: 10,
          streak: 10,
        },
      }),
      { gameId: 'speed-quick-compare', difficulty: 'normal', durationMs: 30000 },
    );
    expect(result.value).toBe(1);
    expect(result.scale).toBe('0..1');
  });

  it('returns 0 for an all-missed session', () => {
    const result = normalizeQuickCompareResult(
      raw({
        stats: {
          score: 0,
          roundsTotal: 10,
          roundsCorrect: 0,
          roundsWrong: 0,
          roundsMissed: 10,
          reactions: [],
          speedFactors: [],
          bestStreak: 0,
          streak: 0,
        },
      }),
      { gameId: 'speed-quick-compare', difficulty: 'normal', durationMs: 30000 },
    );
    expect(result.value).toBe(0);
  });

  it('weights accuracy and speed multiplicatively', () => {
    // 50% accuracy, average speed factor 0.5 → 0.5 * (0.5 + 0.5*0.5) = 0.375
    const result = normalizeQuickCompareResult(
      raw({
        stats: {
          score: 750,
          roundsTotal: 10,
          roundsCorrect: 5,
          roundsWrong: 5,
          roundsMissed: 0,
          reactions: Array(10).fill(500),
          speedFactors: Array(10).fill(0.5),
          bestStreak: 5,
          streak: 0,
        },
      }),
      { gameId: 'speed-quick-compare', difficulty: 'normal', durationMs: 30000 },
    );
    expect(result.value).toBeCloseTo(0.375);
  });

  it('never folds difficulty into the normalized value', () => {
    const easy = normalizeQuickCompareResult(
      raw({}),
      { gameId: 'speed-quick-compare', difficulty: 'easy', durationMs: 30000 },
    );
    const expert = normalizeQuickCompareResult(
      raw({}),
      { gameId: 'speed-quick-compare', difficulty: 'expert', durationMs: 30000 },
    );
    expect(easy.value).toBe(expert.value);
  });
});
