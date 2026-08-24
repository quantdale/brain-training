// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  ADAPTIVE_PARAMS,
  RULE_GRID_DIFFICULTY_PARAMS,
  resolveRuleGridDifficulty,
  ruleGridParamsForLevel,
  ruleGridParamsFromProfile,
  sessionChallengeRating,
} from '../difficulty';

describe('ruleGridParamsForLevel', () => {
  it('returns fixed params for each level', () => {
    expect(ruleGridParamsForLevel('easy')).toEqual(RULE_GRID_DIFFICULTY_PARAMS.easy);
    expect(ruleGridParamsForLevel('normal')).toEqual(RULE_GRID_DIFFICULTY_PARAMS.normal);
    expect(ruleGridParamsForLevel('hard')).toEqual(RULE_GRID_DIFFICULTY_PARAMS.hard);
    expect(ruleGridParamsForLevel('expert')).toEqual(RULE_GRID_DIFFICULTY_PARAMS.expert);
  });

  it('returns adaptive params for adaptive level', () => {
    expect(ruleGridParamsForLevel('adaptive')).toEqual(ADAPTIVE_PARAMS);
  });

  it('returns fresh objects (not the frozen defaults)', () => {
    const params = { ...ruleGridParamsForLevel('easy') } as { size: number };
    // Mutating the copy should not affect the defaults.
    params.size = 99;
    expect(ruleGridParamsForLevel('easy').size).toBe(3);
  });
});

describe('resolveRuleGridDifficulty', () => {
  it('resolves fixed levels with default challenge ratings', () => {
    const easy = resolveRuleGridDifficulty('easy');
    expect(easy.level).toBe('easy');
    expect(easy.challengeRating).toBe(0.2);
    expect(easy.parameters.size).toBe(3);

    const hard = resolveRuleGridDifficulty('hard');
    expect(hard.level).toBe('hard');
    expect(hard.challengeRating).toBe(0.8);
  });

  it('resolves adaptive with neutral baseline', () => {
    const adaptive = resolveRuleGridDifficulty('adaptive');
    expect(adaptive.level).toBe('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
  });
});

describe('ruleGridParamsFromProfile', () => {
  it('recovers params from a resolved profile', () => {
    const profile = resolveRuleGridDifficulty('normal');
    const params = ruleGridParamsFromProfile(profile);
    expect(params.size).toBe(4);
    expect(params.rounds).toBe(7);
    expect(params.roundTimeMs).toBe(20_000);
  });

  it('throws when a required parameter is missing', () => {
    const badProfile = {
      level: 'normal' as const,
      challengeRating: 0.5,
      parameters: {} as Readonly<Record<string, number>>,
    };
    expect(() => ruleGridParamsFromProfile(badProfile)).toThrow('missing numeric parameter');
  });

  it('throws when a parameter is non-finite', () => {
    const badProfile = {
      level: 'normal' as const,
      challengeRating: 0.5,
      parameters: { size: NaN, rounds: 7, roundTimeMs: 20000 } as Readonly<Record<string, number>>,
    };
    expect(() => ruleGridParamsFromProfile(badProfile)).toThrow('missing numeric parameter');
  });
});

describe('sessionChallengeRating', () => {
  it('returns SDK default for fixed levels', () => {
    const profile = resolveRuleGridDifficulty('normal');
    expect(sessionChallengeRating('normal', profile, 4, 7, 20_000, 140_000)).toBe(0.5);
  });

  it('returns baseline for adaptive with no solves', () => {
    const profile = resolveRuleGridDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 0, 0, 0, 0)).toBe(0.5);
  });

  it('returns higher rating for accurate adaptive sessions', () => {
    const profile = resolveRuleGridDifficulty('adaptive');
    const rating = sessionChallengeRating('adaptive', profile, 5, 5, 10_000, 100_000);
    expect(rating).toBeGreaterThan(0.5);
    expect(rating).toBeLessThanOrEqual(1);
  });
});
