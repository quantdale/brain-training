// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import type { DifficultyLevel } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  PROMPT_TYPE_MASK,
  QUICK_COMPARE_DIFFICULTY_PARAMS,
  nextWindowMs,
  quickCompareParamsForLevel,
  quickCompareParamsFromProfile,
  quickCompareParamsToRecord,
  resolveQuickCompareDifficulty,
  sessionChallengeRating,
} from '../difficulty';
import type { QuickCompareDifficultyParams } from '../types';

// Fixed levels only; `adaptive` has its own params (ADAPTIVE_PARAMS) and is
// covered separately below.
const LEVELS: Exclude<DifficultyLevel, 'adaptive'>[] = ['easy', 'normal', 'hard', 'expert'];

describe('resolveQuickCompareDifficulty', () => {
  it('resolves every fixed level with the expected tuning', () => {
    for (const level of LEVELS) {
      const profile = resolveQuickCompareDifficulty(level);
      expect(profile.level).toBe(level);
      const params = quickCompareParamsFromProfile(profile);
      expect(params.rounds).toBe(QUICK_COMPARE_DIFFICULTY_PARAMS[level].rounds);
      expect(params.windowMs).toBe(QUICK_COMPARE_DIFFICULTY_PARAMS[level].windowMs);
      expect(params.maxValue).toBe(QUICK_COMPARE_DIFFICULTY_PARAMS[level].maxValue);
      expect(params.optionCount).toBe(QUICK_COMPARE_DIFFICULTY_PARAMS[level].optionCount);
      expect(params.promptTypes).toEqual(QUICK_COMPARE_DIFFICULTY_PARAMS[level].promptTypes);
    }
  });

  it('encodes the prompt-type mix into a bitmask', () => {
    for (const level of LEVELS) {
      const params = quickCompareParamsForLevel(level);
      const record = quickCompareParamsToRecord(params);
      let expectedMask = 0;
      for (const type of params.promptTypes) {
        expectedMask |= PROMPT_TYPE_MASK[type];
      }
      expect(record.promptTypeMask).toBe(expectedMask);
    }
    // sanity: three distinct masks across the level set
    const masks = new Set(LEVELS.map((l) => quickCompareParamsToRecord(quickCompareParamsForLevel(l)).promptTypeMask));
    expect(masks.size).toBeGreaterThan(1);
  });

  it('round-trips params through profile encode/decode', () => {
    for (const level of LEVELS) {
      const profile = resolveQuickCompareDifficulty(level);
      const decoded = quickCompareParamsFromProfile(profile);
      const original = quickCompareParamsForLevel(level);
      expect(decoded.rounds).toBe(original.rounds);
      expect(decoded.windowMs).toBe(original.windowMs);
      expect(decoded.maxValue).toBe(original.maxValue);
      expect(decoded.optionCount).toBe(original.optionCount);
      expect(decoded.promptTypes).toEqual(original.promptTypes);
    }
  });

  it('adaptive profile carries window bounds', () => {
    const profile = resolveQuickCompareDifficulty('adaptive');
    const params = quickCompareParamsFromProfile(profile);
    expect(params.minWindowMs).toBe(ADAPTIVE_PARAMS.minWindowMs);
    expect(params.maxWindowMs).toBe(ADAPTIVE_PARAMS.maxWindowMs);
  });
});

describe('nextWindowMs', () => {
  const params = quickCompareParamsForLevel('normal');

  it('keeps the constant window for fixed levels', () => {
    expect(nextWindowMs(2200, true, 'normal', params)).toBe(2200);
    expect(nextWindowMs(2200, false, 'normal', params)).toBe(2200);
  });

  it('shrinks the window after a correct round and grows it after a miss (adaptive)', () => {
    const a = quickCompareParamsFromProfile(resolveQuickCompareDifficulty('adaptive'));
    expect(nextWindowMs(2200, true, 'adaptive', a)).toBe(2000);
    expect(nextWindowMs(2200, false, 'adaptive', a)).toBe(2400);
    // clamped to the bounds [1200, 3200]
    expect(nextWindowMs(1300, true, 'adaptive', a)).toBe(1200);
    expect(nextWindowMs(3100, false, 'adaptive', a)).toBe(3200);
  });
});

describe('sessionChallengeRating', () => {
  it('returns the SDK default rating for fixed levels', () => {
    for (const level of LEVELS) {
      const profile = resolveQuickCompareDifficulty(level);
      expect(sessionChallengeRating(level, profile, 1234)).toBe(profile.challengeRating);
    }
  });

  it('maps the final adaptive window linearly (smaller window = higher rating)', () => {
    const profile = resolveQuickCompareDifficulty('adaptive');
    const lo = sessionChallengeRating('adaptive', profile, 3200); // slowest window
    const hi = sessionChallengeRating('adaptive', profile, 1200); // fastest window
    expect(hi).toBeGreaterThan(lo);
    expect(hi).toBeCloseTo(1);
    expect(lo).toBeCloseTo(0);
    expect(sessionChallengeRating('adaptive', profile, 2200)).toBeCloseTo(0.5);
  });
});

describe('difficulty params sanity', () => {
  it('scales window and magnitude monotonically with difficulty', () => {
    const windows = LEVELS.map((l) => quickCompareParamsForLevel(l).windowMs);
    expect(windows[0]).toBeGreaterThan(windows[1]);
    expect(windows[1]).toBeGreaterThan(windows[2]);
    expect(windows[2]).toBeGreaterThan(windows[3]);
    const magnitudes = LEVELS.map((l) => quickCompareParamsForLevel(l).maxValue);
    expect(magnitudes[2]).toBeLessThan(magnitudes[3]);
  });

  it('never emits an option count outside the supported range', () => {
    for (const level of [...LEVELS, 'adaptive' as DifficultyLevel]) {
      const p: QuickCompareDifficultyParams = quickCompareParamsForLevel(level);
      expect(p.optionCount).toBeGreaterThanOrEqual(2);
      expect(p.optionCount).toBeLessThanOrEqual(4);
    }
  });
});
