// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CHALLENGE_RATINGS } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  MEMORY_DIFFICULTY_PARAMS,
  memoryParamsForLevel,
  memoryParamsFromProfile,
  nextSequenceLength,
  resolveMemoryDifficulty,
  sessionChallengeRating,
} from '../difficulty';
import type { MemoryDifficultyParams } from '../types';

describe('Memory difficulty parameter mapping', () => {
  it('maps each fixed level to concrete grid/sequence/reveal/rounds tuning', () => {
    expect(MEMORY_DIFFICULTY_PARAMS.easy).toEqual({
      gridSize: 9,
      initialSequenceLength: 3,
      revealMs: 1100,
      rounds: 4,
    });
    expect(MEMORY_DIFFICULTY_PARAMS.normal).toEqual({
      gridSize: 9,
      initialSequenceLength: 4,
      revealMs: 900,
      rounds: 5,
    });
    expect(MEMORY_DIFFICULTY_PARAMS.hard).toEqual({
      gridSize: 16,
      initialSequenceLength: 5,
      revealMs: 750,
      rounds: 6,
    });
    expect(MEMORY_DIFFICULTY_PARAMS.expert).toEqual({
      gridSize: 16,
      initialSequenceLength: 6,
      revealMs: 600,
      rounds: 7,
    });
  });

  it('defines adaptive tuning with min/max length bounds', () => {
    expect(ADAPTIVE_PARAMS).toEqual({
      gridSize: 9,
      initialSequenceLength: 4,
      revealMs: 900,
      rounds: 6,
      minSequenceLength: 3,
      maxSequenceLength: 8,
    });
  });

  it('resolves levels through the SDK with the game parameters attached', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = resolveMemoryDifficulty(level);
      expect(profile.level).toBe(level);
      expect(profile.challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS[level]);
      expect(profile.parameters).toEqual(memoryParamsForLevel(level));
    }
    const adaptive = resolveMemoryDifficulty('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
    expect(adaptive.parameters).toEqual(ADAPTIVE_PARAMS);
  });

  it('returns fresh param objects (never mutates the frozen defaults)', () => {
    const a = memoryParamsForLevel('easy');
    const b = memoryParamsForLevel('easy');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a).not.toBe(MEMORY_DIFFICULTY_PARAMS.easy);
  });

  it('round-trips parameters through a resolved profile', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const) {
      const params = memoryParamsFromProfile(resolveMemoryDifficulty(level));
      expect(params).toEqual(memoryParamsForLevel(level));
    }
  });

  it('rejects profiles missing a required parameter', () => {
    const profile = resolveMemoryDifficulty('normal');
    const { revealMs: _omitted, ...incomplete } = profile.parameters;
    expect(() => memoryParamsFromProfile({ ...profile, parameters: incomplete })).toThrow(
      /revealMs/,
    );
  });
});

describe('nextSequenceLength', () => {
  const params: MemoryDifficultyParams = { gridSize: 9, initialSequenceLength: 4, revealMs: 900, rounds: 5 };

  it('escalates fixed levels on a pass, capped at the grid size', () => {
    expect(nextSequenceLength(4, true, 'normal', params)).toBe(5);
    expect(nextSequenceLength(9, true, 'normal', params)).toBe(9);
  });

  it('holds the length on a fixed-level failure', () => {
    expect(nextSequenceLength(5, false, 'normal', params)).toBe(5);
  });

  it('moves ±1 for adaptive, within [min, max]', () => {
    const adaptive: MemoryDifficultyParams = { ...params, minSequenceLength: 3, maxSequenceLength: 8 };
    expect(nextSequenceLength(4, true, 'adaptive', adaptive)).toBe(5);
    expect(nextSequenceLength(4, false, 'adaptive', adaptive)).toBe(3);
    expect(nextSequenceLength(8, true, 'adaptive', adaptive)).toBe(8);
    expect(nextSequenceLength(3, false, 'adaptive', adaptive)).toBe(3);
  });
});

describe('sessionChallengeRating', () => {
  it('reports the SDK default rating for fixed levels', () => {
    const profile = resolveMemoryDifficulty('hard');
    expect(sessionChallengeRating('hard', profile, 6)).toBe(profile.challengeRating);
  });

  it('maps the adaptive final length linearly into [0, 1]', () => {
    const profile = resolveMemoryDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 3)).toBe(0);
    expect(sessionChallengeRating('adaptive', profile, 5.5)).toBe(0.5);
    expect(sessionChallengeRating('adaptive', profile, 8)).toBe(1);
  });
});
