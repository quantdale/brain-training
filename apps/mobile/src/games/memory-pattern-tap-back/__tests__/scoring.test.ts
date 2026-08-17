// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  accuracyOf,
  avgLengthProgress,
  clamp01,
  normalizePatternTapBackResult,
  perfectSessionScore,
  roundLengthProgress,
  roundScore,
} from '../scoring';
import { DIFFICULTY_PARAMS } from '../difficulty';
import type { PatternTapBackRawResult } from '../types';

function rawResult(overrides: Partial<PatternTapBackRawResult>): PatternTapBackRawResult {
  return {
    score: 0,
    totalRounds: 5,
    roundsPlayed: 0,
    roundsPassed: 0,
    accuracy: 0,
    longestSequence: 4,
    bestStreak: 0,
    completedRoundLengths: [],
    initialSequenceLength: 4,
    maxSequenceLength: 8,
    gridSize: 9,
    baseObserveMs: 500,
    stepObserveMs: 200,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {
      gameId: 'memory-pattern-tap-back',
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

describe('roundScore', () => {
  it('awards 100 base points plus 10 per sequence step', () => {
    expect(roundScore(3)).toBe(130);
    expect(roundScore(4)).toBe(140);
    expect(roundScore(8)).toBe(180);
  });

  it('never drops below the base', () => {
    expect(roundScore(0)).toBe(100);
  });
});

describe('perfectSessionScore', () => {
  it('sums escalated round scores for a perfect run', () => {
    // normal: lengths 4,5,6,7,8 → 140+150+160+170+180 = 800
    expect(perfectSessionScore(DIFFICULTY_PARAMS.normal)).toBe(800);
    // easy: lengths 3,4,5,6 → 130+140+150+160 = 580
    expect(perfectSessionScore(DIFFICULTY_PARAMS.easy)).toBe(580);
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

describe('roundLengthProgress', () => {
  it('is 0 at the starting length and 1 at maxSequenceLength', () => {
    expect(roundLengthProgress(4, 4, 8)).toBe(0);
    expect(roundLengthProgress(8, 4, 8)).toBe(1);
  });

  it('scales linearly in between', () => {
    expect(roundLengthProgress(6, 4, 8)).toBe(0.5);
    expect(roundLengthProgress(3, 4, 8)).toBe(0); // below start clamps to 0
    expect(roundLengthProgress(12, 4, 8)).toBe(1); // above max clamps to 1
  });

  it('handles a degenerate span', () => {
    expect(roundLengthProgress(9, 9, 9)).toBe(1);
    expect(roundLengthProgress(8, 9, 9)).toBe(0);
  });
});

describe('avgLengthProgress', () => {
  it('is 0 for an empty array', () => {
    expect(avgLengthProgress([], 4, 8)).toBe(0);
  });

  it('computes the mean of individual progress values', () => {
    // Two rounds: lengths 4 and 8 → progress 0 and 1 → avg 0.5
    expect(avgLengthProgress([4, 8], 4, 8)).toBeCloseTo(0.5);
  });
});

describe('normalizePatternTapBackResult (documented formula)', () => {
  it('scores a perfect escalated run high', () => {
    // rounds 4/5 passed, lengths 4,5,6,7 → avg progress = (0+0.25+0.5+0.75)/4 = 0.375
    // accuracy 4/5 = 0.8 → 0.8 * (0.5 + 0.5*0.375) = 0.8 * 0.6875 = 0.55
    const normalized = normalizePatternTapBackResult(
      rawResult({
        roundsPlayed: 5,
        roundsPassed: 4,
        completedRoundLengths: [4, 5, 6, 7],
      }),
      { gameId: 'memory-pattern-tap-back', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.scale).toBe('0..1');
    expect(normalized.value).toBeCloseTo(0.55);
  });

  it('is 0 when no round was passed', () => {
    const normalized = normalizePatternTapBackResult(
      rawResult({ roundsPlayed: 5, roundsPassed: 0 }),
      { gameId: 'memory-pattern-tap-back', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(0);
  });

  it('is 0.5 for a perfect run with no escalation (all lengths equal to start)', () => {
    const normalized = normalizePatternTapBackResult(
      rawResult({
        roundsPlayed: 5,
        roundsPassed: 5,
        completedRoundLengths: [4, 4, 4, 4, 4],
      }),
      { gameId: 'memory-pattern-tap-back', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(0.5); // 1 * (0.5 + 0) = 0.5
  });

  it('never exceeds 1 (full escalation, perfect accuracy)', () => {
    const normalized = normalizePatternTapBackResult(
      rawResult({
        roundsPlayed: 5,
        roundsPassed: 5,
        completedRoundLengths: [4, 5, 6, 7, 8],
      }),
      { gameId: 'memory-pattern-tap-back', difficulty: 'normal', durationMs: 0 },
    );
    // accuracy 1, avg progress = (0+0.25+0.5+0.75+1)/5 = 0.5
    // 1 * (0.5 + 0.5*0.5) = 0.75
    expect(normalized.value).toBeCloseTo(0.75);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const raw = rawResult({ roundsPlayed: 1, roundsPassed: 1, completedRoundLengths: [4] });
    const normalized = normalizePatternTapBackResult(raw, {
      gameId: 'memory-pattern-tap-back',
      difficulty: 'normal',
      durationMs: 0,
    });
    expect(normalized.raw).toEqual(expect.objectContaining({ seed: 's', difficulty: 'normal' }));
  });
});
