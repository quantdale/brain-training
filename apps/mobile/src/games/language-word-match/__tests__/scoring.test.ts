// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  accuracyOf,
  clamp01,
  normalizeLanguageResult,
  perfectSessionScore,
  roundScore,
  speedScoreOf,
} from '../scoring';
import { LANGUAGE_DIFFICULTY_PARAMS } from '../difficulty';
import type { LanguageRawResult } from '../types';

function rawResult(overrides: Partial<LanguageRawResult>): LanguageRawResult {
  return {
    score: 0,
    totalRounds: 6,
    roundsPlayed: 0,
    roundsCorrect: 0,
    accuracy: 0,
    bestStreak: 0,
    totalAnswerMs: 0,
    sumAnswerRatio: 0,
    roundOutcomes: [],
    contentPackId: 'language-word-match-core-v1',
    contentPackVersion: '1.0.0',
    challengeRating: 0.5,
    finalTier: null,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: null,
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {
      gameId: 'language-word-match',
      sdkVersion: '0.1.0',
      gameVersion: '1.0.0',
      generatorVersion: null,
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
  it('awards 150 for an instant answer and 100 at the budget', () => {
    expect(roundScore(0, 8000)).toBe(150);
    expect(roundScore(8000, 8000)).toBe(100);
    expect(roundScore(16000, 8000)).toBe(100); // clamped
  });

  it('scales linearly in between', () => {
    expect(roundScore(4000, 8000)).toBe(125);
    expect(roundScore(500, 8000)).toBe(147); // 100 + round(50 * 0.9375)
    expect(roundScore(7500, 8000)).toBe(103); // 100 + round(50 * 0.0625)
  });

  it('rejects a non-positive budget', () => {
    expect(() => roundScore(100, 0)).toThrow(RangeError);
  });
});

describe('perfectSessionScore', () => {
  it('is 150 per round (instant correct answers)', () => {
    expect(perfectSessionScore(LANGUAGE_DIFFICULTY_PARAMS.easy)).toBe(750);
    expect(perfectSessionScore(LANGUAGE_DIFFICULTY_PARAMS.normal)).toBe(900);
    expect(perfectSessionScore(LANGUAGE_DIFFICULTY_PARAMS.expert)).toBe(1200);
  });
});

describe('accuracyOf', () => {
  it('computes the correct ratio', () => {
    expect(accuracyOf(3, 5)).toBe(0.6);
    expect(accuracyOf(5, 5)).toBe(1);
    expect(accuracyOf(0, 4)).toBe(0);
  });

  it('guards division by zero', () => {
    expect(accuracyOf(0, 0)).toBe(0);
  });
});

describe('speedScoreOf', () => {
  it('is 1 for instant answers and 0 when every round used its budget', () => {
    expect(speedScoreOf(0, 6)).toBe(1);
    expect(speedScoreOf(6, 6)).toBe(0);
  });

  it('scales with the average per-round time ratio', () => {
    expect(speedScoreOf(3, 6)).toBe(0.5);
    expect(speedScoreOf(12, 6)).toBe(0); // clamped below 0
  });

  it('guards division by zero', () => {
    expect(speedScoreOf(0, 0)).toBe(0);
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

describe('normalizeLanguageResult (documented formula)', () => {
  it('scores a perfect fast run as 1.0', () => {
    const normalized = normalizeLanguageResult(
      rawResult({ roundsPlayed: 6, roundsCorrect: 6, accuracy: 1, sumAnswerRatio: 0 }),
      { gameId: 'language-word-match', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.scale).toBe('0..1');
    expect(normalized.value).toBe(1);
  });

  it('scores a perfect but budget-consuming run as 0.5', () => {
    const normalized = normalizeLanguageResult(
      rawResult({ roundsPlayed: 6, roundsCorrect: 6, accuracy: 1, sumAnswerRatio: 6 }),
      { gameId: 'language-word-match', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBeCloseTo(0.5);
  });

  it('blends accuracy and speed multiplicatively', () => {
    // Half the rounds correct at half speed → 0.5 * (0.5 + 0.25) = 0.375.
    const normalized = normalizeLanguageResult(
      rawResult({ roundsPlayed: 6, roundsCorrect: 3, accuracy: 0.5, sumAnswerRatio: 3 }),
      { gameId: 'language-word-match', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBeCloseTo(0.375);
  });

  it('is 0 when no round was answered correctly', () => {
    const normalized = normalizeLanguageResult(
      rawResult({ roundsPlayed: 6, roundsCorrect: 0, sumAnswerRatio: 4 }),
      { gameId: 'language-word-match', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(0);
  });

  it('never exceeds 1 even with impossible inputs', () => {
    const normalized = normalizeLanguageResult(
      rawResult({ roundsPlayed: 6, roundsCorrect: 6, accuracy: 1, sumAnswerRatio: -3 }),
      { gameId: 'language-word-match', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(1);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const raw = rawResult({ roundsPlayed: 2, roundsCorrect: 2, sumAnswerRatio: 0.5, seed: 'snap' });
    const normalized = normalizeLanguageResult(raw, {
      gameId: 'language-word-match',
      difficulty: 'normal',
      durationMs: 0,
    });
    expect(normalized.raw).toEqual(expect.objectContaining({ seed: 'snap', difficulty: 'normal' }));
  });
});
