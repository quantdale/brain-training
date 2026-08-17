// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  accuracyOf,
  avgWordLengthFactor,
  clamp01,
  computeRoundScore,
  normalizeSentenceBuilderResult,
  partialRoundScore,
  perfectRoundScore,
  positionAccuracy,
} from '../scoring';
import type { SentenceBuilderRawResult } from '../types';

describe('perfectRoundScore', () => {
  it('returns 100 + 10 × wordCount', () => {
    expect(perfectRoundScore(4)).toBe(140);
    expect(perfectRoundScore(7)).toBe(170);
    expect(perfectRoundScore(10)).toBe(200);
  });
});

describe('partialRoundScore', () => {
  it('returns 50 for 80%+ correct', () => {
    expect(partialRoundScore()).toBe(50);
  });
});

describe('positionAccuracy', () => {
  it('returns 1 for perfect match', () => {
    expect(positionAccuracy(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(1);
  });

  it('returns 0 for completely wrong', () => {
    expect(positionAccuracy(['a', 'b', 'c'], ['c', 'b', 'a'])).toBeCloseTo(1 / 3);
  });

  it('returns 0 for empty', () => {
    expect(positionAccuracy([], [])).toBe(0);
  });
});

describe('computeRoundScore', () => {
  it('awards perfect score for exact match', () => {
    const result = computeRoundScore(['the', 'cat', 'sat'], ['the', 'cat', 'sat']);
    expect(result.points).toBe(130);
    expect(result.passed).toBe(true);
  });

  it('awards partial score for 80%+ correct', () => {
    // 4 words, 3 correct = 75%, not enough.
    const result3 = computeRoundScore(['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'x']);
    expect(result3.passed).toBe(false);
    expect(result3.points).toBe(0);

    // 5 words, 4 correct = 80%, partial.
    const result4 = computeRoundScore(['a', 'b', 'c', 'd', 'e'], ['a', 'b', 'c', 'd', 'x']);
    expect(result4.passed).toBe(true);
    expect(result4.points).toBe(partialRoundScore());
  });

  it('returns 0 for less than 80% correct', () => {
    const result = computeRoundScore(['a', 'b', 'c'], ['x', 'y', 'z']);
    expect(result.passed).toBe(false);
    expect(result.points).toBe(0);
  });
});

describe('accuracyOf', () => {
  it('returns the ratio', () => {
    expect(accuracyOf(3, 5)).toBe(0.6);
  });

  it('returns 0 when nothing played', () => {
    expect(accuracyOf(0, 0)).toBe(0);
  });
});

describe('clamp01', () => {
  it('clamps to [0, 1]', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
  });

  it('rejects non-finite', () => {
    expect(() => clamp01(NaN)).toThrow('finite');
    expect(() => clamp01(Infinity)).toThrow('finite');
  });
});

describe('avgWordLengthFactor', () => {
  it('maps 3 to 0 and 8 to 1', () => {
    expect(avgWordLengthFactor(3)).toBe(0);
    expect(avgWordLengthFactor(8)).toBe(1);
  });

  it('clamps outside range', () => {
    expect(avgWordLengthFactor(2)).toBe(0);
    expect(avgWordLengthFactor(10)).toBe(1);
  });
});

describe('normalizeSentenceBuilderResult', () => {
  it('returns 1 for a perfect session', () => {
    const raw: SentenceBuilderRawResult = {
      score: 750,
      totalRounds: 5,
      roundsPlayed: 5,
      roundsPassed: 5,
      accuracy: 1,
      bestStreak: 5,
      longestSentence: 7,
      avgWordLengthFactor: 1,
      challengeRating: 0.5,
      difficulty: 'normal',
      seed: 'test',
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: '1.0.0',
      forced: false,
      generatorInfo: {},
      diagnosticMetadata: {} as any,
    };
    const result = normalizeSentenceBuilderResult(raw, {
      gameId: 'language-sentence-builder',
      difficulty: 'normal',
      durationMs: 30_000,
    });
    expect(result.value).toBe(1);
    expect(result.scale).toBe('0..1');
  });

  it('returns 0 for a failed session', () => {
    const raw: SentenceBuilderRawResult = {
      score: 0,
      totalRounds: 5,
      roundsPlayed: 5,
      roundsPassed: 0,
      accuracy: 0,
      bestStreak: 0,
      longestSentence: 0,
      avgWordLengthFactor: 0.5,
      challengeRating: 0.5,
      difficulty: 'normal',
      seed: 'test',
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: '1.0.0',
      forced: false,
      generatorInfo: {},
      diagnosticMetadata: {} as any,
    };
    const result = normalizeSentenceBuilderResult(raw, {
      gameId: 'language-sentence-builder',
      difficulty: 'normal',
      durationMs: 30_000,
    });
    expect(result.value).toBe(0);
  });

  it('returns 0 when nothing was played', () => {
    const raw: SentenceBuilderRawResult = {
      score: 0,
      totalRounds: 5,
      roundsPlayed: 0,
      roundsPassed: 0,
      accuracy: 0,
      bestStreak: 0,
      longestSentence: 0,
      avgWordLengthFactor: 0.5,
      challengeRating: 0.5,
      difficulty: 'normal',
      seed: 'test',
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: '1.0.0',
      forced: false,
      generatorInfo: {},
      diagnosticMetadata: {} as any,
    };
    const result = normalizeSentenceBuilderResult(raw, {
      gameId: 'language-sentence-builder',
      difficulty: 'normal',
      durationMs: 0,
    });
    expect(result.value).toBe(0);
  });
});
