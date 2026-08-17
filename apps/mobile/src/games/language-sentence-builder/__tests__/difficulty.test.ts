// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { isDifficultyLevel } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  DIFFICULTY_PARAMS,
  nextWordRange,
  paramsForLevel,
  paramsFromProfile,
  resolveSentenceBuilderDifficulty,
  sessionChallengeRating,
} from '../difficulty';

describe('resolveSentenceBuilderDifficulty', () => {
  it('returns correct challenge ratings for fixed levels', () => {
    const easy = resolveSentenceBuilderDifficulty('easy');
    expect(easy.level).toBe('easy');
    expect(easy.challengeRating).toBe(0.2);
    expect(easy.parameters.minWords).toBe(4);

    const hard = resolveSentenceBuilderDifficulty('hard');
    expect(hard.level).toBe('hard');
    expect(hard.challengeRating).toBe(0.8);
    expect(hard.parameters.rounds).toBe(6);
  });

  it('adaptive starts at the baseline 0.5', () => {
    const adaptive = resolveSentenceBuilderDifficulty('adaptive');
    expect(adaptive.level).toBe('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
  });

  it('all levels have required parameters', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const) {
      const profile = resolveSentenceBuilderDifficulty(level);
      const params = paramsFromProfile(profile);
      expect(params.minWords).toBeGreaterThanOrEqual(1);
      expect(params.maxWords).toBeGreaterThanOrEqual(params.minWords);
      expect(params.rounds).toBeGreaterThanOrEqual(1);
      expect(params.timeBudgetMs).toBeGreaterThan(0);
    }
  });
});

describe('paramsFromProfile', () => {
  it('recovers parameters from a resolved profile', () => {
    const profile = resolveSentenceBuilderDifficulty('easy');
    const params = paramsFromProfile(profile);
    expect(params.minWords).toBe(DIFFICULTY_PARAMS.easy.minWords);
    expect(params.maxWords).toBe(DIFFICULTY_PARAMS.easy.maxWords);
    expect(params.rounds).toBe(DIFFICULTY_PARAMS.easy.rounds);
    expect(params.timeBudgetMs).toBe(DIFFICULTY_PARAMS.easy.timeBudgetMs);
  });

  it('throws for missing parameters', () => {
    const badProfile = { level: 'easy' as const, challengeRating: 0.2, parameters: {} };
    expect(() => paramsFromProfile(badProfile)).toThrow('missing numeric parameter');
  });
});

describe('paramsForLevel', () => {
  it('returns a fresh copy each call', () => {
    const a = paramsForLevel('normal');
    const b = paramsForLevel('normal');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it('adaptive returns the adaptive params', () => {
    expect(paramsForLevel('adaptive')).toEqual(ADAPTIVE_PARAMS);
  });
});

describe('nextWordRange', () => {
  it('escalates on pass in adaptive mode', () => {
    const result = nextWordRange(4, 6, true, 'adaptive');
    expect(result.minWords).toBe(5);
    expect(result.maxWords).toBe(7);
  });

  it('holds on failure in adaptive mode', () => {
    const result = nextWordRange(4, 6, false, 'adaptive');
    expect(result.minWords).toBe(4);
    expect(result.maxWords).toBe(6);
  });

  it('caps at 12', () => {
    const result = nextWordRange(11, 12, true, 'adaptive');
    expect(result.minWords).toBe(12);
    expect(result.maxWords).toBe(12);
  });

  it('does nothing for fixed levels', () => {
    const result = nextWordRange(4, 5, true, 'easy');
    expect(result.minWords).toBe(4);
    expect(result.maxWords).toBe(5);
  });
});

describe('sessionChallengeRating', () => {
  it('returns profile rating for fixed levels', () => {
    const profile = resolveSentenceBuilderDifficulty('normal');
    expect(sessionChallengeRating('normal', profile, 7)).toBe(0.5);
  });

  it('maps final word count for adaptive', () => {
    const profile = resolveSentenceBuilderDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 4)).toBe(0);
    expect(sessionChallengeRating('adaptive', profile, 8)).toBeCloseTo(0.5);
    expect(sessionChallengeRating('adaptive', profile, 12)).toBe(1);
  });
});
