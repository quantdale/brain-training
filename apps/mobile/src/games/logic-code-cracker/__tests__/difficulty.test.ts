// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  ADAPTIVE_PARAMS,
  CODE_CRACKER_DIFFICULTY_PARAMS,
  codeCrackerParamsForLevel,
  codeCrackerParamsFromProfile,
  nextCodeLength,
  resolveCodeCrackerDifficulty,
  sessionChallengeRating,
} from '../difficulty';

describe('codeCrackerParamsForLevel', () => {
  it('returns fixed params for each level', () => {
    expect(codeCrackerParamsForLevel('easy')).toEqual(CODE_CRACKER_DIFFICULTY_PARAMS.easy);
    expect(codeCrackerParamsForLevel('normal')).toEqual(CODE_CRACKER_DIFFICULTY_PARAMS.normal);
    expect(codeCrackerParamsForLevel('hard')).toEqual(CODE_CRACKER_DIFFICULTY_PARAMS.hard);
    expect(codeCrackerParamsForLevel('expert')).toEqual(CODE_CRACKER_DIFFICULTY_PARAMS.expert);
  });

  it('returns adaptive params for adaptive level', () => {
    expect(codeCrackerParamsForLevel('adaptive')).toEqual(ADAPTIVE_PARAMS);
  });

  it('returns fresh objects (not the frozen defaults)', () => {
    const params = { ...codeCrackerParamsForLevel('easy') } as { codeLength: number };
    // Mutating the copy should not affect the defaults.
    params.codeLength = 99;
    expect(codeCrackerParamsForLevel('easy').codeLength).toBe(3);
  });
});

describe('resolveCodeCrackerDifficulty', () => {
  it('resolves fixed levels with default challenge ratings', () => {
    const easy = resolveCodeCrackerDifficulty('easy');
    expect(easy.level).toBe('easy');
    expect(easy.challengeRating).toBe(0.2);
    expect(easy.parameters.codeLength).toBe(3);

    const hard = resolveCodeCrackerDifficulty('hard');
    expect(hard.level).toBe('hard');
    expect(hard.challengeRating).toBe(0.8);
  });

  it('resolves adaptive with neutral baseline', () => {
    const adaptive = resolveCodeCrackerDifficulty('adaptive');
    expect(adaptive.level).toBe('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
  });
});

describe('codeCrackerParamsFromProfile', () => {
  it('recovers params from a resolved profile', () => {
    const profile = resolveCodeCrackerDifficulty('normal');
    const params = codeCrackerParamsFromProfile(profile);
    expect(params.codeLength).toBe(4);
    expect(params.colorCount).toBe(6);
    expect(params.guessBudget).toBe(10);
    expect(params.rounds).toBe(4);
  });

  it('throws when a required parameter is missing', () => {
    const badProfile = { level: 'normal' as const, challengeRating: 0.5, parameters: {} as Readonly<Record<string, number>> };
    expect(() => codeCrackerParamsFromProfile(badProfile)).toThrow('missing numeric parameter');
  });

  it('throws when a parameter is non-finite', () => {
    const badProfile = {
      level: 'normal' as const,
      challengeRating: 0.5,
      parameters: { codeLength: NaN, colorCount: 6, guessBudget: 10, rounds: 4 } as Readonly<Record<string, number>>,
    };
    expect(() => codeCrackerParamsFromProfile(badProfile)).toThrow('missing numeric parameter');
  });
});

describe('nextCodeLength', () => {
  it('holds code length constant on fixed levels', () => {
    const params = CODE_CRACKER_DIFFICULTY_PARAMS.normal;
    expect(nextCodeLength(4, true, 'normal', params)).toBe(4);
    expect(nextCodeLength(4, false, 'normal', params)).toBe(4);
  });

  it('escalates on solve for adaptive', () => {
    const params = ADAPTIVE_PARAMS;
    expect(nextCodeLength(4, true, 'adaptive', params)).toBe(5);
    expect(nextCodeLength(6, true, 'adaptive', params)).toBe(6); // capped at maxLength
  });

  it('decreases on failure for adaptive', () => {
    const params = ADAPTIVE_PARAMS;
    expect(nextCodeLength(4, false, 'adaptive', params)).toBe(3);
    expect(nextCodeLength(3, false, 'adaptive', params)).toBe(3); // floored at minLength
  });
});

describe('sessionChallengeRating', () => {
  it('returns SDK default for fixed levels', () => {
    const profile = resolveCodeCrackerDifficulty('normal');
    expect(sessionChallengeRating('normal', profile, 4, 20, 40)).toBe(0.5);
  });

  it('returns baseline for adaptive with no solves', () => {
    const profile = resolveCodeCrackerDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 0, 0, 50)).toBe(0.5);
  });

  it('returns higher rating for efficient adaptive sessions', () => {
    const profile = resolveCodeCrackerDifficulty('adaptive');
    const rating = sessionChallengeRating('adaptive', profile, 5, 10, 50);
    expect(rating).toBeGreaterThan(0.5);
    expect(rating).toBeLessThanOrEqual(1);
  });
});
