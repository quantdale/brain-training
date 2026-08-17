// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CHALLENGE_RATINGS } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  WORD_SCRAMBLE_DIFFICULTY_PARAMS,
  adaptiveRoundParams,
  resolveWordScrambleDifficulty,
  sessionChallengeRating,
  wordScrambleParamsForLevel,
  wordScrambleParamsFromProfile,
} from '../difficulty';

describe('Word Scramble difficulty parameter mapping', () => {
  it('maps each fixed level to concrete options/length/rounds tuning', () => {
    expect(WORD_SCRAMBLE_DIFFICULTY_PARAMS.easy).toEqual({
      optionsCount: 3,
      minWordLength: 4,
      maxWordLength: 5,
      rounds: 4,
      roundTimeMs: 30_000,
    });
    expect(WORD_SCRAMBLE_DIFFICULTY_PARAMS.normal).toEqual({
      optionsCount: 4,
      minWordLength: 4,
      maxWordLength: 6,
      rounds: 5,
      roundTimeMs: 25_000,
    });
    expect(WORD_SCRAMBLE_DIFFICULTY_PARAMS.hard).toEqual({
      optionsCount: 4,
      minWordLength: 5,
      maxWordLength: 8,
      rounds: 6,
      roundTimeMs: 20_000,
    });
    expect(WORD_SCRAMBLE_DIFFICULTY_PARAMS.expert).toEqual({
      optionsCount: 5,
      minWordLength: 6,
      maxWordLength: 10,
      rounds: 7,
      roundTimeMs: 15_000,
    });
  });

  it('defines adaptive tuning with min/max bounds', () => {
    expect(ADAPTIVE_PARAMS).toEqual({
      optionsCount: 4,
      minWordLength: 4,
      maxWordLength: 7,
      rounds: 6,
      roundTimeMs: 20_000,
      minOptionsCount: 3,
      maxOptionsCount: 5,
      adaptiveMinWordLength: 3,
      adaptiveMaxWordLength: 9,
    });
  });

  it('resolves levels through the SDK with the game parameters attached', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = resolveWordScrambleDifficulty(level);
      expect(profile.level).toBe(level);
      expect(profile.challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS[level]);
      expect(profile.parameters).toEqual(wordScrambleParamsForLevel(level));
    }
    const adaptive = resolveWordScrambleDifficulty('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
    expect(adaptive.parameters).toEqual(ADAPTIVE_PARAMS);
  });

  it('returns fresh param objects (never mutates the frozen defaults)', () => {
    const a = wordScrambleParamsForLevel('easy');
    const b = wordScrambleParamsForLevel('easy');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a).not.toBe(WORD_SCRAMBLE_DIFFICULTY_PARAMS.easy);
  });

  it('round-trips parameters through a resolved profile', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const) {
      const params = wordScrambleParamsFromProfile(resolveWordScrambleDifficulty(level));
      expect(params).toEqual(wordScrambleParamsForLevel(level));
    }
  });

  it('rejects profiles missing a required parameter', () => {
    const profile = resolveWordScrambleDifficulty('normal');
    const { optionsCount: _omitted, ...incomplete } = profile.parameters;
    expect(() => wordScrambleParamsFromProfile({ ...profile, parameters: incomplete })).toThrow(
      /optionsCount/,
    );
  });
});

describe('adaptiveRoundParams', () => {
  it('returns the same params for fixed levels', () => {
    const params = WORD_SCRAMBLE_DIFFICULTY_PARAMS.normal;
    const result = adaptiveRoundParams('normal', params, true);
    expect(result).toEqual({
      optionsCount: params.optionsCount,
      minWordLength: params.minWordLength,
      maxWordLength: params.maxWordLength,
    });
  });

  it('escalates options and word length on a pass for adaptive', () => {
    const params = { ...ADAPTIVE_PARAMS };
    const result = adaptiveRoundParams('adaptive', params, true);
    expect(result.optionsCount).toBe(5);
    expect(result.minWordLength).toBe(5);
    expect(result.maxWordLength).toBe(8);
  });

  it('de-escalates on a failure for adaptive', () => {
    const params = { ...ADAPTIVE_PARAMS };
    const result = adaptiveRoundParams('adaptive', params, false);
    expect(result.optionsCount).toBe(3);
    expect(result.minWordLength).toBe(3);
    expect(result.maxWordLength).toBe(6);
  });

  it('clamps to min/max bounds', () => {
    const maxed = { ...ADAPTIVE_PARAMS, optionsCount: 5, minWordLength: 9, maxWordLength: 9 };
    const result = adaptiveRoundParams('adaptive', maxed, true);
    expect(result.optionsCount).toBe(5); // already at max
    expect(result.minWordLength).toBe(9); // already at max
  });
});

describe('sessionChallengeRating', () => {
  it('reports the SDK default rating for fixed levels', () => {
    const profile = resolveWordScrambleDifficulty('hard');
    expect(sessionChallengeRating('hard', profile, 4)).toBe(profile.challengeRating);
  });

  it('maps the adaptive options count linearly into [0, 1]', () => {
    const profile = resolveWordScrambleDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 3)).toBe(0);
    expect(sessionChallengeRating('adaptive', profile, 4)).toBe(0.5);
    expect(sessionChallengeRating('adaptive', profile, 5)).toBe(1);
  });
});
