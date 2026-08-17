// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  ADAPTIVE_PARAMS,
  MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS,
  aMaxForRound,
  adaptiveRatingAfter,
  budgetForRound,
  mathMissingOperatorParamsForLevel,
  mathMissingOperatorParamsFromProfile,
  resolveMathMissingOperatorDifficulty,
  sessionChallengeRating,
} from '../difficulty';

describe('difficulty params', () => {
  it('keeps every level feasible under the generator invariants', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const p = MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS[level];
      expect(p.minB).toBeGreaterThanOrEqual(2); // no ×1/÷1
      expect(p.minA).toBeGreaterThan(p.minB); // subtraction always feasible (a > b)
      expect(p.minA).toBeGreaterThanOrEqual(4); // ambiguous (2,2) pair impossible
      expect(p.maxB).toBeGreaterThanOrEqual(p.minB);
      expect(p.operators.length).toBeGreaterThanOrEqual(2);
      expect(p.baseTimeMs).toBeGreaterThan(p.minTimeMs);
      expect(p.shrinkPerRound).toBeGreaterThan(0);
      expect(p.shrinkPerRound).toBeLessThanOrEqual(1);
      expect(p.rounds).toBeGreaterThanOrEqual(6);
      // Division-including levels keep round-0 division feasible.
      if (p.operators.includes('/')) {
        expect(p.minB).toBeLessThanOrEqual(Math.ceil(p.minA / 2));
        expect(p.maxB).toBeGreaterThanOrEqual(3);
      }
    }
    expect(ADAPTIVE_PARAMS.operators).toHaveLength(4);
    expect(mathMissingOperatorParamsForLevel('adaptive')).toEqual(ADAPTIVE_PARAMS);
  });

  it('returns fresh objects for each level', () => {
    expect(mathMissingOperatorParamsForLevel('normal')).not.toBe(
      MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS.normal,
    );
    expect(mathMissingOperatorParamsForLevel('normal')).toEqual(
      MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS.normal,
    );
  });
});

describe('resolveMathMissingOperatorDifficulty / paramsFromProfile', () => {
  it('resolves SDK default challenge ratings and round-trips parameters', () => {
    const profile = resolveMathMissingOperatorDifficulty('hard');
    expect(profile.level).toBe('hard');
    expect(profile.challengeRating).toBe(0.8);
    const params = mathMissingOperatorParamsFromProfile(profile);
    expect(params).toEqual(MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS.hard);
  });

  it('starts adaptive at the neutral baseline', () => {
    const profile = resolveMathMissingOperatorDifficulty('adaptive');
    expect(profile.level).toBe('adaptive');
    expect(profile.challengeRating).toBe(0.5);
    expect(mathMissingOperatorParamsFromProfile(profile)).toEqual(ADAPTIVE_PARAMS);
  });

  it('throws when a required numeric parameter is missing', () => {
    const profile = { level: 'hard' as const, challengeRating: 0.8, parameters: {} };
    expect(() => mathMissingOperatorParamsFromProfile(profile)).toThrow(
      /missing numeric parameter/,
    );
  });
});

describe('aMaxForRound', () => {
  it('escalates linearly from minA to maxA for fixed levels', () => {
    const params = MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS.normal;
    expect(aMaxForRound(params, 0, 'normal')).toBe(params.minA);
    expect(aMaxForRound(params, params.rounds - 1, 'normal')).toBe(params.maxA);
    const ceilings = Array.from({ length: params.rounds }, (_, i) =>
      aMaxForRound(params, i, 'normal'),
    );
    for (let i = 1; i < ceilings.length; i += 1) {
      expect(ceilings[i]).toBeGreaterThanOrEqual(ceilings[i - 1]);
    }
  });

  it('blends round index with the live rating for adaptive', () => {
    const params = ADAPTIVE_PARAMS;
    expect(aMaxForRound(params, 0, 'adaptive', 0.5)).toBe(params.minA);
    // A stronger rating yields a larger (or equal) ceiling at the same round.
    expect(aMaxForRound(params, 3, 'adaptive', 0.9)).toBeGreaterThanOrEqual(
      aMaxForRound(params, 3, 'adaptive', 0.3),
    );
    // Never leaves [minA, maxA].
    for (const rating of [0, 0.25, 0.5, 0.75, 1]) {
      const value = aMaxForRound(params, params.rounds - 1, 'adaptive', rating);
      expect(value).toBeGreaterThanOrEqual(params.minA);
      expect(value).toBeLessThanOrEqual(params.maxA);
    }
  });
});

describe('budgetForRound', () => {
  it('starts at baseTimeMs, shrinks monotonically, and stays above minTimeMs', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const params = MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS[level];
      expect(budgetForRound(params, 0)).toBe(params.baseTimeMs);
      const budgets = Array.from({ length: params.rounds }, (_, i) =>
        budgetForRound(params, i),
      );
      for (let i = 1; i < budgets.length; i += 1) {
        expect(budgets[i]).toBeLessThanOrEqual(budgets[i - 1]);
        expect(budgets[i]).toBeGreaterThanOrEqual(params.minTimeMs);
      }
    }
  });

  it('clamps at minTimeMs when the shrink would go below it', () => {
    const params = MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS.expert;
    expect(budgetForRound(params, 50)).toBe(params.minTimeMs);
    expect(budgetForRound(params, 50)).toBe(4000);
  });
});

describe('adaptiveRatingAfter', () => {
  it('moves by outcome: fast correct > correct > wrong > timeout', () => {
    expect(adaptiveRatingAfter(0.5, 'correct', true)).toBeCloseTo(0.6);
    expect(adaptiveRatingAfter(0.5, 'correct', false)).toBeCloseTo(0.58);
    expect(adaptiveRatingAfter(0.5, 'wrong')).toBeCloseTo(0.42);
    expect(adaptiveRatingAfter(0.5, 'timeout')).toBeCloseTo(0.38);
  });

  it('clamps to [0, 1]', () => {
    expect(adaptiveRatingAfter(0.98, 'correct', true)).toBe(1);
    expect(adaptiveRatingAfter(0.02, 'timeout')).toBe(0);
  });
});

describe('sessionChallengeRating', () => {
  it('reports the SDK default for fixed levels', () => {
    const profile = resolveMathMissingOperatorDifficulty('expert');
    expect(sessionChallengeRating('expert', profile, 0.3)).toBe(0.95);
  });

  it('reports the live rating for adaptive, clamped', () => {
    const profile = resolveMathMissingOperatorDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 0.7)).toBeCloseTo(0.7);
    expect(sessionChallengeRating('adaptive', profile, 1.2)).toBe(1);
    expect(sessionChallengeRating('adaptive', profile, -0.2)).toBe(0);
  });
});