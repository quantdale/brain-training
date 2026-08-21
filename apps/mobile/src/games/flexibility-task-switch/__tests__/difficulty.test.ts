// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import type { DifficultyLevel } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  DIFFICULTY_PARAMS,
  flexibilityTaskSwitchParamsFromProfile,
  paramsForLevel,
  resolveFlexibilityTaskSwitchDifficulty,
  sessionChallengeRating,
} from '../difficulty';

const LEVELS: DifficultyLevel[] = ['easy', 'normal', 'hard', 'expert', 'adaptive'];

describe('paramsForLevel', () => {
  it('returns the frozen defaults for fixed levels', () => {
    expect(paramsForLevel('easy')).toEqual(DIFFICULTY_PARAMS.easy);
    expect(paramsForLevel('hard')).toEqual(DIFFICULTY_PARAMS.hard);
  });

  it('returns a fresh object: mutating it never touches the defaults', () => {
    const copy = paramsForLevel('normal');
    (copy as { rounds: number }).rounds = -1;
    expect(DIFFICULTY_PARAMS.normal.rounds).toBe(12);
    expect(ADAPTIVE_PARAMS.rounds).toBe(12);
  });

  it('scales difficulty upward across fixed levels', () => {
    expect(DIFFICULTY_PARAMS.easy.rounds).toBeLessThan(DIFFICULTY_PARAMS.expert.rounds);
    expect(DIFFICULTY_PARAMS.easy.switchRate).toBeLessThan(DIFFICULTY_PARAMS.expert.switchRate);
    // Adding the color task grows both the task pool and the answer alphabet.
    expect(DIFFICULTY_PARAMS.easy.taskPool).not.toContain('color');
    expect(DIFFICULTY_PARAMS.hard.taskPool).toContain('color');
    expect(DIFFICULTY_PARAMS.easy.numColors).toBeLessThan(DIFFICULTY_PARAMS.hard.numColors);
    expect(DIFFICULTY_PARAMS.easy.speedTargetMs).toBeGreaterThan(DIFFICULTY_PARAMS.expert.speedTargetMs);
  });
});

describe('resolveFlexibilityTaskSwitchDifficulty', () => {
  it('carries the SDK default challenge ratings for fixed levels', () => {
    expect(resolveFlexibilityTaskSwitchDifficulty('easy').challengeRating).toBe(0.2);
    expect(resolveFlexibilityTaskSwitchDifficulty('normal').challengeRating).toBe(0.5);
    expect(resolveFlexibilityTaskSwitchDifficulty('hard').challengeRating).toBe(0.8);
    expect(resolveFlexibilityTaskSwitchDifficulty('expert').challengeRating).toBe(0.95);
  });

  it('starts adaptive at the neutral baseline with its tuning attached', () => {
    const profile = resolveFlexibilityTaskSwitchDifficulty('adaptive');
    expect(profile.level).toBe('adaptive');
    expect(profile.challengeRating).toBe(0.5);
    expect(profile.parameters.rounds).toBe(ADAPTIVE_PARAMS.rounds);
    expect(profile.parameters.minSwitchRate).toBe(ADAPTIVE_PARAMS.minSwitchRate);
    expect(profile.parameters.maxSwitchRate).toBe(ADAPTIVE_PARAMS.maxSwitchRate);
  });

  it('encodes the task pool as numeric flags in the parameters map', () => {
    const easy = resolveFlexibilityTaskSwitchDifficulty('easy').parameters;
    expect(easy.task_parity).toBe(1);
    expect(easy.task_magnitude).toBe(1);
    expect(easy.task_color).toBe(0);
    const hard = resolveFlexibilityTaskSwitchDifficulty('hard').parameters;
    expect(hard.task_color).toBe(1);
  });
});

describe('flexibilityTaskSwitchParamsFromProfile', () => {
  it('round-trips every level through the numeric-only profile map', () => {
    for (const level of LEVELS) {
      const original = paramsForLevel(level);
      const recovered = flexibilityTaskSwitchParamsFromProfile(
        resolveFlexibilityTaskSwitchDifficulty(level),
      );
      expect(recovered).toEqual(original);
    }
  });

  it('throws on a missing or non-finite numeric parameter', () => {
    const profile = resolveFlexibilityTaskSwitchDifficulty('normal');
    const broken = { ...profile, parameters: { rounds: 12 } } as typeof profile;
    expect(() => flexibilityTaskSwitchParamsFromProfile(broken)).toThrow(/switchRate/);
  });
});

describe('sessionChallengeRating', () => {
  it('returns the SDK default rating for fixed levels regardless of switch rate', () => {
    const hard = resolveFlexibilityTaskSwitchDifficulty('hard');
    expect(sessionChallengeRating('hard', hard, 0.1)).toBe(0.8);
    expect(sessionChallengeRating('hard', hard, 0.9)).toBe(0.8);
  });

  it('maps the final switch rate linearly into [0, 1] for adaptive', () => {
    const profile = resolveFlexibilityTaskSwitchDifficulty('adaptive');
    // minSwitchRate .3 / maxSwitchRate .8 → span .5.
    expect(sessionChallengeRating('adaptive', profile, 0.3)).toBeCloseTo(0);
    expect(sessionChallengeRating('adaptive', profile, 0.55)).toBeCloseTo(0.5);
    expect(sessionChallengeRating('adaptive', profile, 0.8)).toBeCloseTo(1);
    // Clamped outside the bounds.
    expect(sessionChallengeRating('adaptive', profile, 0.95)).toBeCloseTo(1);
    expect(sessionChallengeRating('adaptive', profile, 0.1)).toBeCloseTo(0);
  });
});
