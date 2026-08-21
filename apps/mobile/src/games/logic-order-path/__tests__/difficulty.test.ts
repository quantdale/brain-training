// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import type { DifficultyLevel } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  ORDER_PATH_DIFFICULTY_PARAMS,
  adaptiveRoundParams,
  orderPathParamsForLevel,
  orderPathParamsFromProfile,
  resolveOrderPathDifficulty,
  sessionChallengeRating,
} from '../difficulty';

describe('orderPathParamsForLevel / resolve', () => {
  it('returns fresh copies of the frozen defaults', () => {
    const params = orderPathParamsForLevel('normal');
    expect(params).toEqual(ORDER_PATH_DIFFICULTY_PARAMS.normal);
    expect(params).not.toBe(ORDER_PATH_DIFFICULTY_PARAMS.normal);
    const adaptive = orderPathParamsForLevel('adaptive');
    expect(adaptive).toEqual(ADAPTIVE_PARAMS);
    expect(adaptive).not.toBe(ADAPTIVE_PARAMS);
  });

  it('resolves fixed levels to the SDK challenge ratings plus game tuning', () => {
    const ratings: Record<Exclude<DifficultyLevel, 'adaptive'>, number> = {
      easy: 0.2,
      normal: 0.5,
      hard: 0.8,
      expert: 0.95,
    };
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = resolveOrderPathDifficulty(level);
      expect(profile.level).toBe(level);
      expect(profile.challengeRating).toBe(ratings[level]);
      expect(profile.parameters.itemCount).toBe(
        ORDER_PATH_DIFFICULTY_PARAMS[level].itemCount,
      );
      expect(profile.parameters.roundTimeMs).toBe(
        ORDER_PATH_DIFFICULTY_PARAMS[level].roundTimeMs,
      );
    }
  });

  it('resolves adaptive to the neutral baseline with bounded tuning', () => {
    const profile = resolveOrderPathDifficulty('adaptive');
    expect(profile.level).toBe('adaptive');
    expect(profile.challengeRating).toBe(0.5);
    expect(profile.parameters.itemCount).toBe(ADAPTIVE_PARAMS.itemCount);
    expect(profile.parameters.minItemCount).toBe(ADAPTIVE_PARAMS.minItemCount);
    expect(profile.parameters.maxEdgeDensity).toBe(ADAPTIVE_PARAMS.maxEdgeDensity);
  });
});

describe('orderPathParamsFromProfile', () => {
  it('recovers validated params from a resolved profile', () => {
    const params = orderPathParamsFromProfile(resolveOrderPathDifficulty('hard'));
    expect(params).toEqual(ORDER_PATH_DIFFICULTY_PARAMS.hard);
  });

  it('throws on missing or invalid numeric parameters', () => {
    const profile = resolveOrderPathDifficulty('normal');
    expect(() =>
      orderPathParamsFromProfile({ ...profile, parameters: {} } as typeof profile),
    ).toThrow();
    expect(() =>
      orderPathParamsFromProfile(
        { ...profile, parameters: { ...profile.parameters, itemCount: 1 } } as typeof profile,
      ),
    ).toThrow();
    expect(() =>
      orderPathParamsFromProfile(
        { ...profile, parameters: { ...profile.parameters, edgeDensityTarget: 1.5 } } as typeof profile,
      ),
    ).toThrow();
    expect(() =>
      orderPathParamsFromProfile(
        { ...profile, parameters: { ...profile.parameters, rounds: 0 } } as typeof profile,
      ),
    ).toThrow();
    expect(() =>
      orderPathParamsFromProfile(
        { ...profile, parameters: { ...profile.parameters, roundTimeMs: 0 } } as typeof profile,
      ),
    ).toThrow();
  });

  it('throws on nonsensical adaptive bounds', () => {
    const profile = resolveOrderPathDifficulty('adaptive');
    expect(() =>
      orderPathParamsFromProfile(
        { ...profile, parameters: { ...profile.parameters, minItemCount: 8, maxItemCount: 4 } } as typeof profile,
      ),
    ).toThrow();
    expect(() =>
      orderPathParamsFromProfile(
        { ...profile, parameters: { ...profile.parameters, minEdgeDensity: 0.9, maxEdgeDensity: 0.2 } } as typeof profile,
      ),
    ).toThrow();
  });
});

describe('adaptiveRoundParams', () => {
  it('holds fixed levels constant regardless of outcome', () => {
    const params = ORDER_PATH_DIFFICULTY_PARAMS.normal;
    expect(adaptiveRoundParams('normal', params, true)).toEqual({
      itemCount: params.itemCount,
      edgeDensityTarget: params.edgeDensityTarget,
    });
    expect(adaptiveRoundParams('expert', params, false)).toEqual({
      itemCount: params.itemCount,
      edgeDensityTarget: params.edgeDensityTarget,
    });
  });

  it('escalates on a pass: more items, sparser clues', () => {
    const next = adaptiveRoundParams('adaptive', { ...ADAPTIVE_PARAMS }, true);
    expect(next.itemCount).toBe(ADAPTIVE_PARAMS.itemCount! + 1);
    expect(next.edgeDensityTarget).toBeCloseTo(ADAPTIVE_PARAMS.edgeDensityTarget - 0.1);
  });

  it('eases on a fail: fewer items, denser clues', () => {
    const next = adaptiveRoundParams('adaptive', { ...ADAPTIVE_PARAMS }, false);
    expect(next.itemCount).toBe(ADAPTIVE_PARAMS.itemCount! - 1);
    expect(next.edgeDensityTarget).toBeCloseTo(ADAPTIVE_PARAMS.edgeDensityTarget + 0.1);
  });

  it('stays within the adaptive bounds', () => {
    const atMax = adaptiveRoundParams('adaptive', { ...ADAPTIVE_PARAMS, itemCount: 6, edgeDensityTarget: 0.3 }, true);
    expect(atMax.itemCount).toBe(6);
    expect(atMax.edgeDensityTarget).toBeCloseTo(0.3);

    const atMin = adaptiveRoundParams('adaptive', { ...ADAPTIVE_PARAMS, itemCount: 4, edgeDensityTarget: 1.0 }, false);
    expect(atMin.itemCount).toBe(4);
    expect(atMin.edgeDensityTarget).toBeCloseTo(1.0);
  });
});

describe('sessionChallengeRating', () => {
  it('returns the SDK rating for fixed levels', () => {
    const profile = resolveOrderPathDifficulty('hard');
    expect(sessionChallengeRating('hard', profile, 5, 0.5)).toBe(0.8);
  });

  it('maps the final adaptive tuning into [0, 1]', () => {
    const profile = resolveOrderPathDifficulty('adaptive');
    // Easiest corner: min items, max density.
    expect(sessionChallengeRating('adaptive', profile, 4, 1.0)).toBeCloseTo(0);
    // Hardest corner: max items, min density.
    expect(sessionChallengeRating('adaptive', profile, 6, 0.3)).toBeCloseTo(1);
    // Neutral midpoint.
    expect(sessionChallengeRating('adaptive', profile, 5, 0.65)).toBeCloseTo(0.5);
  });
});
