// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CHALLENGE_RATINGS } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  SPEED_DIFFICULTY_PARAMS,
  nextDelayMinMs,
  resolveSpeedDifficulty,
  sessionChallengeRating,
  speedParamsForLevel,
  speedParamsFromProfile,
} from '../difficulty';
import type { SpeedDifficultyParams } from '../types';

describe('Speed difficulty parameter mapping', () => {
  it('maps each fixed level to concrete rounds/delay/threshold tuning', () => {
    expect(SPEED_DIFFICULTY_PARAMS.easy).toEqual({
      rounds: 8,
      minDelayMs: 1200,
      maxDelayMs: 3500,
      falseStartBudget: 2,
      targetMs: 450,
      passMs: 700,
      failMs: 900,
      timeoutMs: 2500,
    });
    expect(SPEED_DIFFICULTY_PARAMS.normal).toEqual({
      rounds: 10,
      minDelayMs: 1000,
      maxDelayMs: 3000,
      falseStartBudget: 1,
      targetMs: 400,
      passMs: 600,
      failMs: 800,
      timeoutMs: 2200,
    });
    expect(SPEED_DIFFICULTY_PARAMS.hard).toEqual({
      rounds: 12,
      minDelayMs: 800,
      maxDelayMs: 2500,
      falseStartBudget: 1,
      targetMs: 350,
      passMs: 550,
      failMs: 700,
      timeoutMs: 2000,
    });
    expect(SPEED_DIFFICULTY_PARAMS.expert).toEqual({
      rounds: 15,
      minDelayMs: 700,
      maxDelayMs: 2000,
      falseStartBudget: 1,
      targetMs: 300,
      passMs: 500,
      failMs: 600,
      timeoutMs: 1800,
    });
  });

  it('defines adaptive tuning with delay bounds and step', () => {
    expect(ADAPTIVE_PARAMS).toEqual({
      rounds: 10,
      minDelayMs: 1000,
      maxDelayMs: 2500,
      falseStartBudget: 1,
      targetMs: 400,
      passMs: 600,
      failMs: 800,
      timeoutMs: 2200,
      minDelayBoundMs: 600,
      maxDelayBoundMs: 2200,
      delayStepMs: 150,
    });
  });

  it('resolves levels through the SDK with the game parameters attached', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = resolveSpeedDifficulty(level);
      expect(profile.level).toBe(level);
      expect(profile.challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS[level]);
      expect(profile.parameters).toEqual(speedParamsForLevel(level));
    }
    const adaptive = resolveSpeedDifficulty('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
    expect(adaptive.parameters).toEqual(ADAPTIVE_PARAMS);
  });

  it('returns fresh param objects (never mutates the frozen defaults)', () => {
    const a = speedParamsForLevel('normal');
    const b = speedParamsForLevel('normal');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a).not.toBe(SPEED_DIFFICULTY_PARAMS.normal);
  });

  it('round-trips parameters through a resolved profile', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const) {
      const params = speedParamsFromProfile(resolveSpeedDifficulty(level));
      expect(params).toEqual(speedParamsForLevel(level));
    }
  });

  it('rejects profiles missing a required parameter', () => {
    const profile = resolveSpeedDifficulty('normal');
    const { targetMs: _omitted, ...incomplete } = profile.parameters;
    expect(() => speedParamsFromProfile({ ...profile, parameters: incomplete })).toThrow(
      /targetMs/,
    );
  });
});

describe('nextDelayMinMs', () => {
  const params: SpeedDifficultyParams = {
    rounds: 10,
    minDelayMs: 1000,
    maxDelayMs: 3000,
    falseStartBudget: 1,
    targetMs: 400,
    passMs: 600,
    failMs: 800,
    timeoutMs: 2200,
  };

  it('keeps the constant minimum for fixed levels', () => {
    expect(nextDelayMinMs(500, true, 'normal', params)).toBe(1000);
    expect(nextDelayMinMs(2000, false, 'hard', SPEED_DIFFICULTY_PARAMS.hard)).toBe(800);
  });

  it('moves ±step for adaptive, within [minDelayBoundMs, maxDelayBoundMs]', () => {
    const adaptive: SpeedDifficultyParams = {
      ...params,
      minDelayBoundMs: 600,
      maxDelayBoundMs: 2200,
      delayStepMs: 150,
    };
    expect(nextDelayMinMs(1000, true, 'adaptive', adaptive)).toBe(850);
    expect(nextDelayMinMs(1000, false, 'adaptive', adaptive)).toBe(1150);
    expect(nextDelayMinMs(650, true, 'adaptive', adaptive)).toBe(600); // lower bound
    expect(nextDelayMinMs(2150, false, 'adaptive', adaptive)).toBe(2200); // upper bound
  });
});

describe('sessionChallengeRating', () => {
  it('reports the SDK default rating for fixed levels', () => {
    const profile = resolveSpeedDifficulty('hard');
    expect(sessionChallengeRating('hard', profile, 400)).toBe(profile.challengeRating);
  });

  it('maps the adaptive median reaction time linearly into [0, 1]', () => {
    const profile = resolveSpeedDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 400)).toBe(1); // at target
    expect(sessionChallengeRating('adaptive', profile, 800)).toBe(0); // at fail
    expect(sessionChallengeRating('adaptive', profile, 600)).toBe(0.5);
    expect(sessionChallengeRating('adaptive', profile, 350)).toBe(1); // clamps above
    expect(sessionChallengeRating('adaptive', profile, 900)).toBe(0); // clamps below
  });

  it('rates a session with no valid reaction at 0 (adaptive)', () => {
    const profile = resolveSpeedDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, null)).toBe(0);
  });
});
