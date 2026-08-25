import { describe, expect, it } from '@jest/globals';

import {
  accuracyOf,
  clamp01,
  contextFitPerformanceNormalizer,
  normalizeContextFitResult,
  perfectSessionScore,
  roundScore,
  speedScoreOf,
} from '../scoring';
import type { ContextFitRawResult } from '../types';

describe('scoring', () => {
  it('clamp01 bounds and rejects non-finite', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.4)).toBe(0.4);
    expect(() => clamp01(Number.NaN)).toThrow();
  });

  it('roundScore peaks at instant answer and floors at the budget', () => {
    expect(roundScore(0, 8000)).toBe(150);
    expect(roundScore(8000, 8000)).toBe(100);
    expect(roundScore(4000, 8000)).toBe(125);
    expect(() => roundScore(0, 0)).toThrow();
  });

  it('perfectSessionScore scales with rounds', () => {
    expect(perfectSessionScore({ rounds: 6, tierMask: 3, timePerRoundMs: 8000 })).toBe(900);
  });

  it('accuracyOf and speedScoreOf', () => {
    expect(accuracyOf(3, 4)).toBe(0.75);
    expect(accuracyOf(0, 0)).toBe(0);
    expect(speedScoreOf(2, 4)).toBe(0.5);
    expect(speedScoreOf(0, 0)).toBe(0);
  });

  it('normalizeContextFitResult is in [0,1] and perfect play yields 1.0', () => {
    const perfect: ContextFitRawResult = {
      score: 900,
      totalRounds: 6,
      roundsPlayed: 6,
      roundsCorrect: 6,
      accuracy: 1,
      bestStreak: 6,
      totalAnswerMs: 0,
      sumAnswerRatio: 0,
      roundOutcomes: [],
      contentPackId: 'p',
      contentPackVersion: '1.0.0',
      challengeRating: 0.5,
      finalTier: 't1',
      difficulty: 'normal',
      seed: 's',
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: '1.1.0',
      forced: false,
      generatorInfo: { packId: 'p', packVersion: '1.0.0', rounds: 6, tierMask: 3, timePerRoundMs: 8000, rngAlgorithm: 'v' },
      diagnosticMetadata: {} as any,
    };
    expect(normalizeContextFitResult(perfect, { gameId: 'language-context-fit', difficulty: 'normal', durationMs: 0 }).value).toBe(1);

    const zero: ContextFitRawResult = { ...perfect, roundsPlayed: 0, roundsCorrect: 0, accuracy: 0, sumAnswerRatio: 0 };
    const n = normalizeContextFitResult(zero, { gameId: 'language-context-fit', difficulty: 'normal', durationMs: 0 });
    expect(n.value).toBe(0);
    expect(n.scale).toBe('0..1');
  });

  it('performance normalizer exposes the game id', () => {
    expect(contextFitPerformanceNormalizer.gameId).toBe('language-context-fit');
  });
});
