// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CHALLENGE_RATINGS } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  FLEXIBILITY_DIFFICULTY_PARAMS,
  flexibilityParamsForLevel,
  flexibilityParamsFromProfile,
  nextSwitchEvery,
  resolveFlexibilityDifficulty,
  sessionChallengeRating,
} from '../difficulty';
import type { FlexibilityDifficultyParams } from '../types';

describe('Flexibility difficulty parameter mapping', () => {
  it('maps each fixed level to concrete alphabet/rounds/switch/notice/speed tuning', () => {
    expect(FLEXIBILITY_DIFFICULTY_PARAMS.easy).toEqual({
      numShapes: 3,
      numColors: 3,
      rounds: 8,
      switchEvery: 4,
      noticeMs: 2000,
      speedTargetMs: 6000,
    });
    expect(FLEXIBILITY_DIFFICULTY_PARAMS.normal).toEqual({
      numShapes: 3,
      numColors: 3,
      rounds: 10,
      switchEvery: 3,
      noticeMs: 1600,
      speedTargetMs: 5000,
    });
    expect(FLEXIBILITY_DIFFICULTY_PARAMS.hard).toEqual({
      numShapes: 4,
      numColors: 4,
      rounds: 12,
      switchEvery: 2,
      noticeMs: 1200,
      speedTargetMs: 4000,
    });
    expect(FLEXIBILITY_DIFFICULTY_PARAMS.expert).toEqual({
      numShapes: 4,
      numColors: 4,
      rounds: 12,
      switchEvery: 1,
      noticeMs: 900,
      speedTargetMs: 3000,
    });
  });

  it('defines adaptive tuning with switch-frequency bounds', () => {
    expect(ADAPTIVE_PARAMS).toEqual({
      numShapes: 3,
      numColors: 3,
      rounds: 10,
      switchEvery: 2,
      noticeMs: 1200,
      speedTargetMs: 4000,
      minSwitchEvery: 1,
      maxSwitchEvery: 4,
    });
  });

  it('resolves levels through the SDK with the game parameters attached', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = resolveFlexibilityDifficulty(level);
      expect(profile.level).toBe(level);
      expect(profile.challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS[level]);
      expect(profile.parameters).toEqual(flexibilityParamsForLevel(level));
    }
    const adaptive = resolveFlexibilityDifficulty('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
    expect(adaptive.parameters).toEqual(ADAPTIVE_PARAMS);
  });

  it('returns fresh param objects (never mutates the frozen defaults)', () => {
    const a = flexibilityParamsForLevel('easy');
    const b = flexibilityParamsForLevel('easy');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a).not.toBe(FLEXIBILITY_DIFFICULTY_PARAMS.easy);
  });

  it('round-trips parameters through a resolved profile', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const) {
      const params = flexibilityParamsFromProfile(resolveFlexibilityDifficulty(level));
      expect(params).toEqual(flexibilityParamsForLevel(level));
    }
  });

  it('rejects profiles missing a required parameter', () => {
    const profile = resolveFlexibilityDifficulty('normal');
    const { noticeMs: _omitted, ...incomplete } = profile.parameters;
    expect(() => flexibilityParamsFromProfile({ ...profile, parameters: incomplete })).toThrow(
      /noticeMs/,
    );
  });
});

describe('nextSwitchEvery', () => {
  const fixed: FlexibilityDifficultyParams = FLEXIBILITY_DIFFICULTY_PARAMS.normal;
  const adaptive: FlexibilityDifficultyParams = ADAPTIVE_PARAMS;

  it('keeps fixed levels constant regardless of block accuracy', () => {
    expect(nextSwitchEvery('normal', 3, 1, fixed)).toBe(3);
    expect(nextSwitchEvery('normal', 3, 0, fixed)).toBe(3);
  });

  it('adaptive gets harder (shorter block) after a perfect block', () => {
    expect(nextSwitchEvery('adaptive', 2, 1, adaptive)).toBe(1);
    expect(nextSwitchEvery('adaptive', 1, 1, adaptive)).toBe(1); // clamped at min
  });

  it('adaptive gets easier (longer block) after a poor block', () => {
    expect(nextSwitchEvery('adaptive', 2, 0.5, adaptive)).toBe(3);
    expect(nextSwitchEvery('adaptive', 2, 0, adaptive)).toBe(3);
    expect(nextSwitchEvery('adaptive', 4, 0.5, adaptive)).toBe(4); // clamped at max
  });

  it('adaptive holds when the block was mixed', () => {
    expect(nextSwitchEvery('adaptive', 2, 0.75, adaptive)).toBe(2);
  });
});

describe('sessionChallengeRating', () => {
  it('reports the SDK default rating for fixed levels', () => {
    const profile = resolveFlexibilityDifficulty('hard');
    expect(sessionChallengeRating('hard', profile, 2)).toBe(profile.challengeRating);
  });

  it('maps the adaptive final switch frequency linearly into [0, 1]', () => {
    const profile = resolveFlexibilityDifficulty('adaptive');
    // Fewer rounds per block = harder = higher rating.
    expect(sessionChallengeRating('adaptive', profile, 1)).toBe(1);
    expect(sessionChallengeRating('adaptive', profile, 2.5)).toBe(0.5);
    expect(sessionChallengeRating('adaptive', profile, 4)).toBe(0);
  });
});
