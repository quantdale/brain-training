// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import type { DifficultyLevel } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  DIFFICULTY_PARAMS,
  adaptiveProgressFraction,
  applyAdaptiveTuning,
  deescalateAdaptiveTuning,
  escalateAdaptiveTuning,
  initialAdaptiveTuning,
  maxAdaptiveTuning,
  paramsForLevel,
  resolveSpatialCoordinateTurnDifficulty,
  sessionChallengeRating,
  spatialCoordinateTurnParamsFromProfile,
} from '../difficulty';
import type { AdaptiveTuning } from '../types';

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
  const MIN_TUNING: AdaptiveTuning = { directions: 4, maxSteps: 3, moveMax: 2 };
  const MAX_TUNING: AdaptiveTuning = { directions: 8, maxSteps: 6, moveMax: 4 };

  it('reports the SDK default rating for fixed levels, ignoring any tuning', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = resolveSpatialCoordinateTurnDifficulty(level);
      expect(sessionChallengeRating(level, profile, MAX_TUNING)).toBe(profile.challengeRating);
    }
  });

  it('maps the reached adaptive envelope into [0, 1] over the declared axes', () => {
    const profile = resolveSpatialCoordinateTurnDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, MIN_TUNING)).toBeCloseTo(0);
    expect(sessionChallengeRating('adaptive', profile, MAX_TUNING)).toBeCloseTo(1);
    // One axis at maximum, the other two at minimum → 1/3.
    expect(
      sessionChallengeRating('adaptive', profile, { directions: 8, maxSteps: 3, moveMax: 2 }),
    ).toBeCloseTo(1 / 3);
  });

  it('reports the profile baseline when no tuning was reached', () => {
    const profile = resolveSpatialCoordinateTurnDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile)).toBe(profile.challengeRating);
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
    expect(sessionChallengeRating('adaptive', degenerate, MAX_TUNING)).toBe(0.42);
  });
});

describe('adaptive ladder', () => {
  const params = spatialCoordinateTurnParamsFromProfile(
    resolveSpatialCoordinateTurnDifficulty('adaptive'),
  );

  it('starts every axis at its declared minimum', () => {
    expect(initialAdaptiveTuning(params)).toEqual({ directions: 4, maxSteps: 3, moveMax: 2 });
  });

  it('escalates one axis per correct round, lowest axis first', () => {
    let tuning = initialAdaptiveTuning(params);
    // All axes are equally low; the gentle-first order raises the command
    // length, then the movement distance, then the direction set.
    tuning = escalateAdaptiveTuning(params, tuning);
    expect(tuning).toEqual({ directions: 4, maxSteps: 4, moveMax: 2 });
    tuning = escalateAdaptiveTuning(params, tuning);
    expect(tuning).toEqual({ directions: 4, maxSteps: 4, moveMax: 3 });
    tuning = escalateAdaptiveTuning(params, tuning);
    expect(tuning).toEqual({ directions: 8, maxSteps: 4, moveMax: 3 });
    expect(adaptiveProgressFraction(params, tuning)).toBeCloseTo((1 + 1 / 3 + 0.5) / 3);
  });

  it('never escalates past the declared maximum', () => {
    let tuning: AdaptiveTuning = { directions: 8, maxSteps: 6, moveMax: 4 };
    for (let i = 0; i < 5; i += 1) {
      tuning = escalateAdaptiveTuning(params, tuning);
    }
    expect(tuning).toEqual({ directions: 8, maxSteps: 6, moveMax: 4 });
    expect(adaptiveProgressFraction(params, tuning)).toBe(1);
  });

  it('de-escalates the highest axis first and never below the minimum', () => {
    let tuning: AdaptiveTuning = { directions: 8, maxSteps: 6, moveMax: 4 };
    tuning = deescalateAdaptiveTuning(params, tuning);
    expect(tuning).toEqual({ directions: 8, maxSteps: 5, moveMax: 4 });
    let low = initialAdaptiveTuning(params);
    for (let i = 0; i < 5; i += 1) {
      low = deescalateAdaptiveTuning(params, low);
    }
    expect(low).toEqual({ directions: 4, maxSteps: 3, moveMax: 2 });
  });

  it('tracks the per-axis maximum envelope', () => {
    const a: AdaptiveTuning = { directions: 4, maxSteps: 5, moveMax: 2 };
    const b: AdaptiveTuning = { directions: 8, maxSteps: 3, moveMax: 4 };
    expect(maxAdaptiveTuning(a, b)).toEqual({ directions: 8, maxSteps: 5, moveMax: 4 });
  });

  it('applies tuning onto fresh params without mutating the profile params', () => {
    const tuned = applyAdaptiveTuning(params, { directions: 8, maxSteps: 5, moveMax: 3 });
    expect(tuned.directions).toBe(8);
    expect(tuned.maxSteps).toBe(5);
    expect(tuned.moveMax).toBe(3);
    expect(params.directions).toBe(4);
    expect(params.maxSteps).toBe(5); // base value unchanged
  });
});
