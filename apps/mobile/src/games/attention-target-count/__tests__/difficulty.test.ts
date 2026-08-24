// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  ADAPTIVE_PARAMS,
  TARGET_COUNT_DIFFICULTY_PARAMS,
  targetCountParamsForLevel,
  targetCountParamsFromProfile,
  resolveTargetCountDifficulty,
  sessionChallengeRating,
} from '../difficulty';

describe('targetCountParamsForLevel', () => {
  it('returns fixed params for each level', () => {
    expect(targetCountParamsForLevel('easy')).toEqual(TARGET_COUNT_DIFFICULTY_PARAMS.easy);
    expect(targetCountParamsForLevel('normal')).toEqual(TARGET_COUNT_DIFFICULTY_PARAMS.normal);
    expect(targetCountParamsForLevel('hard')).toEqual(TARGET_COUNT_DIFFICULTY_PARAMS.hard);
    expect(targetCountParamsForLevel('expert')).toEqual(TARGET_COUNT_DIFFICULTY_PARAMS.expert);
  });

  it('returns adaptive params for adaptive level', () => {
    expect(targetCountParamsForLevel('adaptive')).toEqual(ADAPTIVE_PARAMS);
  });

  it('returns fresh objects (not the frozen defaults)', () => {
    const params = targetCountParamsForLevel('easy');
    expect(params).not.toBe(TARGET_COUNT_DIFFICULTY_PARAMS.easy);
    expect(params.rows).toBe(3);
  });
});

describe('resolveTargetCountDifficulty', () => {
  it('resolves fixed levels with default challenge ratings', () => {
    const easy = resolveTargetCountDifficulty('easy');
    expect(easy.level).toBe('easy');
    expect(easy.challengeRating).toBe(0.2);
    expect(easy.parameters.rows).toBe(3);

    const hard = resolveTargetCountDifficulty('hard');
    expect(hard.level).toBe('hard');
    expect(hard.challengeRating).toBe(0.8);
  });

  it('resolves adaptive with neutral baseline', () => {
    const adaptive = resolveTargetCountDifficulty('adaptive');
    expect(adaptive.level).toBe('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
  });
});

describe('targetCountParamsFromProfile', () => {
  it('recovers params from a resolved profile', () => {
    const profile = resolveTargetCountDifficulty('normal');
    const params = targetCountParamsFromProfile(profile);
    expect(params.rows).toBe(4);
    expect(params.cols).toBe(4);
    expect(params.distractorClasses).toBe(2);
    expect(params.rounds).toBe(8);
    expect(params.targetCountRange).toEqual([2, 6]);
  });

  it('throws when a required parameter is missing', () => {
    const badProfile = {
      level: 'normal' as const,
      challengeRating: 0.5,
      parameters: {} as Readonly<Record<string, number>>,
    };
    expect(() => targetCountParamsFromProfile(badProfile)).toThrow('missing numeric parameter');
  });

  it('throws when a parameter is non-finite', () => {
    const badProfile = {
      level: 'normal' as const,
      challengeRating: 0.5,
      parameters: {
        rows: 4,
        cols: 4,
        distractorClasses: 2,
        targetCountLo: 2,
        targetCountHi: NaN,
        roundTimeMs: 9000,
        rounds: 8,
      } as Readonly<Record<string, number>>,
    };
    expect(() => targetCountParamsFromProfile(badProfile)).toThrow('missing numeric parameter');
  });
});

describe('sessionChallengeRating', () => {
  it('returns SDK default for fixed levels', () => {
    const profile = resolveTargetCountDifficulty('normal');
    expect(sessionChallengeRating('normal', profile, 8, 8, 1000, 8000)).toBe(0.5);
  });

  it('returns baseline for adaptive with no plays', () => {
    const profile = resolveTargetCountDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 0, 0, 0, 8000)).toBe(0.5);
  });

  it('returns higher rating for accurate adaptive sessions', () => {
    const profile = resolveTargetCountDifficulty('adaptive');
    const rating = sessionChallengeRating('adaptive', profile, 8, 8, 1000, 8000);
    expect(rating).toBeGreaterThan(0.5);
    expect(rating).toBeLessThanOrEqual(1);
  });

  it('returns baseline when accuracy is zero for adaptive', () => {
    const profile = resolveTargetCountDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 0, 4, 8000, 8000)).toBe(0.5);
  });
});
