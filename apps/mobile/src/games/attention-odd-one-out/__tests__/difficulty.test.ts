// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import type { DifficultyLevel } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  ODD_ONE_OUT_DIFFICULTY_PARAMS,
  effectiveParamsForStep,
  escalateStep,
  maxStepFor,
  oddOneOutParamsForLevel,
  oddOneOutParamsFromProfile,
  resolveOddOneOutDifficulty,
  sessionChallengeRating,
} from '../difficulty';

const LEVELS: Exclude<DifficultyLevel, 'adaptive'>[] = ['easy', 'normal', 'hard', 'expert'];

describe('ODD_ONE_OUT_DIFFICULTY_PARAMS', () => {
  it('sizes the session per level: grid, rounds, and escalation envelope', () => {
    expect(ODD_ONE_OUT_DIFFICULTY_PARAMS.easy).toEqual({
      gridSize: 9, rounds: 5, minSubtlety: 0, maxSubtlety: 1,
      minWindowMs: 12_000, maxWindowMs: 15_000, windowStepMs: 3_000,
    });
    expect(ODD_ONE_OUT_DIFFICULTY_PARAMS.normal).toEqual({
      gridSize: 9, rounds: 6, minSubtlety: 0, maxSubtlety: 2,
      minWindowMs: 9_000, maxWindowMs: 12_000, windowStepMs: 1_500,
    });
    expect(ODD_ONE_OUT_DIFFICULTY_PARAMS.hard).toEqual({
      gridSize: 16, rounds: 7, minSubtlety: 1, maxSubtlety: 3,
      minWindowMs: 8_000, maxWindowMs: 10_000, windowStepMs: 1_000,
    });
    expect(ODD_ONE_OUT_DIFFICULTY_PARAMS.expert).toEqual({
      gridSize: 16, rounds: 8, minSubtlety: 2, maxSubtlety: 3,
      minWindowMs: 7_000, maxWindowMs: 8_000, windowStepMs: 500,
    });
  });

  it('defines adaptive as the full envelope on the base grid', () => {
    expect(ADAPTIVE_PARAMS).toEqual({
      gridSize: 9, rounds: 8, minSubtlety: 0, maxSubtlety: 3,
      minWindowMs: 7_000, maxWindowMs: 12_000, windowStepMs: 1_250,
    });
  });
});

