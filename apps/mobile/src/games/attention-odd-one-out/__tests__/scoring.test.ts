// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  FIRST_TRY_BONUS,
  ROUND_POINTS,
  WRONG_TAP_PENALTY,
  accuracyOf,
  avgSolveRatioOf,
  clamp01,
  firstTryRateOf,
  normalizeOddOneOutResult,
  perfectSessionScore,
  roundPoints,
  speedOf,
} from '../scoring';
import { ODD_ONE_OUT_DIFFICULTY_PARAMS } from '../difficulty';
import type { OddOneOutRawResult } from '../types';

function rawResult(overrides: Partial<OddOneOutRawResult>): OddOneOutRawResult {
  return {
    score: 0,
    totalRounds: 6,
    roundsPlayed: 0,
    roundsPassed: 0,
    firstTryCorrect: 0,
    wrongTaps: 0,
    timeouts: 0,
    accuracy: 0,
    firstTryRate: 0,
    avgSolveRatio: 0,
    bestStreak: 0,
    gridSize: 9,
    subtlety: 0,
    windowMs: 12_000,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {
      gameId: 'attention-odd-one-out',
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

describe('round / session points', () => {
  it('awards the base plus the first-try bonus (and the penalty constant is sane)', () => {
    expect(roundPoints(true)).toBe(ROUND_POINTS + FIRST_TRY_BONUS);
    expect(roundPoints(false)).toBe(ROUND_POINTS);
    expect(ROUND_POINTS).toBe(100);
    expect(FIRST_TRY_BONUS).toBe(25);
    expect(WRONG_TAP_PENALTY).toBe(25);
  });

  it('a perfect session scores rounds × 125', () => {
    expect(perfectSessionScore(ODD_ONE_OUT_DIFFICULTY_PARAMS.easy)).toBe(5 * 125);
    expect(perfectSessionScore(ODD_ONE_OUT_DIFFICULTY_PARAMS.normal)).toBe(6 * 125);
    expect(perfectSessionScore(ODD_ONE_OUT_DIFFICULTY_PARAMS.expert)).toBe(8 * 125);
  });
});

describe('accuracyOf / firstTryRateOf / avgSolveRatioOf', () => {
  it('computes the pass and first-try ratios', () => {
    expect(accuracyOf(3, 5)).toBe(0.6);
    expect(accuracyOf(5, 5)).toBe(1);
    expect(accuracyOf(0, 4)).toBe(0);
    expect(firstTryRateOf(2, 4)).toBe(0.5);
    expect(firstTryRateOf(4, 4)).toBe(1);
  });

  it('guards division by zero', () => {
    expect(accuracyOf(0, 0)).toBe(0);
    expect(firstTryRateOf(0, 0)).toBe(0);
    expect(avgSolveRatioOf(0, 0)).toBe(0);
  });

  it('averages solve ratios over passed rounds', () => {
    expect(avgSolveRatioOf(1.5, 3)).toBe(0.5);
    expect(avgSolveRatioOf(3, 3)).toBe(1);
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

describe('speedOf', () => {
  it('is 1 for instant solves and 0 at the full window', () => {
    expect(speedOf(0, 3)).toBe(1);
    expect(speedOf(3, 3)).toBe(0);
    expect(speedOf(1.5, 3)).toBe(0.5);
  });
});

describe('normalizeOddOneOutResult (documented formula)', () => {
  it('scores a perfect session (all first-try, instant) as 1', () => {
    const normalized = normalizeOddOneOutResult(
      rawResult({
        roundsPlayed: 6,
        roundsPassed: 6,
        firstTryCorrect: 6,
        avgSolveRatio: 0,
        accuracy: 1,
        firstTryRate: 1,
      }),
      { gameId: 'attention-odd-one-out', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.scale).toBe('0..1');
    expect(normalized.value).toBe(1);
  });

  it('is 0 when nothing was solved', () => {
    const normalized = normalizeOddOneOutResult(
      rawResult({ roundsPlayed: 6, roundsPassed: 0 }),
      { gameId: 'attention-odd-one-out', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(0);
  });

  it('combines accuracy, first-try precision, and speed multiplicatively', () => {
    // 3/4 solved, 2 of those first-try, mean solve ratio 0.5:
    // accuracy 0.75, firstTry 0.5, speed 0.5 → 0.75 * 0.75 * 0.75
    const normalized = normalizeOddOneOutResult(
      rawResult({
        roundsPlayed: 4,
        roundsPassed: 3,
        firstTryCorrect: 2,
        avgSolveRatio: 0.5,
        accuracy: 0.75,
        firstTryRate: 0.5,
      }),
      { gameId: 'attention-odd-one-out', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBeCloseTo(0.75 * 0.75 * 0.75);
  });

  it('rewards precision even at perfect accuracy', () => {
    // All solved but none first-try and very slow → capped well below 1.
    const sloppy = normalizeOddOneOutResult(
      rawResult({
        roundsPlayed: 6,
        roundsPassed: 6,
        firstTryCorrect: 0,
        avgSolveRatio: 0.9, // → speed 0.1
        accuracy: 1,
        firstTryRate: 0,
      }),
      { gameId: 'attention-odd-one-out', difficulty: 'normal', durationMs: 0 },
    );
    // 1 * 0.5 * 0.55
    expect(sloppy.value).toBeCloseTo(0.275);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const raw = rawResult({ roundsPlayed: 1, roundsPassed: 1, firstTryCorrect: 1 });
    const normalized = normalizeOddOneOutResult(raw, {
      gameId: 'attention-odd-one-out',
      difficulty: 'normal',
      durationMs: 0,
    });
    expect(normalized.raw).toEqual(expect.objectContaining({ seed: 's', difficulty: 'normal' }));
  });
});