// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import type { DifficultyLevel } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS,
  flexibilityRuleFlipParamsForLevel,
  flexibilityRuleFlipParamsFromProfile,
  nextBlockRule,
  resolveFlexibilityRuleFlipDifficulty,
  sessionChallengeRating,
} from '../difficulty';
import { ALL_RULES } from '../types';
import type { RuleId } from '../types';

describe('flexibilityRuleFlipParamsForLevel / resolve', () => {
  it('returns the canonical params for fixed levels (fresh objects)', () => {
    expect(flexibilityRuleFlipParamsForLevel('easy')).toEqual(FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.easy);
    const copy = flexibilityRuleFlipParamsForLevel('normal');
    expect(copy).not.toBe(FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal);
    // Mutating the copy must not touch the frozen defaults.
    (copy as { rounds: number }).rounds = 99;
    expect(FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal.rounds).toBe(10);
  });

  it('resolves fixed levels with the SDK default challenge ratings', () => {
    expect(resolveFlexibilityRuleFlipDifficulty('easy').challengeRating).toBe(0.2);
    expect(resolveFlexibilityRuleFlipDifficulty('normal').challengeRating).toBe(0.5);
    expect(resolveFlexibilityRuleFlipDifficulty('hard').challengeRating).toBe(0.8);
    expect(resolveFlexibilityRuleFlipDifficulty('expert').challengeRating).toBe(0.95);
    expect(resolveFlexibilityRuleFlipDifficulty('hard').level).toBe('hard');
  });

  it('adaptive uses the neutral baseline and its own tuning', () => {
    const profile = resolveFlexibilityRuleFlipDifficulty('adaptive');
    expect(profile.level).toBe('adaptive');
    expect(profile.challengeRating).toBe(0.5);
    expect(profile.parameters.flipRate).toBe(ADAPTIVE_PARAMS.flipRate);
    expect(flexibilityRuleFlipParamsForLevel('adaptive')).toEqual(ADAPTIVE_PARAMS);
  });

  it('scales difficulty: bigger alphabet + longer runs + rarer flips', () => {
    const easy = FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.easy;
    const expert = FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.expert;
    expect(expert.numShapes * expert.numColors * expert.numNumbers).toBeGreaterThan(
      easy.numShapes * easy.numColors * easy.numNumbers,
    );
    expect(expert.blockMin).toBeGreaterThanOrEqual(easy.blockMax);
    expect(expert.flipRate).toBeLessThan(easy.flipRate);
    expect(expert.speedTargetMs).toBeLessThan(easy.speedTargetMs);
  });

  it('keeps easy always cued and raises the uncued-window rate with tier', () => {
    const params = FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS;
    expect(params.easy.uncuedRate).toBe(0);
    expect(params.normal.uncuedRate).toBeGreaterThan(0);
    expect(params.hard.uncuedRate).toBeGreaterThan(params.normal.uncuedRate);
    expect(params.expert.uncuedRate).toBeGreaterThan(params.hard.uncuedRate);
    // Rates are probabilities.
    for (const level of ['normal', 'hard', 'expert', 'adaptive'] as const) {
      const rate = flexibilityRuleFlipParamsForLevel(level).uncuedRate;
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThan(1);
    }
  });
});

describe('flexibilityRuleFlipParamsFromProfile', () => {
  it('recovers params from a resolved profile (rulesPool rebuilt)', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const) {
      const profile = resolveFlexibilityRuleFlipDifficulty(level);
      const params = flexibilityRuleFlipParamsFromProfile(profile);
      expect(params.rulesPool).toEqual(ALL_RULES);
      expect(params.rounds).toBe(flexibilityRuleFlipParamsForLevel(level).rounds);
      expect(params.speedTargetMs).toBe(flexibilityRuleFlipParamsForLevel(level).speedTargetMs);
    }
  });

  it('throws on a missing or non-finite numeric parameter', () => {
    const profile = resolveFlexibilityRuleFlipDifficulty('normal');
    const broken = { ...profile, parameters: { rounds: 10 } } as typeof profile;
    expect(() => flexibilityRuleFlipParamsFromProfile(broken)).toThrow(/missing numeric parameter/);
    const nan = {
      ...profile,
      parameters: { ...profile.parameters, rounds: NaN },
    } as typeof profile;
    expect(() => flexibilityRuleFlipParamsFromProfile(nan)).toThrow();
  });

  it('preserves optional adaptive flip-rate bounds', () => {
    const params = flexibilityRuleFlipParamsFromProfile(resolveFlexibilityRuleFlipDifficulty('adaptive'));
    expect(params.minFlipRate).toBe(ADAPTIVE_PARAMS.minFlipRate);
    expect(params.maxFlipRate).toBe(ADAPTIVE_PARAMS.maxFlipRate);
    expect(flexibilityRuleFlipParamsFromProfile(resolveFlexibilityRuleFlipDifficulty('hard')).minFlipRate).toBeUndefined();
  });
});

describe('sessionChallengeRating', () => {
  it('returns the SDK default rating for fixed levels', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = resolveFlexibilityRuleFlipDifficulty(level as DifficultyLevel);
      expect(sessionChallengeRating(level, profile, 0.9)).toBe(profile.challengeRating);
    }
  });

  it('maps the adaptive flip rate linearly into [minFlipRate, maxFlipRate] → [0, 1]', () => {
    const profile = resolveFlexibilityRuleFlipDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, ADAPTIVE_PARAMS.minFlipRate!)).toBe(0);
    expect(sessionChallengeRating('adaptive', profile, ADAPTIVE_PARAMS.maxFlipRate!)).toBe(1);
    expect(sessionChallengeRating('adaptive', profile, 0.6)).toBeCloseTo(0.5);
    // Clamped outside the bounds.
    expect(sessionChallengeRating('adaptive', profile, 0)).toBe(0);
    expect(sessionChallengeRating('adaptive', profile, 1)).toBe(1);
  });

  it('falls back to the baseline when the adaptive span is degenerate', () => {
    const profile = resolveFlexibilityRuleFlipDifficulty('adaptive');
    const degenerate = {
      ...profile,
      parameters: { ...profile.parameters, minFlipRate: 0.5, maxFlipRate: 0.5 },
    } as typeof profile;
    expect(sessionChallengeRating('adaptive', degenerate, 0.5)).toBe(profile.challengeRating);
  });
});

describe('nextBlockRule', () => {
  const rngStub = (nextValue: number) => ({
    next: () => nextValue,
    pick: <T,>(items: readonly T[]): T => items[0],
  });

  it('flips to a different rule with probability flipRate', () => {
    const next = nextBlockRule(rngStub(0), 'color', 0.55, ALL_RULES);
    expect(next).not.toBe('color');
    expect(ALL_RULES).toContain(next);
  });

  it('stays when the roll exceeds the flip rate', () => {
    expect(nextBlockRule(rngStub(0.999), 'shape', 0.55, ALL_RULES)).toBe('shape');
  });

  it('stays when no other rule exists in the pool', () => {
    expect(nextBlockRule(rngStub(0), 'color', 0.9, ['color'] as readonly RuleId[])).toBe('color');
  });
});
