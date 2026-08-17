// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  accuracyOf,
  clamp01,
  lengthProgress,
  normalizeSequenceMemoryResult,
  perfectClimbRounds,
  perfectClimbTaps,
  perfectSessionScore,
  sequenceScore,
} from '../scoring';
import type { SequenceMemoryRawResult } from '../types';
import { SEQUENCE_MEMORY_DIFFICULTY_PARAMS } from '../difficulty';

/** Minimal raw result; overrides per test. */
function raw(overrides: Partial<SequenceMemoryRawResult> = {}): SequenceMemoryRawResult {
  return {
    score: 0,
    roundsPlayed: 0,
    roundsPassed: 0,
    accuracy: 0,
    longestSequence: 0,
    bestStreak: 0,
    baseLength: 3,
    maxLength: 8,
    tileCount: 4,
    revealMs: 900,
    sessionSeconds: 90,
    timeUp: false,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {
      gameId: 'memory-sequence-memory',
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

describe('sequenceScore', () => {
  it('awards 100 base plus 25 per extra tile past the base length', () => {
    expect(sequenceScore(3, 3)).toBe(100);
    expect(sequenceScore(4, 3)).toBe(125);
    expect(sequenceScore(8, 3)).toBe(225);
    expect(sequenceScore(2, 2)).toBe(100);
    expect(sequenceScore(1, 2)).toBe(100); // below base: base only
  });
});

describe('perfect climb (canonical perfect run)', () => {
  it('covers one round per length from baseLength through maxLength', () => {
    expect(perfectClimbRounds(SEQUENCE_MEMORY_DIFFICULTY_PARAMS.normal)).toBe(6); // 3..8
    expect(perfectClimbRounds(SEQUENCE_MEMORY_DIFFICULTY_PARAMS.easy)).toBe(5); // 2..6
    expect(perfectClimbTaps(SEQUENCE_MEMORY_DIFFICULTY_PARAMS.normal)).toBe(33); // 3+..+8
  });

  it('sums the per-length scores', () => {
    // 100 + 125 + 150 + 175 + 200 + 225
    expect(perfectSessionScore(SEQUENCE_MEMORY_DIFFICULTY_PARAMS.normal)).toBe(975);
    // 100 + 125 + 150 + 175 + 200
    expect(perfectSessionScore(SEQUENCE_MEMORY_DIFFICULTY_PARAMS.easy)).toBe(750);
  });
});

describe('accuracyOf / clamp01 / lengthProgress', () => {
  it('computes accuracy with a division guard', () => {
    expect(accuracyOf(3, 4)).toBeCloseTo(0.75);
    expect(accuracyOf(0, 0)).toBe(0);
  });

  it('clamps to [0, 1] and rejects non-finite input', () => {
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(() => clamp01(Number.NaN)).toThrow(RangeError);
  });

  it('measures escalation progress relative to the pad ceiling', () => {
    expect(lengthProgress(3, 3, 8)).toBe(0);
    expect(lengthProgress(8, 3, 8)).toBe(1);
    expect(lengthProgress(5, 3, 8)).toBeCloseTo(0.4);
    expect(lengthProgress(12, 3, 8)).toBe(1); // clamped
    expect(lengthProgress(3, 3, 3)).toBe(1); // degenerate span: at ceiling
    expect(lengthProgress(2, 3, 3)).toBe(0); // degenerate span: below ceiling
  });
});

describe('normalizeSequenceMemoryResult', () => {
  const context = {
    gameId: 'memory-sequence-memory',
    difficulty: 'normal',
    durationMs: 90_000,
  } as const;

  it('is 0.5 * accuracy + 0.5 * lengthProgress (documented blend)', () => {
    const result = normalizeSequenceMemoryResult(
      raw({ roundsPlayed: 4, roundsPassed: 3, longestSequence: 5 }),
      context,
    );
    // 0.5 * 0.75 + 0.5 * 0.4 = 0.575
    expect(result.value).toBeCloseTo(0.575);
    expect(result.scale).toBe('0..1');
  });

  it('a perfect run normalizes to 1', () => {
    const result = normalizeSequenceMemoryResult(
      raw({ roundsPlayed: 6, roundsPassed: 6, longestSequence: 8 }),
      context,
    );
    expect(result.value).toBe(1);
  });

  it('an empty session normalizes to 0', () => {
    expect(normalizeSequenceMemoryResult(raw(), context).value).toBe(0);
  });

  it('a player who only passes short rounds cannot reach the top', () => {
    const result = normalizeSequenceMemoryResult(
      raw({ roundsPlayed: 10, roundsPassed: 10, longestSequence: 3 }),
      context,
    );
    expect(result.value).toBeCloseTo(0.5);
  });

  it('snapshots the raw result for diagnostics', () => {
    const result = normalizeSequenceMemoryResult(raw({ score: 42 }), context);
    expect(result.raw).toEqual(expect.objectContaining({ score: 42 }));
  });
});
