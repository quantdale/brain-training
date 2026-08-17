// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CHALLENGE_RATINGS } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  SPEED_COLOR_MATCH_DIFFICULTY_PARAMS,
  nextIncongruentRatio,
  resolveSpeedColorMatchDifficulty,
  sessionChallengeRating,
  speedColorMatchParamsForLevel,
  speedColorMatchParamsFromProfile,
} from '../difficulty';
import type { SpeedColorMatchDifficultyParams } from '../types';

describe('Speed Color Match difficulty parameter mapping', () => {
  it('maps each fixed level to concrete tuning', () => {
    expect(SPEED_COLOR_MATCH_DIFFICULTY_PARAMS.easy).toEqual({
      trials: 15,
      incongruentRatio: 0.2,
      timeBudgetMs: 45_000,
      stimulusTimeoutMs: 5_000,
    });
    expect(SPEED_COLOR_MATCH_DIFFICULTY_PARAMS.normal).toEqual({
      trials: 20,
      incongruentRatio: 0.4,
      timeBudgetMs: 40_000,
      stimulusTimeoutMs: 4_000,
    });
    expect(SPEED_COLOR_MATCH_DIFFICULTY_PARAMS.hard).toEqual({
      trials: 25,
      incongruentRatio: 0.6,
      timeBudgetMs: 35_000,
      stimulusTimeoutMs: 3_000,
    });
    expect(SPEED_COLOR_MATCH_DIFFICULTY_PARAMS.expert).toEqual({
      trials: 30,
      incongruentRatio: 0.8,
      timeBudgetMs: 30_000,
      stimulusTimeoutMs: 2_500,
    });
  });

  it('defines adaptive tuning with min/max ratio bounds', () => {
    expect(ADAPTIVE_PARAMS).toEqual({
      trials: 20,
      incongruentRatio: 0.4,
      timeBudgetMs: 40_000,
      stimulusTimeoutMs: 4_000,
      minIncongruentRatio: 0.2,
      maxIncongruentRatio: 0.8,
    });
  });

  it('resolves levels through the SDK with the game parameters attached', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = resolveSpeedColorMatchDifficulty(level);
      expect(profile.level).toBe(level);
      expect(profile.challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS[level]);
      expect(profile.parameters).toEqual(speedColorMatchParamsForLevel(level));
    }
    const adaptive = resolveSpeedColorMatchDifficulty('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
    expect(adaptive.parameters).toEqual(ADAPTIVE_PARAMS);
  });

  it('returns fresh param objects (never mutates the frozen defaults)', () => {
    const a = speedColorMatchParamsForLevel('easy');
    const b = speedColorMatchParamsForLevel('easy');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a).not.toBe(SPEED_COLOR_MATCH_DIFFICULTY_PARAMS.easy);
  });

  it('round-trips parameters through a resolved profile', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const) {
      const params = speedColorMatchParamsFromProfile(resolveSpeedColorMatchDifficulty(level));
      expect(params).toEqual(speedColorMatchParamsForLevel(level));
    }
  });

  it('rejects profiles missing a required parameter', () => {
    const profile = resolveSpeedColorMatchDifficulty('normal');
    const { stimulusTimeoutMs: _omitted, ...incomplete } = profile.parameters;
    expect(() => speedColorMatchParamsFromProfile({ ...profile, parameters: incomplete })).toThrow(
      /stimulusTimeoutMs/,
    );
  });
});

describe('nextIncongruentRatio', () => {
  const params: SpeedColorMatchDifficultyParams = {
    trials: 20,
    incongruentRatio: 0.4,
    timeBudgetMs: 40_000,
    stimulusTimeoutMs: 4_000,
    minIncongruentRatio: 0.2,
    maxIncongruentRatio: 0.8,
  };

  it('increases ratio on correct answer', () => {
    expect(nextIncongruentRatio(0.4, true, params)).toBe(0.5);
  });

  it('decreases ratio on wrong answer', () => {
    expect(nextIncongruentRatio(0.4, false, params)).toBeCloseTo(0.3);
  });

  it('clamps to [min, max]', () => {
    expect(nextIncongruentRatio(0.8, true, params)).toBe(0.8);
    expect(nextIncongruentRatio(0.2, false, params)).toBe(0.2);
  });
});

describe('sessionChallengeRating', () => {
  it('reports the SDK default rating for fixed levels', () => {
    const profile = resolveSpeedColorMatchDifficulty('hard');
    expect(sessionChallengeRating('hard', profile, 0.6)).toBe(profile.challengeRating);
  });

  it('maps the adaptive final ratio linearly into [0, 1]', () => {
    const profile = resolveSpeedColorMatchDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 0.2)).toBe(0);
    expect(sessionChallengeRating('adaptive', profile, 0.5)).toBeCloseTo(0.5);
    expect(sessionChallengeRating('adaptive', profile, 0.8)).toBe(1);
  });
});
