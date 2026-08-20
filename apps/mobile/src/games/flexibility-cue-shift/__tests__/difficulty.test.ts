// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CHALLENGE_RATINGS } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  FLEXIBILITY_CUE_DIFFICULTY_PARAMS,
  flexibilityCueParamsForLevel,
  flexibilityCueParamsFromProfile,
  nextRule,
  resolveFlexibilityCueDifficulty,
  sessionChallengeRating,
} from '../difficulty';

describe('Flexibility Cue Shift difficulty parameter mapping', () => {
  it('maps each fixed level to concrete alphabet/rounds/switch/speed tuning', () => {
    expect(FLEXIBILITY_CUE_DIFFICULTY_PARAMS.easy).toEqual({
      numShapes: 3,
      numColors: 3,
      numNumbers: 3,
      rounds: 8,
      switchRate: 0.4,
      speedTargetMs: 6000,
    });
    expect(FLEXIBILITY_CUE_DIFFICULTY_PARAMS.normal).toEqual({
      numShapes: 3,
      numColors: 3,
      numNumbers: 4,
      rounds: 10,
      switchRate: 0.5,
      speedTargetMs: 5000,
    });
    expect(FLEXIBILITY_CUE_DIFFICULTY_PARAMS.hard).toEqual({
      numShapes: 4,
      numColors: 4,
      numNumbers: 5,
      rounds: 12,
      switchRate: 0.6,
      speedTargetMs: 4000,
    });
    expect(FLEXIBILITY_CUE_DIFFICULTY_PARAMS.expert).toEqual({
      numShapes: 4,
      numColors: 4,
      numNumbers: 6,
      rounds: 12,
      switchRate: 0.75,
      speedTargetMs: 3000,
    });
  });

  it('defines adaptive tuning with switch-rate bounds', () => {
    expect(ADAPTIVE_PARAMS).toEqual({
      numShapes: 3,
      numColors: 3,
      numNumbers: 4,
      rounds: 10,
      switchRate: 0.5,
      speedTargetMs: 4000,
      minSwitchRate: 0.3,
      maxSwitchRate: 0.8,
    });
  });

  it('resolves levels through the SDK with the game parameters attached', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = resolveFlexibilityCueDifficulty(level);
      expect(profile.level).toBe(level);
      expect(profile.challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS[level]);
      expect(profile.parameters).toEqual(flexibilityCueParamsForLevel(level));
    }
    const adaptive = resolveFlexibilityCueDifficulty('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
    expect(adaptive.parameters).toEqual(ADAPTIVE_PARAMS);
  });

  it('returns fresh param objects (never mutates the frozen defaults)', () => {
    const a = flexibilityCueParamsForLevel('easy');
    const b = flexibilityCueParamsForLevel('easy');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a).not.toBe(FLEXIBILITY_CUE_DIFFICULTY_PARAMS.easy);
  });

  it('round-trips parameters through a resolved profile', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const) {
      const params = flexibilityCueParamsFromProfile(resolveFlexibilityCueDifficulty(level));
      expect(params).toEqual(flexibilityCueParamsForLevel(level));
    }
  });

  it('rejects profiles missing a required parameter', () => {
    const profile = resolveFlexibilityCueDifficulty('normal');
    const { numNumbers: _omitted, ...incomplete } = profile.parameters;
    expect(() => flexibilityCueParamsFromProfile({ ...profile, parameters: incomplete })).toThrow(
      /numNumbers/,
    );
  });
});

describe('nextRule', () => {
  it('keeps the same rule when not switching', () => {
    expect(nextRule({ next: () => 0.9, pick: (i) => i[0] }, 'color', 0.5)).toBe('color');
  });

  it('switches to one of the other two rules when switching', () => {
    const othersForColor = ['shape', 'number'] as const;
    expect(othersForColor).toContain(nextRule({ next: () => 0.1, pick: (i) => i[1] }, 'color', 0.5));
    const othersForShape = ['color', 'number'] as const;
    expect(othersForShape).toContain(nextRule({ next: () => 0.1, pick: (i) => i[0] }, 'shape', 0.5));
  });

  it('is deterministic for a fixed rng sequence', () => {
    const seq = [0.1, 0.1, 0.9];
    let i = 0;
    const fixed = { next: () => seq[i++ % seq.length], pick: <T>(items: readonly T[]): T => items[0] };
    expect(nextRule(fixed, 'color', 0.5)).toBe('shape');
    expect(nextRule(fixed, 'color', 0.5)).toBe('shape');
    expect(nextRule(fixed, 'color', 0.5)).toBe('color');
  });
});

describe('sessionChallengeRating', () => {
  it('reports the SDK default rating for fixed levels', () => {
    const profile = resolveFlexibilityCueDifficulty('hard');
    expect(sessionChallengeRating('hard', profile, 0.5)).toBe(profile.challengeRating);
  });

  it('maps the adaptive final switch rate linearly into [0, 1] (higher = harder)', () => {
    const profile = resolveFlexibilityCueDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 0.3)).toBe(0);
    expect(sessionChallengeRating('adaptive', profile, 0.55)).toBeCloseTo(0.5);
    expect(sessionChallengeRating('adaptive', profile, 0.8)).toBe(1);
  });
});
