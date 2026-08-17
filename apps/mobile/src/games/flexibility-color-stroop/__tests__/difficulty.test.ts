// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CHALLENGE_RATINGS } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  COLOR_STROOP_DIFFICULTY_PARAMS,
  adaptiveIncongruentRatio,
  colorStroopParamsForLevel,
  colorStroopParamsFromProfile,
  resolveColorStroopDifficulty,
  sessionChallengeRating,
} from '../difficulty';
import type { ColorStroopDifficultyParams } from '../types';

describe('Color Stroop difficulty parameter mapping', () => {
  it('maps each fixed level to concrete tuning', () => {
    expect(COLOR_STROOP_DIFFICULTY_PARAMS.easy).toEqual({
      trials: 10,
      incongruentRatio: 0.2,
      timeBudgetMs: 45_000,
      flipFrequency: 5,
      stimulusMs: 2000,
    });
    expect(COLOR_STROOP_DIFFICULTY_PARAMS.normal).toEqual({
      trials: 15,
      incongruentRatio: 0.4,
      timeBudgetMs: 40_000,
      flipFrequency: 4,
      stimulusMs: 1500,
    });
    expect(COLOR_STROOP_DIFFICULTY_PARAMS.hard).toEqual({
      trials: 20,
      incongruentRatio: 0.6,
      timeBudgetMs: 35_000,
      flipFrequency: 3,
      stimulusMs: 1200,
    });
    expect(COLOR_STROOP_DIFFICULTY_PARAMS.expert).toEqual({
      trials: 25,
      incongruentRatio: 0.8,
      timeBudgetMs: 30_000,
      flipFrequency: 2,
      stimulusMs: 1000,
    });
  });

  it('defines adaptive tuning with min/max incongruent ratio bounds', () => {
    expect(ADAPTIVE_PARAMS).toEqual({
      trials: 15,
      incongruentRatio: 0.4,
      timeBudgetMs: 40_000,
      flipFrequency: 4,
      stimulusMs: 1500,
      minIncongruentRatio: 0.2,
      maxIncongruentRatio: 0.8,
    });
  });

  it('resolves levels through the SDK with the game parameters attached', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = resolveColorStroopDifficulty(level);
      expect(profile.level).toBe(level);
      expect(profile.challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS[level]);
      expect(profile.parameters).toEqual(colorStroopParamsForLevel(level));
    }
    const adaptive = resolveColorStroopDifficulty('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
    expect(adaptive.parameters).toEqual(ADAPTIVE_PARAMS);
  });

  it('returns fresh param objects (never mutates the frozen defaults)', () => {
    const a = colorStroopParamsForLevel('easy');
    const b = colorStroopParamsForLevel('easy');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a).not.toBe(COLOR_STROOP_DIFFICULTY_PARAMS.easy);
  });

  it('round-trips parameters through a resolved profile', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const) {
      const params = colorStroopParamsFromProfile(resolveColorStroopDifficulty(level));
      expect(params).toEqual(colorStroopParamsForLevel(level));
    }
  });

  it('rejects profiles missing a required parameter', () => {
    const profile = resolveColorStroopDifficulty('normal');
    const { stimulusMs: _omitted, ...incomplete } = profile.parameters;
    expect(() => colorStroopParamsFromProfile({ ...profile, parameters: incomplete })).toThrow(
      /stimulusMs/,
    );
  });
});

describe('adaptiveIncongruentRatio', () => {
  it('increases ratio when accuracy is high', () => {
    const params: ColorStroopDifficultyParams = {
      trials: 15,
      incongruentRatio: 0.4,
      timeBudgetMs: 40_000,
      flipFrequency: 4,
      stimulusMs: 1500,
      minIncongruentRatio: 0.2,
      maxIncongruentRatio: 0.8,
    };
    const newRatio = adaptiveIncongruentRatio(0.4, 0.9, params);
    expect(newRatio).toBeGreaterThan(0.4);
  });

  it('decreases ratio when accuracy is low', () => {
    const params: ColorStroopDifficultyParams = {
      trials: 15,
      incongruentRatio: 0.4,
      timeBudgetMs: 40_000,
      flipFrequency: 4,
      stimulusMs: 1500,
      minIncongruentRatio: 0.2,
      maxIncongruentRatio: 0.8,
    };
    const newRatio = adaptiveIncongruentRatio(0.4, 0.3, params);
    expect(newRatio).toBeLessThan(0.4);
  });

  it('clamps to min/max bounds', () => {
    const params: ColorStroopDifficultyParams = {
      trials: 15,
      incongruentRatio: 0.4,
      timeBudgetMs: 40_000,
      flipFrequency: 4,
      stimulusMs: 1500,
      minIncongruentRatio: 0.2,
      maxIncongruentRatio: 0.8,
    };
    expect(adaptiveIncongruentRatio(0.75, 1.0, params)).toBeLessThanOrEqual(0.8);
    expect(adaptiveIncongruentRatio(0.25, 0.0, params)).toBeGreaterThanOrEqual(0.2);
  });
});

describe('sessionChallengeRating', () => {
  it('reports the SDK default rating for fixed levels', () => {
    const profile = resolveColorStroopDifficulty('hard');
    expect(sessionChallengeRating('hard', profile, 0.6)).toBe(profile.challengeRating);
  });

  it('maps the adaptive final ratio linearly into [0, 1]', () => {
    const profile = resolveColorStroopDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 0.2)).toBeCloseTo(0);
    expect(sessionChallengeRating('adaptive', profile, 0.5)).toBeCloseTo(0.5);
    expect(sessionChallengeRating('adaptive', profile, 0.8)).toBeCloseTo(1);
  });
});