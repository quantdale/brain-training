// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  accuracyOf,
  clamp01,
  lengthProgress,
  normalizeMemoryResult,
  perfectSessionScore,
  roundScore,
} from '../scoring';
import { MEMORY_DIFFICULTY_PARAMS } from '../difficulty';
import type { MemoryRawResult } from '../types';

function rawResult(overrides: Partial<MemoryRawResult>): MemoryRawResult {
  return {
    score: 0,
    totalRounds: 5,
    roundsPlayed: 0,
    roundsPassed: 0,
    accuracy: 0,
    longestSequence: 4,
    bestStreak: 0,
    initialSequenceLength: 4,
    gridSize: 9,
    revealMs: 900,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {
      gameId: 'memory',
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
  it('awards 100 base points plus 25 per extra tile past the start', () => {
    expect(roundScore(4, 4)).toBe(100);
    expect(roundScore(6, 4)).toBe(150);
    expect(roundScore(3, 3)).toBe(100);
  });

  it('never drops below the base', () => {
    expect(roundScore(2, 4)).toBe(100);
  });
});

describe('perfectSessionScore', () => {
  it('sums escalated round scores for a perfect run', () => {
    // normal: lengths 4,5,6,7,8 → 100+125+150+175+200
    expect(perfectSessionScore(MEMORY_DIFFICULTY_PARAMS.normal)).toBe(750);
    // easy: lengths 3,4,5,6 → 100+125+150+175
    expect(perfectSessionScore(MEMORY_DIFFICULTY_PARAMS.easy)).toBe(550);
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

describe('lengthProgress', () => {
  it('is 0 at the starting length and 1 at grid capacity', () => {
    expect(lengthProgress(4, 4, 9)).toBe(0);
    expect(lengthProgress(9, 4, 9)).toBe(1);
  });

  it('scales linearly in between', () => {
    expect(lengthProgress(6.5, 4, 9)).toBe(0.5);
    expect(lengthProgress(3, 4, 9)).toBe(0); // below start clamps to 0
    expect(lengthProgress(12, 4, 9)).toBe(1); // above capacity clamps to 1
  });

  it('handles a degenerate span', () => {
    expect(lengthProgress(9, 9, 9)).toBe(1);
    expect(lengthProgress(8, 9, 9)).toBe(0);
  });
});

describe('normalizeMemoryResult (documented formula)', () => {
  it('scores a perfect escalated run high', () => {
    // accuracy 1, progress (8-4)/(9-4)=0.8 → 1 * (0.5 + 0.4) = 0.9
    const normalized = normalizeMemoryResult(
      rawResult({
        roundsPlayed: 5,
        roundsPassed: 5,
        longestSequence: 8,
        bestStreak: 5,
        accuracy: 1,
      }),
      { gameId: 'memory', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.scale).toBe('0..1');
    expect(normalized.value).toBeCloseTo(0.9);
  });

  it('is 0 when no round was passed', () => {
    const normalized = normalizeMemoryResult(
      rawResult({ roundsPlayed: 5, roundsPassed: 0 }),
      { gameId: 'memory', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(0);
  });

  it('rewards escalation even at perfect accuracy', () => {
    const noEscalation = normalizeMemoryResult(
      rawResult({ roundsPlayed: 5, roundsPassed: 5, longestSequence: 4, accuracy: 1 }),
      { gameId: 'memory', difficulty: 'normal', durationMs: 0 },
    );
    expect(noEscalation.value).toBe(0.5); // 1 * (0.5 + 0)
  });

  it('never exceeds 1 (full-grid perfect run)', () => {
    const normalized = normalizeMemoryResult(
      rawResult({
        roundsPlayed: 5,
        roundsPassed: 5,
        longestSequence: 9,
        accuracy: 1,
      }),
      { gameId: 'memory', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(1);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const raw = rawResult({ roundsPlayed: 1, roundsPassed: 1, longestSequence: 4 });
    const normalized = normalizeMemoryResult(raw, {
      gameId: 'memory',
      difficulty: 'normal',
      durationMs: 0,
    });
    expect(normalized.raw).toEqual(expect.objectContaining({ seed: 's', difficulty: 'normal' }));
  });
});
