// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import type { DifficultyLevel } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  DIFFICULTY_PARAMS,
  paramsForLevel,
  resolveSpatialCoordinateTurnDifficulty,
  sessionChallengeRating,
  spatialCoordinateTurnParamsFromProfile,
} from '../difficulty';

const LEVELS: readonly DifficultyLevel[] = ['easy', 'normal', 'hard', 'expert', 'adaptive'];

describe('paramsForLevel / resolveSpatialCoordinateTurnDifficulty', () => {
  it('returns the documented tuning per fixed level', () => {
    expect(paramsForLevel('easy')).toEqual(DIFFICULTY_PARAMS.easy);
    expect(paramsForLevel('normal').rounds).toBe(10);
    expect(paramsForLevel('hard').directions).toBe(8);
    expect(paramsForLevel('expert').askPosition).toBe(true);
  });

  it('returns a fresh object so callers cannot mutate the defaults', () => {
    const copy = paramsForLevel('normal');
    (copy as { rounds: number }).rounds = 99;
    expect(DIFFICULTY_PARAMS.normal.rounds).toBe(10);
  });

  it('resolves fixed levels to the SDK default challenge ratings', () => {
    expect(resolveSpatialCoordinateTurnDifficulty('easy')).toEqual(
      expect.objectContaining({ level: 'easy', challengeRating: 0.2 }),
    );
    expect(resolveSpatialCoordinateTurnDifficulty('normal').challengeRating).toBe(0.5);
    expect(resolveSpatialCoordinateTurnDifficulty('hard').challengeRating).toBe(0.8);
    expect(resolveSpatialCoordinateTurnDifficulty('expert').challengeRating).toBe(0.95);
  });

  it('carries the numeric tuning in the resolved profile parameters', () => {
    const params = resolveSpatialCoordinateTurnDifficulty('normal').parameters;
    expect(params).toEqual(
      expect.objectContaining({
        directions: 4,
        rounds: 10,
        minSteps: 3,
        maxSteps: 4,
        moveMax: 3,
        askPosition: 0,
        speedTargetMs: 5000,
      }),
    );
    // Adaptive-only bounds are absent for fixed levels.
    expect(params.minDirections).toBeUndefined();
  });

  it('adaptive starts at the neutral baseline with its bounds attached', () => {
    const profile = resolveSpatialCoordinateTurnDifficulty('adaptive');
    expect(profile.level).toBe('adaptive');
    expect(profile.challengeRating).toBe(0.5);
    expect(profile.parameters).toEqual(
      expect.objectContaining({
        directions: ADAPTIVE_PARAMS.directions,
        minDirections: 4,
        maxDirections: 8,
        minMaxSteps: 3,
        maxMaxSteps: 6,
        minMoveMax: 2,
        maxMoveMax: 4,
      }),
    );
  });
});

describe('spatialCoordinateTurnParamsFromProfile', () => {
  it('recovers exactly the params it wrote for every level', () => {
    for (const level of LEVELS) {
      const profile = resolveSpatialCoordinateTurnDifficulty(level);
      expect(spatialCoordinateTurnParamsFromProfile(profile)).toEqual(paramsForLevel(level));
    }
  });

  it('throws on missing numeric parameters instead of producing a broken round', () => {
    const profile = resolveSpatialCoordinateTurnDifficulty('normal');
    expect(() =>
      spatialCoordinateTurnParamsFromProfile({
        level: 'normal',
        challengeRating: 0.5,
        parameters: {},
      }),
    ).toThrow();
    expect(() =>
      spatialCoordinateTurnParamsFromProfile({
        level: 'normal',
        challengeRating: 0.5,
        parameters: {
          directions: 4,
          rounds: 10,
          maxSteps: 4,
          moveMax: 3,
          askPosition: 0,
          speedTargetMs: 5000,
        },
      }),
    ).toThrow(/minSteps/);
  });

  it('throws when the direction count is neither 4 nor 8', () => {
    expect(() =>
      spatialCoordinateTurnParamsFromProfile({
        level: 'normal',
        challengeRating: 0.5,
        parameters: {
          directions: 6,
          rounds: 10,
          minSteps: 3,
          maxSteps: 4,
          moveMax: 3,
          askPosition: 0,
          speedTargetMs: 5000,
        },
      }),
    ).toThrow(/directions/);
  });
});

describe('sessionChallengeRating', () => {
  it('reports the SDK default rating for fixed levels', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = resolveSpatialCoordinateTurnDifficulty(level);
      expect(sessionChallengeRating(level, profile, 8)).toBe(profile.challengeRating);
    }
  });

  it('maps the final direction count into [0, 1] over the adaptive bounds', () => {
    const profile = resolveSpatialCoordinateTurnDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 4)).toBeCloseTo(0); // minDirections
    expect(sessionChallengeRating('adaptive', profile, 8)).toBeCloseTo(1); // maxDirections
    expect(sessionChallengeRating('adaptive', profile, 6)).toBeCloseTo(0.5); // midpoint of 4..8
  });

  it('clamps out-of-range direction counts and defaults to the base count', () => {
    const profile = resolveSpatialCoordinateTurnDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 100)).toBe(1);
    expect(sessionChallengeRating('adaptive', profile, 0)).toBe(0);
    expect(sessionChallengeRating('adaptive', profile)).toBe(0); // directions defaults to 4 = min
  });

  it('falls back to the profile rating when no span is configurable', () => {
    const degenerate = {
      level: 'adaptive' as const,
      challengeRating: 0.42,
      parameters: {
        directions: 4,
        rounds: 5,
        minSteps: 2,
        maxSteps: 2,
        moveMax: 2,
        askPosition: 0,
        speedTargetMs: 1000,
      },
    };
    expect(sessionChallengeRating('adaptive', degenerate, 4)).toBe(0.42);
  });
});
