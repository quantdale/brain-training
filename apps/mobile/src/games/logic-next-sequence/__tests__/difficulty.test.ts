// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CHALLENGE_RATINGS } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  LOGIC_DIFFICULTY_PARAMS,
  MAX_TIER,
  logicParamsForLevel,
  logicParamsFromProfile,
  nextAdaptiveTier,
  referenceMsForTier,
  resolveLogicDifficulty,
  sessionChallengeRating,
  visibleLengthForTier,
} from '../difficulty';
import type { LogicDifficultyParams } from '../types';

describe('Logic difficulty parameter mapping', () => {
  it('maps each fixed level to concrete rounds/tier/length/bounds tuning', () => {
    expect(LOGIC_DIFFICULTY_PARAMS.easy).toEqual({
      rounds: 4,
      recipeTier: 0,
      visibleLength: 3,
      minValue: 0,
      maxValue: 100,
      referenceMs: 9000,
    });
    expect(LOGIC_DIFFICULTY_PARAMS.normal).toEqual({
      rounds: 5,
      recipeTier: 1,
      visibleLength: 4,
      minValue: 0,
      maxValue: 250,
      referenceMs: 8000,
    });
    expect(LOGIC_DIFFICULTY_PARAMS.hard).toEqual({
      rounds: 6,
      recipeTier: 2,
      visibleLength: 5,
      minValue: 0,
      maxValue: 500,
      referenceMs: 7000,
    });
    expect(LOGIC_DIFFICULTY_PARAMS.expert).toEqual({
      rounds: 7,
      recipeTier: 3,
      visibleLength: 6,
      minValue: 0,
      maxValue: 1000,
      referenceMs: 6000,
    });
  });

  it('defines adaptive tuning with tier bounds', () => {
    expect(ADAPTIVE_PARAMS).toEqual({
      rounds: 6,
      recipeTier: 1,
      visibleLength: 4,
      minValue: 0,
      maxValue: 500,
      referenceMs: 8000,
      minTier: 0,
      maxTier: 3,
    });
  });

  it('derives visible length and reference timing from the tier', () => {
    expect(MAX_TIER).toBe(3);
    expect(visibleLengthForTier(0)).toBe(3);
    expect(visibleLengthForTier(3)).toBe(6);
    expect(referenceMsForTier(0)).toBe(9000);
    expect(referenceMsForTier(3)).toBe(6000);
    // Fixed levels are internally consistent with their tier derivations.
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const params = LOGIC_DIFFICULTY_PARAMS[level];
      expect(params.visibleLength).toBe(visibleLengthForTier(params.recipeTier));
      expect(params.referenceMs).toBe(referenceMsForTier(params.recipeTier));
    }
  });

  it('resolves levels through the SDK with the game parameters attached', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = resolveLogicDifficulty(level);
      expect(profile.level).toBe(level);
      expect(profile.challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS[level]);
      expect(profile.parameters).toEqual(logicParamsForLevel(level));
    }
    const adaptive = resolveLogicDifficulty('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
    expect(adaptive.parameters).toEqual(ADAPTIVE_PARAMS);
  });

  it('returns fresh param objects (never mutates the frozen defaults)', () => {
    const a = logicParamsForLevel('easy');
    const b = logicParamsForLevel('easy');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a).not.toBe(LOGIC_DIFFICULTY_PARAMS.easy);
  });

  it('round-trips parameters through a resolved profile', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const) {
      const params = logicParamsFromProfile(resolveLogicDifficulty(level));
      expect(params).toEqual(logicParamsForLevel(level));
    }
  });

  it('rejects profiles missing a required parameter', () => {
    const profile = resolveLogicDifficulty('normal');
    const { rounds: _omitted, ...incomplete } = profile.parameters;
    expect(() => logicParamsFromProfile({ ...profile, parameters: incomplete })).toThrow(
      /rounds/,
    );
  });
});

describe('nextAdaptiveTier', () => {
  const adaptive: LogicDifficultyParams = { ...ADAPTIVE_PARAMS };

  it('moves ±1 within [minTier, maxTier]', () => {
    expect(nextAdaptiveTier(1, true, adaptive)).toBe(2);
    expect(nextAdaptiveTier(1, false, adaptive)).toBe(0);
    expect(nextAdaptiveTier(3, true, adaptive)).toBe(3); // capped
    expect(nextAdaptiveTier(0, false, adaptive)).toBe(0); // floored
  });

  it('ignores fixed-level tiers (adaptive rule only applies to adaptive play)', () => {
    expect(nextAdaptiveTier(1, true, LOGIC_DIFFICULTY_PARAMS.normal)).toBe(2);
  });
});

describe('sessionChallengeRating', () => {
  it('reports the SDK default rating for fixed levels', () => {
    const profile = resolveLogicDifficulty('hard');
    expect(sessionChallengeRating('hard', profile, 2)).toBe(profile.challengeRating);
  });

  it('maps the adaptive final tier linearly into [0, 1]', () => {
    const profile = resolveLogicDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 0)).toBe(0);
    expect(sessionChallengeRating('adaptive', profile, 1.5)).toBe(0.5);
    expect(sessionChallengeRating('adaptive', profile, 3)).toBe(1);
  });
});
