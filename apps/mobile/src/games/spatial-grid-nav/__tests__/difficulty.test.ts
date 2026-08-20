// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CHALLENGE_RATINGS } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  DIFFICULTY_PARAMS,
  paramsForLevel,
  paramsFromProfile,
  resolveSpatialGridNavDifficulty,
  sessionChallengeRating,
} from '../difficulty';

describe('Difficulty parameter mapping', () => {
  it('maps each fixed level to concrete grid/command/option tuning', () => {
    expect(DIFFICULTY_PARAMS.easy).toEqual({
      gridSide: 5,
      rounds: 6,
      minCommandCount: 3,
      maxCommandCount: 4,
      allowBack: false,
      options: 3,
      speedTargetMs: 6000,
      longThreshold: 4,
    });
    expect(DIFFICULTY_PARAMS.normal).toEqual({
      gridSide: 5,
      rounds: 7,
      minCommandCount: 4,
      maxCommandCount: 5,
      allowBack: true,
      options: 3,
      speedTargetMs: 5000,
      longThreshold: 5,
    });
    expect(DIFFICULTY_PARAMS.hard).toEqual({
      gridSide: 6,
      rounds: 8,
      minCommandCount: 5,
      maxCommandCount: 6,
      allowBack: true,
      options: 4,
      speedTargetMs: 4000,
      longThreshold: 6,
    });
    expect(DIFFICULTY_PARAMS.expert).toEqual({
      gridSide: 7,
      rounds: 9,
      minCommandCount: 6,
      maxCommandCount: 7,
      allowBack: true,
      options: 4,
      speedTargetMs: 3000,
      longThreshold: 7,
    });
  });

  it('defines adaptive tuning with min/max bounds', () => {
    expect(ADAPTIVE_PARAMS.gridSide).toBe(5);
    expect(ADAPTIVE_PARAMS.rounds).toBe(8);
    expect(ADAPTIVE_PARAMS.minCommandCount).toBe(4);
    expect(ADAPTIVE_PARAMS.maxCommandCount).toBe(6);
    expect(ADAPTIVE_PARAMS.minGridSide).toBe(5);
    expect(ADAPTIVE_PARAMS.maxGridSide).toBe(7);
    expect(ADAPTIVE_PARAMS.minMaxCommand).toBe(4);
    expect(ADAPTIVE_PARAMS.maxMaxCommand).toBe(7);
  });

  it('resolves levels through the SDK with the game parameters attached', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = resolveSpatialGridNavDifficulty(level);
      expect(profile.level).toBe(level);
      expect(profile.challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS[level]);
      expect(profile.parameters.gridSide).toBe(DIFFICULTY_PARAMS[level].gridSide);
    }
    const adaptive = resolveSpatialGridNavDifficulty('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
    expect(adaptive.parameters.minGridSide).toBe(5);
    expect(adaptive.parameters.maxGridSide).toBe(7);
  });

  it('returns fresh param objects (never mutates the frozen defaults)', () => {
    const a = paramsForLevel('easy');
    const b = paramsForLevel('easy');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a).not.toBe(DIFFICULTY_PARAMS.easy);
  });
});

describe('paramsFromProfile round-trip', () => {
  it('reconstructs parameters from a resolved profile', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const) {
      const profile = resolveSpatialGridNavDifficulty(level);
      const params = paramsFromProfile(profile);
      expect(params).toEqual(paramsForLevel(level));
    }
  });

  it('round-trips allowBack as a boolean', () => {
    const easy = resolveSpatialGridNavDifficulty('easy');
    expect(paramsFromProfile(easy).allowBack).toBe(false);
    const normal = resolveSpatialGridNavDifficulty('normal');
    expect(paramsFromProfile(normal).allowBack).toBe(true);
  });
});

describe('sessionChallengeRating', () => {
  it('reports the SDK default rating for fixed levels', () => {
    const profile = resolveSpatialGridNavDifficulty('hard');
    expect(sessionChallengeRating('hard', profile, 6)).toBe(profile.challengeRating);
  });

  it('maps the adaptive final grid side linearly into [0, 1]', () => {
    const profile = resolveSpatialGridNavDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 5)).toBe(0);
    expect(sessionChallengeRating('adaptive', profile, 6)).toBeCloseTo(0.5);
    expect(sessionChallengeRating('adaptive', profile, 7)).toBe(1);
  });
});
