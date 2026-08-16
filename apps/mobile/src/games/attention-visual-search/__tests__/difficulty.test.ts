// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CHALLENGE_RATINGS } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  DISTRACTOR_PENALTY_MS,
  GRID_ESCALATION_EVERY,
  GRID_LEVELS,
  VISUAL_SEARCH_DIFFICULTY_PARAMS,
  gridSizeFor,
  nextAdaptiveWindow,
  resolveVisualSearchDifficulty,
  sessionChallengeRating,
  visualSearchParamsForLevel,
  visualSearchParamsFromProfile,
  windowMsFor,
} from '../difficulty';
import type { VisualSearchDifficultyParams } from '../types';

describe('Visual Search difficulty parameter mapping', () => {
  it('maps each fixed level to concrete session/grid/window tuning', () => {
    expect(VISUAL_SEARCH_DIFFICULTY_PARAMS.easy).toEqual({
      sessionDurationMs: 90_000,
      rounds: 10,
      initialGridSize: 4,
      maxGridSize: 16,
      initialWindowMs: 6_000,
      minWindowMs: 2_500,
      windowStepMs: 400,
    });
    expect(VISUAL_SEARCH_DIFFICULTY_PARAMS.normal).toEqual({
      sessionDurationMs: 120_000,
      rounds: 12,
      initialGridSize: 4,
      maxGridSize: 25,
      initialWindowMs: 4_500,
      minWindowMs: 1_800,
      windowStepMs: 400,
    });
    expect(VISUAL_SEARCH_DIFFICULTY_PARAMS.hard).toEqual({
      sessionDurationMs: 150_000,
      rounds: 14,
      initialGridSize: 9,
      maxGridSize: 25,
      initialWindowMs: 3_200,
      minWindowMs: 1_200,
      windowStepMs: 350,
    });
    expect(VISUAL_SEARCH_DIFFICULTY_PARAMS.expert).toEqual({
      sessionDurationMs: 180_000,
      rounds: 16,
      initialGridSize: 9,
      maxGridSize: 25,
      initialWindowMs: 2_400,
      minWindowMs: 800,
      windowStepMs: 300,
    });
  });

  it('defines adaptive tuning with min/max window bounds', () => {
    expect(ADAPTIVE_PARAMS).toEqual({
      sessionDurationMs: 120_000,
      rounds: 12,
      initialGridSize: 4,
      maxGridSize: 25,
      initialWindowMs: 3_000,
      minWindowMs: 1_000,
      maxWindowMs: 5_000,
      windowStepMs: 300,
    });
  });

  it('defines the escalation constants', () => {
    expect(GRID_LEVELS).toEqual([4, 9, 16, 25]);
    expect(GRID_ESCALATION_EVERY).toBe(2);
    expect(DISTRACTOR_PENALTY_MS).toBe(2_000);
  });

  it('resolves levels through the SDK with the game parameters attached', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = resolveVisualSearchDifficulty(level);
      expect(profile.level).toBe(level);
      expect(profile.challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS[level]);
      expect(profile.parameters).toEqual(visualSearchParamsForLevel(level));
    }
    const adaptive = resolveVisualSearchDifficulty('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
    expect(adaptive.parameters).toEqual(ADAPTIVE_PARAMS);
  });

  it('returns fresh param objects (never mutates the frozen defaults)', () => {
    const a = visualSearchParamsForLevel('easy');
    const b = visualSearchParamsForLevel('easy');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a).not.toBe(VISUAL_SEARCH_DIFFICULTY_PARAMS.easy);
  });

  it('round-trips parameters through a resolved profile', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const) {
      const params = visualSearchParamsFromProfile(resolveVisualSearchDifficulty(level));
      expect(params).toEqual(visualSearchParamsForLevel(level));
    }
  });

  it('rejects profiles missing a required parameter', () => {
    const profile = resolveVisualSearchDifficulty('normal');
    const { windowStepMs: _omitted, ...incomplete } = profile.parameters;
    expect(() =>
      visualSearchParamsFromProfile({ ...profile, parameters: incomplete }),
    ).toThrow(/windowStepMs/);
  });
});

describe('gridSizeFor', () => {
  it('grows one square level every GRID_ESCALATION_EVERY rounds, capped', () => {
    const easy = VISUAL_SEARCH_DIFFICULTY_PARAMS.easy; // 4 → 16
    expect(Array.from({ length: 10 }, (_, i) => gridSizeFor(easy, i))).toEqual([
      4, 4, 9, 9, 16, 16, 16, 16, 16, 16,
    ]);
    const normal = VISUAL_SEARCH_DIFFICULTY_PARAMS.normal; // 4 → 25
    expect(Array.from({ length: 12 }, (_, i) => gridSizeFor(normal, i))).toEqual([
      4, 4, 9, 9, 16, 16, 25, 25, 25, 25, 25, 25,
    ]);
    const hard = VISUAL_SEARCH_DIFFICULTY_PARAMS.hard; // 9 → 25
    expect(Array.from({ length: 14 }, (_, i) => gridSizeFor(hard, i))).toEqual([
      9, 9, 16, 16, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25,
    ]);
  });

  it('rejects unsupported grid sizes', () => {
    const params: VisualSearchDifficultyParams = {
      ...VISUAL_SEARCH_DIFFICULTY_PARAMS.normal,
      initialGridSize: 7,
    };
    expect(() => gridSizeFor(params, 0)).toThrow(/not a supported square level/);
  });
});

describe('windowMsFor', () => {
  it('shrinks the fixed-level window per round, clamped at minWindowMs', () => {
    const normal = VISUAL_SEARCH_DIFFICULTY_PARAMS.normal;
    expect(Array.from({ length: 12 }, (_, i) => windowMsFor(normal, i))).toEqual([
      4_500, 4_100, 3_700, 3_300, 2_900, 2_500, 2_100, 1_800, 1_800, 1_800, 1_800, 1_800,
    ]);
  });
});

describe('nextAdaptiveWindow', () => {
  const params = ADAPTIVE_PARAMS;

  it('shrinks on a pass and grows on a failure', () => {
    expect(nextAdaptiveWindow(3_000, true, params)).toBe(2_700);
    expect(nextAdaptiveWindow(2_700, false, params)).toBe(3_000);
  });

  it('clamps within [minWindowMs, maxWindowMs]', () => {
    expect(nextAdaptiveWindow(1_000, true, params)).toBe(1_000);
    expect(nextAdaptiveWindow(1_000, false, params)).toBe(1_300);
    expect(nextAdaptiveWindow(5_000, false, params)).toBe(5_000);
    expect(nextAdaptiveWindow(5_000, true, params)).toBe(4_700);
  });
});

describe('sessionChallengeRating', () => {
  it('reports the SDK default rating for fixed levels', () => {
    const profile = resolveVisualSearchDifficulty('hard');
    expect(sessionChallengeRating('hard', profile, 3_200)).toBe(profile.challengeRating);
  });

  it('maps the adaptive final window linearly into [0, 1] (smaller = faster)', () => {
    const profile = resolveVisualSearchDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 5_000)).toBe(0);
    expect(sessionChallengeRating('adaptive', profile, 3_000)).toBe(0.5);
    expect(sessionChallengeRating('adaptive', profile, 1_000)).toBe(1);
  });
});
