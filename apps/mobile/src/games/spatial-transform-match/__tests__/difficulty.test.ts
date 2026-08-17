// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CHALLENGE_RATINGS } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  DIFFICULTY_PARAMS,
  nextFilledCells,
  nextOptionCount,
  paramsForLevel,
  paramsFromProfile,
  resolveGameDifficulty,
  sessionChallengeRating,
} from '../difficulty';
import type { SpatialTransformMatchDifficultyParams } from '../types';

describe('Difficulty parameter mapping', () => {
  it('maps each fixed level to concrete grid/filled/transform/option/rounds tuning', () => {
    expect(DIFFICULTY_PARAMS.easy).toEqual({
      gridSize: 9,
      filledCells: 3,
      allowedTransforms: ['rotate90'],
      optionCount: 2,
      rounds: 4,
      sourceRevealMs: 2000,
    });
    expect(DIFFICULTY_PARAMS.normal).toEqual({
      gridSize: 9,
      filledCells: 4,
      allowedTransforms: ['rotate90', 'rotate180'],
      optionCount: 3,
      rounds: 5,
      sourceRevealMs: 1500,
    });
    expect(DIFFICULTY_PARAMS.hard).toEqual({
      gridSize: 16,
      filledCells: 4,
      allowedTransforms: ['rotate90', 'rotate180', 'rotate270'],
      optionCount: 3,
      rounds: 6,
      sourceRevealMs: 1200,
    });
    expect(DIFFICULTY_PARAMS.expert).toEqual({
      gridSize: 16,
      filledCells: 5,
      allowedTransforms: ['rotate90', 'rotate180', 'rotate270', 'mirrorH', 'mirrorV'],
      optionCount: 4,
      rounds: 7,
      sourceRevealMs: 1000,
    });
  });

  it('defines adaptive tuning with min/max bounds', () => {
    expect(ADAPTIVE_PARAMS.gridSize).toBe(9);
    expect(ADAPTIVE_PARAMS.filledCells).toBe(3);
    expect(ADAPTIVE_PARAMS.minFilledCells).toBe(3);
    expect(ADAPTIVE_PARAMS.maxFilledCells).toBe(6);
    expect(ADAPTIVE_PARAMS.minOptionCount).toBe(2);
    expect(ADAPTIVE_PARAMS.maxOptionCount).toBe(4);
  });

  it('resolves levels through the SDK with the game parameters attached', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = resolveGameDifficulty(level);
      expect(profile.level).toBe(level);
      expect(profile.challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS[level]);
    }
    const adaptive = resolveGameDifficulty('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
  });

  it('returns fresh param objects (never mutates the frozen defaults)', () => {
    const a = paramsForLevel('easy');
    const b = paramsForLevel('easy');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a).not.toBe(DIFFICULTY_PARAMS.easy);
  });
});

describe('nextFilledCells', () => {
  const params: SpatialTransformMatchDifficultyParams = {
    gridSize: 9,
    filledCells: 4,
    allowedTransforms: ['rotate90'],
    optionCount: 2,
    rounds: 5,
    sourceRevealMs: 1500,
  };

  it('returns the fixed count for non-adaptive levels', () => {
    expect(nextFilledCells(3, true, 'normal', params)).toBe(4);
    expect(nextFilledCells(5, false, 'normal', params)).toBe(4);
  });

  it('scales up on pass and down on fail for adaptive', () => {
    const adaptive: SpatialTransformMatchDifficultyParams = {
      ...params,
      minFilledCells: 3,
      maxFilledCells: 6,
    };
    expect(nextFilledCells(4, true, 'adaptive', adaptive)).toBe(5);
    expect(nextFilledCells(4, false, 'adaptive', adaptive)).toBe(3);
    expect(nextFilledCells(6, true, 'adaptive', adaptive)).toBe(6);
    expect(nextFilledCells(3, false, 'adaptive', adaptive)).toBe(3);
  });
});

describe('nextOptionCount', () => {
  const params: SpatialTransformMatchDifficultyParams = {
    gridSize: 9,
    filledCells: 4,
    allowedTransforms: ['rotate90'],
    optionCount: 3,
    rounds: 5,
    sourceRevealMs: 1500,
  };

  it('returns the fixed count for non-adaptive levels', () => {
    expect(nextOptionCount(2, true, 'normal', params)).toBe(3);
  });

  it('scales up/down for adaptive', () => {
    const adaptive: SpatialTransformMatchDifficultyParams = {
      ...params,
      minOptionCount: 2,
      maxOptionCount: 4,
    };
    expect(nextOptionCount(2, true, 'adaptive', adaptive)).toBe(3);
    expect(nextOptionCount(3, false, 'adaptive', adaptive)).toBe(2);
    expect(nextOptionCount(4, true, 'adaptive', adaptive)).toBe(4);
    expect(nextOptionCount(2, false, 'adaptive', adaptive)).toBe(2);
  });
});

describe('sessionChallengeRating', () => {
  it('reports the SDK default rating for fixed levels', () => {
    const profile = resolveGameDifficulty('hard');
    expect(sessionChallengeRating('hard', profile, 4)).toBe(profile.challengeRating);
  });

  it('maps the adaptive final filled-cells linearly into [0, 1]', () => {
    const profile = resolveGameDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 3)).toBe(0);
    expect(sessionChallengeRating('adaptive', profile, 4.5)).toBe(0.5);
    expect(sessionChallengeRating('adaptive', profile, 6)).toBe(1);
  });
});
