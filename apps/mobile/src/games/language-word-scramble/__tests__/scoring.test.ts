// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  accuracyOf,
  clamp01,
  normalizeWordScrambleResult,
  perfectSessionScore,
  roundScore,
  wordDifficultyProgress,
} from '../scoring';
import { WORD_SCRAMBLE_DIFFICULTY_PARAMS } from '../difficulty';
import type { WordScrambleRawResult } from '../types';

function rawResult(overrides: Partial<WordScrambleRawResult>): WordScrambleRawResult {
  return {
    score: 0,
    totalRounds: 5,
    roundsPlayed: 0,
    roundsPassed: 0,
    accuracy: 0,
    longestWord: 4,
    bestStreak: 0,
    optionsCount: 4,
    minWordLength: 4,
    maxWordLength: 10,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {
      gameId: 'language-word-scramble',
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
  it('awards 100 base points plus 10 per letter', () => {
    expect(roundScore(4)).toBe(140);
    expect(roundScore(6)).toBe(160);
    expect(roundScore(8)).toBe(180);
  });

  it('never drops below the base', () => {
    expect(roundScore(1)).toBe(110);
  });
});

describe('perfectSessionScore', () => {
  it('computes a plausible perfect score for each difficulty', () => {
    const easy = perfectSessionScore(WORD_SCRAMBLE_DIFFICULTY_PARAMS.easy);
    const normal = perfectSessionScore(WORD_SCRAMBLE_DIFFICULTY_PARAMS.normal);
    const hard = perfectSessionScore(WORD_SCRAMBLE_DIFFICULTY_PARAMS.hard);
    const expert = perfectSessionScore(WORD_SCRAMBLE_DIFFICULTY_PARAMS.expert);
    expect(easy).toBeGreaterThan(0);
    expect(normal).toBeGreaterThan(easy);
    expect(hard).toBeGreaterThan(normal);
    expect(expert).toBeGreaterThan(hard);
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

describe('wordDifficultyProgress', () => {
  it('is 0 at the min length and 1 at the max length', () => {
    expect(wordDifficultyProgress(4, 4, 10)).toBe(0);
    expect(wordDifficultyProgress(10, 4, 10)).toBe(1);
  });

  it('scales linearly in between', () => {
    expect(wordDifficultyProgress(7, 4, 10)).toBeCloseTo(0.5);
    expect(wordDifficultyProgress(3, 4, 10)).toBe(0); // below min clamps to 0
    expect(wordDifficultyProgress(12, 4, 10)).toBe(1); // above max clamps to 1
  });

  it('handles a degenerate span', () => {
    expect(wordDifficultyProgress(10, 10, 10)).toBe(1);
    expect(wordDifficultyProgress(8, 10, 10)).toBe(0);
  });
});

describe('normalizeWordScrambleResult (documented formula)', () => {
  it('scores a perfect long-word run high', () => {
    // accuracy 1, progress (10-4)/(10-4)=1.0 → 1 * (0.5 + 0.5) = 1.0
    const normalized = normalizeWordScrambleResult(
      rawResult({
        roundsPlayed: 5,
        roundsPassed: 5,
        longestWord: 10,
        bestStreak: 5,
        accuracy: 1,
      }),
      { gameId: 'language-word-scramble', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.scale).toBe('0..1');
    expect(normalized.value).toBeCloseTo(1.0);
  });

  it('is 0 when no round was passed', () => {
    const normalized = normalizeWordScrambleResult(
      rawResult({ roundsPlayed: 5, roundsPassed: 0 }),
      { gameId: 'language-word-scramble', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(0);
  });

  it('rewards word difficulty even at perfect accuracy', () => {
    const noProgress = normalizeWordScrambleResult(
      rawResult({ roundsPlayed: 5, roundsPassed: 5, longestWord: 4, accuracy: 1 }),
      { gameId: 'language-word-scramble', difficulty: 'normal', durationMs: 0 },
    );
    expect(noProgress.value).toBeCloseTo(0.5); // 1 * (0.5 + 0)
  });

  it('never exceeds 1', () => {
    const normalized = normalizeWordScrambleResult(
      rawResult({
        roundsPlayed: 5,
        roundsPassed: 5,
        longestWord: 10,
        accuracy: 1,
      }),
      { gameId: 'language-word-scramble', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBeLessThanOrEqual(1);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const raw = rawResult({ roundsPlayed: 1, roundsPassed: 1, longestWord: 6 });
    const normalized = normalizeWordScrambleResult(raw, {
      gameId: 'language-word-scramble',
      difficulty: 'normal',
      durationMs: 0,
    });
    expect(normalized.raw).toEqual(expect.objectContaining({ seed: 's', difficulty: 'normal' }));
  });
});
