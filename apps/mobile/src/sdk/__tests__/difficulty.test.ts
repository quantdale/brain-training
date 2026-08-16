// Jest globals imported explicitly (repo has no @types/jest; see orchestrator report).
import { describe, expect, it } from '@jest/globals';
import {
  resolveDifficulty,
  DEFAULT_CHALLENGE_RATINGS,
  ADAPTIVE_BASELINE,
  clampChallengeRating,
  DIFFICULTY_LABELS,
  isDifficultyLevel,
  DIFFICULTY_LEVELS,
} from '../types/difficulty';

describe('resolveDifficulty', () => {
  it('maps fixed levels to documented default challenge ratings', () => {
    expect(resolveDifficulty('easy').challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS.easy);
    expect(resolveDifficulty('normal').challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS.normal);
    expect(resolveDifficulty('hard').challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS.hard);
    expect(resolveDifficulty('expert').challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS.expert);
  });

  it('resolves adaptive to the neutral baseline', () => {
    const profile = resolveDifficulty('adaptive');
    expect(profile.level).toBe('adaptive');
    expect(profile.challengeRating).toBe(ADAPTIVE_BASELINE.challengeRating);
  });

  it('carries game-defined internal parameters', () => {
    const profile = resolveDifficulty('normal', { sequenceLength: 7, windowMs: 1500 });
    expect(profile.parameters).toEqual({ sequenceLength: 7, windowMs: 1500 });
    expect(profile.challengeRating).toBe(0.5);
  });

  it('returns a fresh object and never mutates the defaults', () => {
    const first = resolveDifficulty('hard', { x: 1 });
    const second = resolveDifficulty('hard', { x: 2 });
    expect(first).not.toBe(second);
    expect(first.parameters).not.toBe(DEFAULT_CHALLENGE_RATINGS);
    // Defaults still intact after merges.
    expect(resolveDifficulty('hard').challengeRating).toBe(0.8);
  });

  it('adaptive with parameters carries them', () => {
    const profile = resolveDifficulty('adaptive', { stepMs: 250 });
    expect(profile.parameters).toEqual({ stepMs: 250 });
  });
});

describe('clampChallengeRating', () => {
  it('clamps to [0, 1]', () => {
    expect(clampChallengeRating(1.5)).toBe(1);
    expect(clampChallengeRating(-0.2)).toBe(0);
    expect(clampChallengeRating(0.42)).toBe(0.42);
  });

  it('rejects non-finite ratings', () => {
    expect(() => clampChallengeRating(NaN)).toThrow(RangeError);
    expect(() => clampChallengeRating(Infinity)).toThrow(RangeError);
  });
});

describe('difficulty vocabulary', () => {
  it('exposes exactly the five named levels', () => {
    expect(DIFFICULTY_LEVELS).toEqual(['easy', 'normal', 'hard', 'expert', 'adaptive']);
    for (const level of DIFFICULTY_LEVELS) {
      expect(isDifficultyLevel(level)).toBe(true);
      expect(DIFFICULTY_LABELS[level]).toEqual(expect.any(String));
    }
    expect(isDifficultyLevel('insane')).toBe(false);
    expect(isDifficultyLevel(42)).toBe(false);
  });
});
