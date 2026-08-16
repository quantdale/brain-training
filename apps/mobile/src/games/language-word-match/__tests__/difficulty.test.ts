// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CHALLENGE_RATINGS } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  LANGUAGE_DIFFICULTY_PARAMS,
  languageParamsForLevel,
  languageParamsFromProfile,
  nextRoundParams,
  resolveLanguageDifficulty,
  sessionChallengeRating,
  tierNumber,
  tierOfNumber,
  tiersFromMask,
} from '../difficulty';
import type { LanguageDifficultyParams } from '../types';

describe('Language difficulty parameter mapping', () => {
  it('maps each fixed level to concrete tier-pool/rounds/budget tuning', () => {
    expect(LANGUAGE_DIFFICULTY_PARAMS.easy).toEqual({ tierMask: 1, rounds: 5, timePerRoundMs: 10000 });
    expect(LANGUAGE_DIFFICULTY_PARAMS.normal).toEqual({ tierMask: 3, rounds: 6, timePerRoundMs: 8000 });
    expect(LANGUAGE_DIFFICULTY_PARAMS.hard).toEqual({ tierMask: 6, rounds: 7, timePerRoundMs: 6500 });
    expect(LANGUAGE_DIFFICULTY_PARAMS.expert).toEqual({ tierMask: 4, rounds: 8, timePerRoundMs: 5000 });
  });

  it('defines adaptive tuning with tier + time-budget bounds', () => {
    expect(ADAPTIVE_PARAMS).toEqual({
      tierMask: 7,
      rounds: 6,
      timePerRoundMs: 6000,
      minTimePerRoundMs: 4000,
      maxTimePerRoundMs: 9000,
      timeStepMs: 500,
      initialTier: 1,
    });
  });

  it('resolves levels through the SDK with the game parameters attached', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = resolveLanguageDifficulty(level);
      expect(profile.level).toBe(level);
      expect(profile.challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS[level]);
      expect(profile.parameters).toEqual(languageParamsForLevel(level));
    }
    const adaptive = resolveLanguageDifficulty('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
    expect(adaptive.parameters).toEqual(ADAPTIVE_PARAMS);
  });

  it('returns fresh param objects (never mutates the frozen defaults)', () => {
    const a = languageParamsForLevel('easy');
    const b = languageParamsForLevel('easy');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a).not.toBe(LANGUAGE_DIFFICULTY_PARAMS.easy);
  });

  it('round-trips parameters through a resolved profile', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const) {
      const params = languageParamsFromProfile(resolveLanguageDifficulty(level));
      expect(params).toEqual(languageParamsForLevel(level));
    }
  });

  it('rejects profiles missing or corrupting required parameters', () => {
    const profile = resolveLanguageDifficulty('normal');
    const { timePerRoundMs: _omitted, ...incomplete } = profile.parameters;
    expect(() => languageParamsFromProfile({ ...profile, parameters: incomplete })).toThrow(
      /timePerRoundMs/,
    );
    expect(() =>
      languageParamsFromProfile({ ...profile, parameters: { ...profile.parameters, tierMask: 0 } }),
    ).toThrow(/tierMask/);
    expect(() =>
      languageParamsFromProfile({ ...profile, parameters: { ...profile.parameters, rounds: 0 } }),
    ).toThrow(/rounds/);
    const adaptive = resolveLanguageDifficulty('adaptive');
    expect(() =>
      languageParamsFromProfile({ ...adaptive, parameters: { ...adaptive.parameters, initialTier: 9 } }),
    ).toThrow(/initialTier/);
  });
});

describe('tier helpers', () => {
  it('maps tiers to bits and ordinals and back', () => {
    expect(tierNumber('t1')).toBe(1);
    expect(tierNumber('t3')).toBe(3);
    expect(tierOfNumber(1)).toBe('t1');
    expect(tierOfNumber(3)).toBe('t3');
    expect(() => tierOfNumber(4)).toThrow(RangeError);
  });

  it('decodes tier masks in stable t1→t3 order', () => {
    expect(tiersFromMask(1)).toEqual(['t1']);
    expect(tiersFromMask(3)).toEqual(['t1', 't2']);
    expect(tiersFromMask(6)).toEqual(['t2', 't3']);
    expect(tiersFromMask(4)).toEqual(['t3']);
    expect(tiersFromMask(7)).toEqual(['t1', 't2', 't3']);
    expect(() => tiersFromMask(0)).toThrow(RangeError);
    expect(() => tiersFromMask(8)).toThrow(RangeError);
  });
});

describe('nextRoundParams', () => {
  const fixedParams: LanguageDifficultyParams = { tierMask: 3, rounds: 6, timePerRoundMs: 8000 };

  it('holds fixed levels at their tier pool and budget regardless of outcome', () => {
    expect(nextRoundParams('normal', fixedParams, null, 8000, true)).toEqual({
      tiers: ['t1', 't2'],
      timePerRoundMs: 8000,
      currentTier: null,
    });
    expect(nextRoundParams('normal', fixedParams, null, 8000, false)).toEqual({
      tiers: ['t1', 't2'],
      timePerRoundMs: 8000,
      currentTier: null,
    });
  });

  it('moves adaptive ±1 tier and ±step budget, clamped to the bounds', () => {
    const adaptive = ADAPTIVE_PARAMS;
    // Pass from t1/6000 → t2/5500.
    expect(nextRoundParams('adaptive', adaptive, 't1', 6000, true)).toEqual({
      tiers: ['t2'],
      timePerRoundMs: 5500,
      currentTier: 't2',
    });
    // Fail from t2/5500 → t1/6000.
    expect(nextRoundParams('adaptive', adaptive, 't2', 5500, false)).toEqual({
      tiers: ['t1'],
      timePerRoundMs: 6000,
      currentTier: 't1',
    });
    // Bounds: already at t3 and min budget → hold.
    expect(nextRoundParams('adaptive', adaptive, 't3', 4000, true)).toEqual({
      tiers: ['t3'],
      timePerRoundMs: 4000,
      currentTier: 't3',
    });
    // Bounds: already at t1 and max budget → hold.
    expect(nextRoundParams('adaptive', adaptive, 't1', 9000, false)).toEqual({
      tiers: ['t1'],
      timePerRoundMs: 9000,
      currentTier: 't1',
    });
    // A timeout is a fail: tier down, budget up.
    expect(nextRoundParams('adaptive', adaptive, 't2', 6000, false)).toEqual({
      tiers: ['t1'],
      timePerRoundMs: 6500,
      currentTier: 't1',
    });
  });
});

describe('sessionChallengeRating', () => {
  it('reports the SDK default rating for fixed levels', () => {
    const profile = resolveLanguageDifficulty('hard');
    expect(sessionChallengeRating('hard', profile, null)).toBe(profile.challengeRating);
  });

  it('maps the adaptive final tier linearly into [0, 1]', () => {
    const profile = resolveLanguageDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 't1')).toBe(0);
    expect(sessionChallengeRating('adaptive', profile, 't2')).toBe(0.5);
    expect(sessionChallengeRating('adaptive', profile, 't3')).toBe(1);
    expect(sessionChallengeRating('adaptive', profile, null)).toBe(profile.challengeRating);
  });
});
