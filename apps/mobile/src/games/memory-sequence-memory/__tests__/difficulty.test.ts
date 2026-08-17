// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  SEQUENCE_MEMORY_DIFFICULTY_PARAMS,
  nextSequenceLength,
  resolveSequenceMemoryDifficulty,
  sequenceMemoryParamsForLevel,
  sequenceMemoryParamsFromProfile,
  sessionChallengeRating,
} from '../difficulty';
import type { SequenceMemoryDifficultyParams } from '../types';

describe('SEQUENCE_MEMORY_DIFFICULTY_PARAMS', () => {
  it('tunes each fixed level (pad size, lengths, reveal speed, budget)', () => {
    expect(SEQUENCE_MEMORY_DIFFICULTY_PARAMS.easy).toEqual({
      tileCount: 4,
      baseLength: 2,
      maxLength: 6,
      revealMs: 1100,
      sessionSeconds: 60,
    });
    expect(SEQUENCE_MEMORY_DIFFICULTY_PARAMS.normal).toEqual({
      tileCount: 4,
      baseLength: 3,
      maxLength: 8,
      revealMs: 900,
      sessionSeconds: 90,
    });
    expect(SEQUENCE_MEMORY_DIFFICULTY_PARAMS.hard).toEqual({
      tileCount: 9,
      baseLength: 4,
      maxLength: 12,
      revealMs: 700,
      sessionSeconds: 120,
    });
    expect(SEQUENCE_MEMORY_DIFFICULTY_PARAMS.expert).toEqual({
      tileCount: 9,
      baseLength: 5,
      maxLength: 14,
      revealMs: 550,
      sessionSeconds: 180,
    });
  });

  it('keeps invariants across all levels', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const params = SEQUENCE_MEMORY_DIFFICULTY_PARAMS[level];
      expect(params.tileCount).toBeGreaterThan(0);
      expect(params.baseLength).toBeGreaterThan(0);
      expect(params.maxLength).toBeGreaterThanOrEqual(params.baseLength);
      expect(params.revealMs).toBeGreaterThan(0);
      expect(params.sessionSeconds).toBeGreaterThanOrEqual(60);
      expect(params.sessionSeconds).toBeLessThanOrEqual(180);
    }
  });

  it('defines adaptive tuning with min/max bounds', () => {
    expect(ADAPTIVE_PARAMS).toEqual({
      tileCount: 4,
      baseLength: 3,
      maxLength: 10,
      revealMs: 900,
      sessionSeconds: 90,
      minLength: 2,
    });
  });
});

describe('sequenceMemoryParamsForLevel / resolveSequenceMemoryDifficulty', () => {
  it('returns fresh parameter objects', () => {
    expect(sequenceMemoryParamsForLevel('normal')).not.toBe(SEQUENCE_MEMORY_DIFFICULTY_PARAMS.normal);
    expect(sequenceMemoryParamsForLevel('adaptive')).not.toBe(ADAPTIVE_PARAMS);
  });

  it('resolves SDK default challenge ratings with the game parameters', () => {
    const easy = resolveSequenceMemoryDifficulty('easy');
    expect(easy.challengeRating).toBe(0.2);
    expect(easy.parameters.tileCount).toBe(4);
    const expert = resolveSequenceMemoryDifficulty('expert');
    expect(expert.challengeRating).toBe(0.95);
    expect(expert.parameters.sessionSeconds).toBe(180);
    const adaptive = resolveSequenceMemoryDifficulty('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
    expect(adaptive.parameters.minLength).toBe(2);
  });
});

describe('sequenceMemoryParamsFromProfile', () => {
  it('round-trips a resolved profile', () => {
    const profile = resolveSequenceMemoryDifficulty('hard');
    expect(sequenceMemoryParamsFromProfile(profile)).toEqual(SEQUENCE_MEMORY_DIFFICULTY_PARAMS.hard);
  });

  it('throws when a required parameter is missing or non-finite', () => {
    const base = { ...resolveSequenceMemoryDifficulty('normal') };
    const missing: DifficultyProfile = {
      ...base,
      parameters: { tileCount: 4, baseLength: 3, maxLength: 8, revealMs: 900 },
    };
    expect(() => sequenceMemoryParamsFromProfile(missing)).toThrow(/sessionSeconds/);
    const nonFinite: DifficultyProfile = {
      ...base,
      parameters: { ...base.parameters, revealMs: Number.NaN },
    };
    expect(() => sequenceMemoryParamsFromProfile(nonFinite)).toThrow(/revealMs/);
  });
});

describe('nextSequenceLength', () => {
  const params = (level: DifficultyLevel): SequenceMemoryDifficultyParams =>
    sequenceMemoryParamsForLevel(level);

  it('escalates by one on a pass, capped at maxLength (fixed levels)', () => {
    expect(nextSequenceLength(3, true, 'normal', params('normal'))).toBe(4);
    expect(nextSequenceLength(8, true, 'normal', params('normal'))).toBe(8); // capped
    expect(nextSequenceLength(2, true, 'easy', params('easy'))).toBe(3);
  });

  it('restarts at baseLength on a failure (classic Simon rule, fixed levels)', () => {
    expect(nextSequenceLength(6, false, 'normal', params('normal'))).toBe(3);
    expect(nextSequenceLength(3, false, 'normal', params('normal'))).toBe(3);
    expect(nextSequenceLength(5, false, 'expert', params('expert'))).toBe(5);
  });

  it('moves ±1 within [minLength, maxLength] for adaptive', () => {
    expect(nextSequenceLength(3, true, 'adaptive', params('adaptive'))).toBe(4);
    expect(nextSequenceLength(3, false, 'adaptive', params('adaptive'))).toBe(2); // min floor
    expect(nextSequenceLength(2, false, 'adaptive', params('adaptive'))).toBe(2);
    expect(nextSequenceLength(10, true, 'adaptive', params('adaptive'))).toBe(10); // max cap
  });
});

describe('sessionChallengeRating', () => {
  it('reports the SDK default rating for fixed levels', () => {
    const profile = resolveSequenceMemoryDifficulty('hard');
    expect(sessionChallengeRating('hard', profile, 4)).toBe(0.8);
    expect(sessionChallengeRating('hard', profile, 12)).toBe(0.8);
  });

  it('maps the final sequence length into [0, 1] for adaptive', () => {
    const profile = resolveSequenceMemoryDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 2)).toBe(0); // minLength
    expect(sessionChallengeRating('adaptive', profile, 10)).toBe(1); // maxLength
    expect(sessionChallengeRating('adaptive', profile, 6)).toBeCloseTo(0.5);
    expect(sessionChallengeRating('adaptive', profile, 0)).toBe(0); // clamped
    expect(sessionChallengeRating('adaptive', profile, 99)).toBe(1); // clamped
  });
});
