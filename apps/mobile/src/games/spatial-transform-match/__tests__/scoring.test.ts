// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  ANSWER_SPEED_WINDOW_MS,
  CORRECT_POINTS,
  MAX_ROUND_SCORE,
  SPEED_BONUS,
  accuracyOf,
  answerSpeedTargetMs,
  clamp01,
  normalizeResult,
  perfectSessionScore,
  roundScore,
  speedProgress,
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

describe('roundScore (documented formula)', () => {
  it('awards nothing for a wrong answer', () => {
    expect(roundScore(false, 0, 1500)).toBe(0);
    expect(roundScore(false, 60_000, 1500)).toBe(0);
  });

  it('pays base + full speed bonus for an instant correct answer', () => {
    expect(roundScore(true, 0, 1500)).toBe(MAX_ROUND_SCORE);
    expect(MAX_ROUND_SCORE).toBe(CORRECT_POINTS + SPEED_BONUS);
    expect(MAX_ROUND_SCORE).toBe(150);
  });

  it('decays the speed bonus linearly on the shared revealMs + 10s basis', () => {
    // normal reveals for 1500ms ⇒ the speed window is 11_500ms.
    expect(roundScore(true, 2875, 1500)).toBeCloseTo(CORRECT_POINTS + SPEED_BONUS * 0.75, 10);
    expect(roundScore(true, 5750, 1500)).toBe(CORRECT_POINTS + SPEED_BONUS / 2); // half window
    expect(roundScore(true, 11_500, 1500)).toBe(CORRECT_POINTS); // at target
    expect(roundScore(true, 120_000, 1500)).toBe(CORRECT_POINTS); // clamped, never below base
  });
});

describe('answerSpeedTargetMs', () => {
  it('adds the shared 10s answer window to the reveal time', () => {
    expect(answerSpeedTargetMs(1500)).toBe(11_500);
    expect(answerSpeedTargetMs(0)).toBe(ANSWER_SPEED_WINDOW_MS);
  });

  it('keeps raw scoring on the same basis normalization rewards', () => {
    // Campaign 014: the flat roundScore() previously had no speed component at
    // all; it must mirror the sibling games' revealMs + 10s contract.
    const reveal = DIFFICULTY_PARAMS.normal.sourceRevealMs;
    const fastAnswer = 2500;
    expect(roundScore(true, fastAnswer, reveal)).toBeGreaterThan(CORRECT_POINTS);
    expect(speedProgress(fastAnswer, reveal)).toBe(
      clamp01(1 - fastAnswer / (reveal + ANSWER_SPEED_WINDOW_MS)),
    );
  });
});

describe('perfectSessionScore', () => {
  it('sums max-round scores (base + full speed bonus) for a perfect run', () => {
    expect(perfectSessionScore(DIFFICULTY_PARAMS.easy)).toBe(4 * MAX_ROUND_SCORE);
    expect(perfectSessionScore(DIFFICULTY_PARAMS.normal)).toBe(5 * MAX_ROUND_SCORE);
    expect(perfectSessionScore(DIFFICULTY_PARAMS.expert)).toBe(7 * MAX_ROUND_SCORE);
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
