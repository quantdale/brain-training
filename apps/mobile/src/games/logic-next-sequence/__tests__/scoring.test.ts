// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  accuracyOf,
  clamp01,
  normalizeLogicResult,
  perfectSessionScore,
  roundScore,
  sessionSpeed,
  speedFactor,
} from '../scoring';
import { LOGIC_DIFFICULTY_PARAMS } from '../difficulty';
import type { LogicRawResult } from '../types';

function rawResult(overrides: Partial<LogicRawResult>): LogicRawResult {
  return {
    score: 0,
    totalRounds: 5,
    roundsPlayed: 0,
    roundsPassed: 0,
    accuracy: 0,
    bestStreak: 0,
    totalMs: 0,
    targetMs: 0,
    fastestMs: null,
    visibleLength: 4,
    recipeTier: 1,
    minValue: 0,
    maxValue: 250,
    referenceMs: 8000,
    finalTier: 1,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {
      gameId: 'logic-next-sequence',
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

describe('speedFactor', () => {
  it('caps at 1 for at-or-faster-than-reference responses', () => {
    expect(speedFactor(8000, 8000)).toBe(1);
    expect(speedFactor(4000, 8000)).toBe(1);
    expect(speedFactor(0, 8000)).toBe(1); // instantaneous (tests / QA)
  });

  it('scales down linearly below reference speed', () => {
    expect(speedFactor(16000, 8000)).toBe(0.5);
    expect(speedFactor(32000, 8000)).toBe(0.25);
  });
});

describe('roundScore', () => {
  it('awards 100 base plus up to 50 speed bonus on a correct answer', () => {
    expect(roundScore(8000, 8000, true)).toBe(150);
    expect(roundScore(4000, 8000, true)).toBe(150);
    expect(roundScore(16000, 8000, true)).toBe(125);
    expect(roundScore(32000, 8000, true)).toBe(113); // round(50 * 0.25)
    expect(roundScore(0, 8000, true)).toBe(150);
  });

  it('awards nothing on a wrong answer regardless of speed', () => {
    expect(roundScore(8000, 8000, false)).toBe(0);
    expect(roundScore(1, 8000, false)).toBe(0);
  });
});

describe('perfectSessionScore', () => {
  it('is rounds × 150 (base + max speed bonus)', () => {
    expect(perfectSessionScore(LOGIC_DIFFICULTY_PARAMS.easy)).toBe(600);
    expect(perfectSessionScore(LOGIC_DIFFICULTY_PARAMS.normal)).toBe(750);
    expect(perfectSessionScore(LOGIC_DIFFICULTY_PARAMS.hard)).toBe(900);
    expect(perfectSessionScore(LOGIC_DIFFICULTY_PARAMS.expert)).toBe(1050);
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

describe('sessionSpeed', () => {
  it('is 1 at or faster than the accumulated reference', () => {
    expect(sessionSpeed(40000, 20000)).toBe(1);
    expect(sessionSpeed(40000, 40000)).toBe(1);
    expect(sessionSpeed(40000, 0)).toBe(1); // nothing elapsed (QA-forced)
  });

  it('scales down linearly below reference speed', () => {
    expect(sessionSpeed(40000, 80000)).toBe(0.5);
    expect(sessionSpeed(40000, 160000)).toBe(0.25);
  });
});

describe('normalizeLogicResult (documented formula: accuracy × (0.6 + 0.4 × speed))', () => {
  it('scores a perfect fast run as 1', () => {
    const normalized = normalizeLogicResult(
      rawResult({
        roundsPlayed: 5,
        roundsPassed: 5,
        totalMs: 20000,
        targetMs: 40000,
        accuracy: 1,
      }),
      { gameId: 'logic-next-sequence', difficulty: 'normal', durationMs: 20000 },
    );
    expect(normalized.scale).toBe('0..1');
    expect(normalized.value).toBe(1);
  });

  it('is 0 when no round was passed (speed cannot rescue accuracy)', () => {
    const normalized = normalizeLogicResult(
      rawResult({ roundsPlayed: 5, roundsPassed: 0, totalMs: 20000, targetMs: 40000 }),
      { gameId: 'logic-next-sequence', difficulty: 'normal', durationMs: 20000 },
    );
    expect(normalized.value).toBe(0);
  });

  it('discounts a slow but perfect run', () => {
    // speed = 40000/80000 = 0.5 → 1 × (0.6 + 0.2) = 0.8
    const normalized = normalizeLogicResult(
      rawResult({ roundsPlayed: 5, roundsPassed: 5, totalMs: 80000, targetMs: 40000, accuracy: 1 }),
      { gameId: 'logic-next-sequence', difficulty: 'normal', durationMs: 80000 },
    );
    expect(normalized.value).toBeCloseTo(0.8);
  });

  it('blends accuracy with speed at mid performance', () => {
    // accuracy 0.5, speed 1 → 0.5
    const normalized = normalizeLogicResult(
      rawResult({ roundsPlayed: 6, roundsPassed: 3, totalMs: 20000, targetMs: 40000, accuracy: 0.5 }),
      { gameId: 'logic-next-sequence', difficulty: 'normal', durationMs: 20000 },
    );
    expect(normalized.value).toBe(0.5);
  });

  it('never exceeds 1 even with a negative speed baseline', () => {
    const normalized = normalizeLogicResult(
      rawResult({
        roundsPlayed: 5,
        roundsPassed: 5,
        totalMs: 0,
        targetMs: 0,
        accuracy: 1,
      }),
      { gameId: 'logic-next-sequence', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(1);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const raw = rawResult({ roundsPlayed: 1, roundsPassed: 1, totalMs: 8000, targetMs: 8000 });
    const normalized = normalizeLogicResult(raw, {
      gameId: 'logic-next-sequence',
      difficulty: 'normal',
      durationMs: 8000,
    });
    expect(normalized.raw).toEqual(
      expect.objectContaining({ seed: 's', difficulty: 'normal', finalTier: 1 }),
    );
  });
});
