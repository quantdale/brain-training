// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CHALLENGE_RATINGS } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  DIFFICULTY_PARAMS,
  adaptiveGridSize,
  nextSequenceLength,
  paramsForLevel,
  paramsFromProfile,
  resolvePatternTapBackDifficulty,
  sessionChallengeRating,
} from '../difficulty';
import type { PatternTapBackDifficultyParams } from '../types';

describe('Pattern Tap Back difficulty parameter mapping', () => {
  it('maps each fixed level to concrete tuning', () => {
    expect(DIFFICULTY_PARAMS.easy).toEqual({
      gridSize: 9,
      initialSequenceLength: 3,
      maxSequenceLength: 6,
      baseObserveMs: 600,
      stepObserveMs: 200,
      rounds: 4,
    });
    expect(DIFFICULTY_PARAMS.normal).toEqual({
      gridSize: 9,
      initialSequenceLength: 4,
      maxSequenceLength: 8,
      baseObserveMs: 500,
      stepObserveMs: 200,
      rounds: 5,
    });
    expect(DIFFICULTY_PARAMS.hard).toEqual({
      gridSize: 16,
      initialSequenceLength: 5,
      maxSequenceLength: 10,
      baseObserveMs: 500,
      stepObserveMs: 200,
      rounds: 6,
    });
    expect(DIFFICULTY_PARAMS.expert).toEqual({
      gridSize: 16,
      initialSequenceLength: 6,
      maxSequenceLength: 12,
      baseObserveMs: 500,
      stepObserveMs: 200,
      rounds: 7,
    });
  });

  it('defines adaptive tuning with escalation parameters', () => {
    expect(ADAPTIVE_PARAMS.gridSize).toBe(9);
    expect(ADAPTIVE_PARAMS.initialSequenceLength).toBe(3);
    expect(ADAPTIVE_PARAMS.maxSequenceLength).toBe(12);
    expect(ADAPTIVE_PARAMS.rounds).toBe(5);
    expect(ADAPTIVE_PARAMS.escalatedGridSize).toBe(16);
  });

  it('resolves levels through the SDK with the game parameters attached', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = resolvePatternTapBackDifficulty(level);
      expect(profile.level).toBe(level);
      expect(profile.challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS[level]);
      expect(profile.parameters).toEqual(paramsForLevel(level));
    }
    const adaptive = resolvePatternTapBackDifficulty('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
    expect(adaptive.parameters).toEqual(ADAPTIVE_PARAMS);
  });

  it('returns fresh param objects (never mutates the frozen defaults)', () => {
    const a = paramsForLevel('easy');
    const b = paramsForLevel('easy');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a).not.toBe(DIFFICULTY_PARAMS.easy);
  });

  it('round-trips parameters through a resolved profile', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const) {
      const params = paramsFromProfile(resolvePatternTapBackDifficulty(level));
      expect(params).toEqual(paramsForLevel(level));
    }
  });

  it('rejects profiles missing a required parameter', () => {
    const profile = resolvePatternTapBackDifficulty('normal');
    const { baseObserveMs: _omitted, ...incomplete } = profile.parameters;
    expect(() => paramsFromProfile({ ...profile, parameters: incomplete })).toThrow(
      /baseObserveMs/,
    );
  });
});

describe('nextSequenceLength', () => {
  const params: PatternTapBackDifficultyParams = {
    gridSize: 9,
    initialSequenceLength: 4,
    maxSequenceLength: 8,
    baseObserveMs: 500,
    stepObserveMs: 200,
    rounds: 5,
  };

  it('escalates fixed levels on a pass, capped at maxSequenceLength', () => {
    expect(nextSequenceLength(4, true, 'normal', params)).toBe(5);
    expect(nextSequenceLength(8, true, 'normal', params)).toBe(8);
  });

  it('holds the length on a fixed-level failure', () => {
    expect(nextSequenceLength(5, false, 'normal', params)).toBe(5);
  });

  it('moves ±1 for adaptive, within [initialSequenceLength, maxSequenceLength]', () => {
    const adaptive: PatternTapBackDifficultyParams = { ...params, initialSequenceLength: 3, maxSequenceLength: 8 };
    expect(nextSequenceLength(4, true, 'adaptive', adaptive)).toBe(5);
    expect(nextSequenceLength(4, false, 'adaptive', adaptive)).toBe(3);
    expect(nextSequenceLength(8, true, 'adaptive', adaptive)).toBe(8);
    expect(nextSequenceLength(3, false, 'adaptive', adaptive)).toBe(3);
  });
});

describe('sessionChallengeRating', () => {
  it('reports the SDK default rating for fixed levels', () => {
    const profile = resolvePatternTapBackDifficulty('hard');
    expect(sessionChallengeRating('hard', profile, 6)).toBe(profile.challengeRating);
  });

  it('maps the adaptive final length linearly into [0, 1]', () => {
    const profile = resolvePatternTapBackDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 3)).toBe(0);
    expect(sessionChallengeRating('adaptive', profile, 7.5)).toBe(0.5);
    expect(sessionChallengeRating('adaptive', profile, 12)).toBe(1);
  });
});

describe('adaptiveGridSize', () => {
  it('returns the base grid for early rounds and escalated grid for later rounds', () => {
    const params: PatternTapBackDifficultyParams = {
      ...ADAPTIVE_PARAMS,
      escalatedGridSize: 16,
    };
    expect(adaptiveGridSize(0, params)).toBe(9);
    expect(adaptiveGridSize(2, params)).toBe(9);
    expect(adaptiveGridSize(3, params)).toBe(16);
    expect(adaptiveGridSize(4, params)).toBe(16);
  });

  it('returns gridSize when no escalation', () => {
    const params = DIFFICULTY_PARAMS.normal;
    expect(adaptiveGridSize(0, params)).toBe(9);
    expect(adaptiveGridSize(10, params)).toBe(9);
  });
});
