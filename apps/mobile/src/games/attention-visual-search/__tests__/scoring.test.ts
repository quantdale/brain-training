// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  BASE_ROUND_POINTS,
  MAX_SPEED_BONUS,
  accuracyOf,
  avgResponseMsOf,
  avgSpeedRatio,
  clamp01,
  normalizeVisualSearchResult,
  perfectSessionScore,
  roundScore,
} from '../scoring';
import { VISUAL_SEARCH_DIFFICULTY_PARAMS } from '../difficulty';
import type { VisualSearchRawResult } from '../types';

function rawResult(overrides: Partial<VisualSearchRawResult>): VisualSearchRawResult {
  return {
    score: 0,
    totalRounds: 12,
    roundsPlayed: 0,
    roundsPassed: 0,
    accuracy: 0,
    bestStreak: 0,
    avgResponseMs: 0,
    fastestResponseMs: 0,
    avgSpeedRatio: 0,
    initialGridSize: 4,
    maxGridSize: 25,
    initialWindowMs: 4_500,
    minWindowMs: 1_800,
    sessionDurationMs: 120_000,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {
      gameId: 'attention-visual-search',
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
  it('awards 100 base points plus up to 100 speed bonus', () => {
    expect(BASE_ROUND_POINTS).toBe(100);
    expect(MAX_SPEED_BONUS).toBe(100);
    expect(roundScore(4_500, 4_500)).toBe(200); // instant tap
    expect(roundScore(4_500, 2_250)).toBe(150); // half the window left
    expect(roundScore(4_500, 0)).toBe(100); // last-moment tap
  });

  it('clamps the ratio and guards a zero window', () => {
    expect(roundScore(4_500, -500)).toBe(100);
    expect(roundScore(0, 0)).toBe(100);
  });
});

describe('perfectSessionScore', () => {
  it('sums the theoretical maximum per round', () => {
    // normal: 12 rounds × 200 = 2400; easy: 10 × 200 = 2000.
    expect(perfectSessionScore(VISUAL_SEARCH_DIFFICULTY_PARAMS.normal)).toBe(2_400);
    expect(perfectSessionScore(VISUAL_SEARCH_DIFFICULTY_PARAMS.easy)).toBe(2_000);
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

describe('avgSpeedRatio / avgResponseMsOf', () => {
  it('averages over passed rounds and guards division by zero', () => {
    expect(avgSpeedRatio(4.8, 8)).toBe(0.6);
    expect(avgSpeedRatio(5, 5)).toBe(1);
    expect(avgSpeedRatio(0, 0)).toBe(0);
    expect(avgSpeedRatio(9, 3)).toBe(1); // clamped
    expect(avgResponseMsOf(16_000, 8)).toBe(2_000);
    expect(avgResponseMsOf(16_000, 0)).toBe(0);
  });
});

describe('normalizeVisualSearchResult (documented formula)', () => {
  it('scores a perfect instant run at 1.0', () => {
    const normalized = normalizeVisualSearchResult(
      rawResult({
        roundsPlayed: 12,
        roundsPassed: 12,
        avgSpeedRatio: 1,
        accuracy: 1,
      }),
      { gameId: 'attention-visual-search', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.scale).toBe('0..1');
    expect(normalized.value).toBe(1);
  });

  it('is 0 when no round was passed', () => {
    const normalized = normalizeVisualSearchResult(
      rawResult({ roundsPlayed: 12, roundsPassed: 0, avgSpeedRatio: 0 }),
      { gameId: 'attention-visual-search', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(0);
  });

  it('rewards speed even at perfect accuracy (half credit at slow speed)', () => {
    const slow = normalizeVisualSearchResult(
      rawResult({ roundsPlayed: 12, roundsPassed: 12, avgSpeedRatio: 0.5, accuracy: 1 }),
      { gameId: 'attention-visual-search', difficulty: 'normal', durationMs: 0 },
    );
    expect(slow.value).toBeCloseTo(0.75); // 1 * (0.5 + 0.5 * 0.5)
  });

  it('never exceeds 1', () => {
    const normalized = normalizeVisualSearchResult(
      rawResult({
        roundsPlayed: 12,
        roundsPassed: 12,
        avgSpeedRatio: 1,
        accuracy: 1,
        avgResponseMs: 0,
      }),
      { gameId: 'attention-visual-search', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(1);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const raw = rawResult({ roundsPlayed: 1, roundsPassed: 1, avgSpeedRatio: 0.8 });
    const normalized = normalizeVisualSearchResult(raw, {
      gameId: 'attention-visual-search',
      difficulty: 'normal',
      durationMs: 0,
    });
    expect(normalized.raw).toEqual(
      expect.objectContaining({ seed: 's', difficulty: 'normal', avgSpeedRatio: 0.8 }),
    );
  });
});