describe('oddOneOutParamsForLevel / resolveOddOneOutDifficulty', () => {
  it('returns fresh copies (never the frozen defaults)', () => {
    const a = oddOneOutParamsForLevel('normal');
    const b = oddOneOutParamsForLevel('normal');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it('resolves SDK challenge ratings and carries the tuning in parameters', () => {
    const easy = resolveOddOneOutDifficulty('easy');
    expect(easy.level).toBe('easy');
    expect(easy.challengeRating).toBe(0.2);
    expect(easy.parameters.gridSize).toBe(9);
    const expert = resolveOddOneOutDifficulty('expert');
    expect(expert.challengeRating).toBe(0.95);
    expect(expert.parameters.gridSize).toBe(16);
    const adaptive = resolveOddOneOutDifficulty('adaptive');
    expect(adaptive.challengeRating).toBe(0.5); // neutral baseline
  });

  it('round-trips through the profile (persistence contract)', () => {
    for (const level of [...LEVELS, 'adaptive'] as DifficultyLevel[]) {
      const profile = resolveOddOneOutDifficulty(level);
      expect(oddOneOutParamsFromProfile(profile)).toEqual(oddOneOutParamsForLevel(level));
    }
  });

  it('throws on a profile missing required parameters', () => {
    expect(() =>
      oddOneOutParamsFromProfile({ level: 'normal', challengeRating: 0.5, parameters: {} }),
    ).toThrow(/missing numeric parameter/);
  });
});

describe('maxStepFor / effectiveParamsForStep', () => {
  it('derives the step range from the subtlety envelope', () => {
    expect(maxStepFor(ODD_ONE_OUT_DIFFICULTY_PARAMS.easy)).toBe(1);
    expect(maxStepFor(ODD_ONE_OUT_DIFFICULTY_PARAMS.normal)).toBe(2);
    expect(maxStepFor(ODD_ONE_OUT_DIFFICULTY_PARAMS.hard)).toBe(2);
    expect(maxStepFor(ODD_ONE_OUT_DIFFICULTY_PARAMS.expert)).toBe(1);
    expect(maxStepFor(ADAPTIVE_PARAMS)).toBe(3);
  });

  it('escalates subtlety and shrinks the window linearly per step', () => {
    // normal: 12000/0 → 10500/1 → 9000/2 (then clamped)
    const normal = ODD_ONE_OUT_DIFFICULTY_PARAMS.normal;
    expect(effectiveParamsForStep(normal, 0)).toEqual({ gridSize: 9, subtlety: 0, windowMs: 12_000 });
    expect(effectiveParamsForStep(normal, 1)).toEqual({ gridSize: 9, subtlety: 1, windowMs: 10_500 });
    expect(effectiveParamsForStep(normal, 2)).toEqual({ gridSize: 9, subtlety: 2, windowMs: 9_000 });
  });

  it('clamps beyond the envelope', () => {
    const normal = ODD_ONE_OUT_DIFFICULTY_PARAMS.normal;
    expect(effectiveParamsForStep(normal, 99)).toEqual({ gridSize: 9, subtlety: 2, windowMs: 9_000 });
    expect(effectiveParamsForStep(normal, -3)).toEqual({ gridSize: 9, subtlety: 0, windowMs: 12_000 });
  });

  it('expert starts subtler and ends at the hardest subtlety', () => {
    const expert = ODD_ONE_OUT_DIFFICULTY_PARAMS.expert;
    expect(effectiveParamsForStep(expert, 0)).toEqual({ gridSize: 16, subtlety: 2, windowMs: 8_000 });
    expect(effectiveParamsForStep(expert, 1)).toEqual({ gridSize: 16, subtlety: 3, windowMs: 7_500 });
  });
});

describe('escalateStep', () => {
  it('fixed levels step up on a pass and hold on a failure', () => {
    const normal = ODD_ONE_OUT_DIFFICULTY_PARAMS.normal;
    expect(escalateStep(0, true, 'normal', normal)).toBe(1);
    expect(escalateStep(1, true, 'normal', normal)).toBe(2);
    expect(escalateStep(2, true, 'normal', normal)).toBe(2); // capped
    expect(escalateStep(2, false, 'normal', normal)).toBe(2); // holds
  });

  it('adaptive moves ±1 within the range', () => {
    expect(escalateStep(1, true, 'adaptive', ADAPTIVE_PARAMS)).toBe(2);
    expect(escalateStep(1, false, 'adaptive', ADAPTIVE_PARAMS)).toBe(0);
    expect(escalateStep(3, true, 'adaptive', ADAPTIVE_PARAMS)).toBe(3); // capped
    expect(escalateStep(0, false, 'adaptive', ADAPTIVE_PARAMS)).toBe(0); // floored
  });
});

describe('sessionChallengeRating', () => {
  it('reports the SDK rating for fixed levels', () => {
    const normal = resolveOddOneOutDifficulty('normal');
    expect(sessionChallengeRating('normal', normal, 0)).toBe(0.5);
    expect(sessionChallengeRating('normal', normal, 2)).toBe(0.5);
  });

  it('maps the adaptive final step linearly into [0, 1]', () => {
    const adaptive = resolveOddOneOutDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', adaptive, 0)).toBe(0);
    expect(sessionChallengeRating('adaptive', adaptive, 1)).toBeCloseTo(1 / 3);
    expect(sessionChallengeRating('adaptive', adaptive, 3)).toBe(1);
  });
});
