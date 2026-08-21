// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CHALLENGE_RATINGS } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  TAP_RUSH_DIFFICULTY_PARAMS,
  nextWindowMs,
  resolveTapRushDifficulty,
  sessionChallengeRating,
  tapRushParamsForLevel,
  tapRushParamsFromProfile,
} from '../difficulty';
import type { TapRushDifficultyParams } from '../types';

describe('Tap Rush difficulty parameter mapping', () => {
  it('maps each fixed level to concrete count/window/size tuning', () => {
    expect(TAP_RUSH_DIFFICULTY_PARAMS.easy).toEqual({
      count: 8,
      rounds: 3,
      initialWindowMs: 1400,
      minWindowMs: 900,
      windowStepMs: 100,
      targetRadius: 0.09,
    });
    expect(TAP_RUSH_DIFFICULTY_PARAMS.normal).toEqual({
      count: 10,
      rounds: 4,
      initialWindowMs: 1100,
      minWindowMs: 700,
      windowStepMs: 100,
      targetRadius: 0.075,
    });
    expect(TAP_RUSH_DIFFICULTY_PARAMS.hard).toEqual({
      count: 12,
      rounds: 5,
      initialWindowMs: 850,
      minWindowMs: 550,
      windowStepMs: 100,
      targetRadius: 0.06,
    });
    expect(TAP_RUSH_DIFFICULTY_PARAMS.expert).toEqual({
      count: 14,
      rounds: 5,
      initialWindowMs: 700,
      minWindowMs: 450,
      windowStepMs: 100,
      targetRadius: 0.05,
    });
  });

  it('defines adaptive tuning with window bounds straddling the neutral 0.5', () => {
    expect(ADAPTIVE_PARAMS).toEqual({
      count: 10,
      rounds: 4,
      initialWindowMs: 1100,
      minWindowMs: 600,
      windowStepMs: 100,
      targetRadius: 0.075,
      maxWindowBoundMs: 1600,
    });
    // (1100 - 600) / (1600 - 600) = 0.5 → rating 1 - 0.5 = 0.5
    expect(sessionChallengeRating('adaptive', resolveTapRushDifficulty('adaptive'), 1100)).toBe(0.5);
  });

  it('resolves levels through the SDK with the game parameters attached', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = resolveTapRushDifficulty(level);
      expect(profile.level).toBe(level);
      expect(profile.challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS[level]);
      expect(profile.parameters).toEqual(tapRushParamsForLevel(level));
    }
    const adaptive = resolveTapRushDifficulty('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
    expect(adaptive.parameters).toEqual(ADAPTIVE_PARAMS);
  });

  it('returns fresh param objects (never mutates the frozen defaults)', () => {
    const a = tapRushParamsForLevel('easy');
    const b = tapRushParamsForLevel('easy');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a).not.toBe(TAP_RUSH_DIFFICULTY_PARAMS.easy);
  });

  it('round-trips parameters through a resolved profile', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const) {
      const params = tapRushParamsFromProfile(resolveTapRushDifficulty(level));
      expect(params).toEqual(tapRushParamsForLevel(level));
    }
  });

  it('rejects profiles missing a required parameter', () => {
    const profile = resolveTapRushDifficulty('normal');
    const { targetRadius: _omitted, ...incomplete } = profile.parameters;
    expect(() => tapRushParamsFromProfile({ ...profile, parameters: incomplete })).toThrow(
      /targetRadius/,
    );
  });
});

describe('nextWindowMs', () => {
  it('shrinks fixed levels by the step on a pass, floored at minWindowMs', () => {
    expect(nextWindowMs(1100, true, 'normal', TAP_RUSH_DIFFICULTY_PARAMS.normal)).toBe(1000);
    expect(nextWindowMs(700, true, 'normal', TAP_RUSH_DIFFICULTY_PARAMS.normal)).toBe(700); // floor
  });

  it('holds the window on a fixed-level failure', () => {
    expect(nextWindowMs(1100, false, 'normal', TAP_RUSH_DIFFICULTY_PARAMS.normal)).toBe(1100);
  });

  it('moves ±step within [min, max] for adaptive, smaller = harder', () => {
    expect(nextWindowMs(1100, true, 'adaptive', ADAPTIVE_PARAMS)).toBe(1000);
    expect(nextWindowMs(1100, false, 'adaptive', ADAPTIVE_PARAMS)).toBe(1200);
    expect(nextWindowMs(600, true, 'adaptive', ADAPTIVE_PARAMS)).toBe(600); // lower clamp
    expect(nextWindowMs(1600, false, 'adaptive', ADAPTIVE_PARAMS)).toBe(1600); // upper clamp
  });
});

describe('sessionChallengeRating', () => {
  it('reports the SDK default rating for fixed levels', () => {
    const profile = resolveTapRushDifficulty('hard');
    expect(sessionChallengeRating('hard', profile, 850)).toBe(profile.challengeRating);
  });

  it('maps the adaptive final window linearly into [0, 1] (inverted)', () => {
    const profile = resolveTapRushDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 600)).toBe(1); // fastest
    expect(sessionChallengeRating('adaptive', profile, 1100)).toBe(0.5);
    expect(sessionChallengeRating('adaptive', profile, 1350)).toBe(0.25);
    expect(sessionChallengeRating('adaptive', profile, 1600)).toBe(0); // slowest
    // Out-of-bound windows clamp instead of escaping [0, 1].
    expect(sessionChallengeRating('adaptive', profile, 400)).toBe(1);
    expect(sessionChallengeRating('adaptive', profile, 2000)).toBe(0);
  });
});