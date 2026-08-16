// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  accuracyOf,
  clamp01,
  normalizeFlexibilityResult,
  perfectSessionScore,
  roundScore,
  speedScoreOf,
  switchAccuracyOf,
} from '../scoring';
import { FLEXIBILITY_DIFFICULTY_PARAMS } from '../difficulty';
import type { FlexibilityRawResult } from '../types';

function rawResult(overrides: Partial<FlexibilityRawResult>): FlexibilityRawResult {
  return {
    score: 0,
    totalRounds: 10,
    roundsPlayed: 0,
    correctPicks: 0,
    mistakes: 0,
    accuracy: 0,
    bestStreak: 0,
    totalResponseMs: 0,
    scoredPicks: 0,
    speedScore: 0,
    postSwitchPlayed: 0,
    postSwitchCorrect: 0,
    switchAccuracy: 0,
    numShapes: 3,
    numColors: 3,
    switchEvery: 3,
    noticeMs: 1600,
    speedTargetMs: 5000,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {
      gameId: 'flexibility-card-sort',
      sdkVersion: '0.1.0',
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      seed: 's',
      difficulty: 'normal',
      startedAtMs: 0,
      activeDurationMs: 0,
      pausedDurationMs: 0,
    },
    ...overrides,
  };
}

describe('roundScore', () => {
  it('awards 100 base plus up to 50 speed bonus for a correct pick', () => {
    expect(roundScore(true, 0, 5000)).toBe(150);
    expect(roundScore(true, 2500, 5000)).toBe(125);
    expect(roundScore(true, 5000, 5000)).toBe(100); // at target: no bonus
    expect(roundScore(true, 9000, 5000)).toBe(100); // slower: clamped to 0 bonus
  });

  it('awards 0 for a wrong pick (the mistake penalty)', () => {
    expect(roundScore(false, 0, 5000)).toBe(0);
    expect(roundScore(false, 100, 5000)).toBe(0);
  });
});

describe('perfectSessionScore', () => {
  it('is 150 per round (perfect accuracy at instant speed)', () => {
    expect(perfectSessionScore(FLEXIBILITY_DIFFICULTY_PARAMS.easy)).toBe(8 * 150);
    expect(perfectSessionScore(FLEXIBILITY_DIFFICULTY_PARAMS.normal)).toBe(10 * 150);
    expect(perfectSessionScore(FLEXIBILITY_DIFFICULTY_PARAMS.expert)).toBe(12 * 150);
  });
});

describe('accuracyOf', () => {
  it('computes the correct-pick ratio', () => {
    expect(accuracyOf(8, 10)).toBe(0.8);
    expect(accuracyOf(10, 10)).toBe(1);
    expect(accuracyOf(0, 4)).toBe(0);
  });

  it('guards division by zero', () => {
    expect(accuracyOf(0, 0)).toBe(0);
  });
});

describe('speedScoreOf', () => {
  it('is 1 at instant speed and 0 at (or beyond) the target', () => {
    expect(speedScoreOf(0, 4, 5000)).toBe(1);
    expect(speedScoreOf(20_000, 4, 5000)).toBe(0);
    expect(speedScoreOf(30_000, 4, 5000)).toBe(0);
  });

  it('scales linearly with the mean response time', () => {
    expect(speedScoreOf(10_000, 4, 5000)).toBe(0.5); // mean 2500 = half target
    expect(speedScoreOf(2500, 1, 5000)).toBe(0.5);
    expect(speedScoreOf(12_500, 5, 5000)).toBe(0.5);
  });

  it('guards division by zero with no picks', () => {
    expect(speedScoreOf(0, 0, 5000)).toBe(0);
  });
});

describe('switchAccuracyOf', () => {
  it('computes the post-switch ratio and guards zero played', () => {
    expect(switchAccuracyOf(2, 3)).toBeCloseTo(2 / 3);
    expect(switchAccuracyOf(0, 0)).toBe(0);
  });
});

describe('clamp01', () => {
  it('clamps into [0, 1]', () => {
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
  });

  it('rejects non-finite input', () => {
    expect(() => clamp01(Number.NaN)).toThrow(RangeError);
    expect(() => clamp01(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('normalizeFlexibilityResult (documented formula)', () => {
  it('scores a perfect fast run at 1.0', () => {
    const normalized = normalizeFlexibilityResult(
      rawResult({
        roundsPlayed: 10,
        correctPicks: 10,
        totalResponseMs: 0,
        scoredPicks: 10,
        postSwitchPlayed: 3,
        postSwitchCorrect: 3,
        accuracy: 1,
      }),
      { gameId: 'flexibility-card-sort', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.scale).toBe('0..1');
    expect(normalized.value).toBe(1);
  });

  it('is 0 when no round was correct', () => {
    const normalized = normalizeFlexibilityResult(
      rawResult({ roundsPlayed: 10, correctPicks: 0, postSwitchPlayed: 3, postSwitchCorrect: 0 }),
      { gameId: 'flexibility-card-sort', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(0);
  });

  it('blends speed and switch accuracy at 20% each on top of accuracy', () => {
    // accuracy 1, speed 0, switch 0 → 1 * (0.6 + 0 + 0) = 0.6
    const slow = normalizeFlexibilityResult(
      rawResult({
        roundsPlayed: 10,
        correctPicks: 10,
        totalResponseMs: 50_000,
        scoredPicks: 10,
        postSwitchPlayed: 3,
        postSwitchCorrect: 0,
        accuracy: 1,
      }),
      { gameId: 'flexibility-card-sort', difficulty: 'normal', durationMs: 0 },
    );
    expect(slow.value).toBe(0.6);

    // accuracy 0.8, perfect speed and switch → 0.8
    const accurate = normalizeFlexibilityResult(
      rawResult({
        roundsPlayed: 10,
        correctPicks: 8,
        totalResponseMs: 0,
        scoredPicks: 10,
        postSwitchPlayed: 3,
        postSwitchCorrect: 3,
        accuracy: 0.8,
      }),
      { gameId: 'flexibility-card-sort', difficulty: 'normal', durationMs: 0 },
    );
    expect(accurate.value).toBeCloseTo(0.8);
  });

  it('rewards fast correct play even with a mediocre switch record', () => {
    // accuracy 1, speed 1, switch 0.5 → 1 * (0.6 + 0.2 + 0.1) = 0.9
    const normalized = normalizeFlexibilityResult(
      rawResult({
        roundsPlayed: 10,
        correctPicks: 10,
        totalResponseMs: 0,
        scoredPicks: 10,
        postSwitchPlayed: 4,
        postSwitchCorrect: 2,
        accuracy: 1,
      }),
      { gameId: 'flexibility-card-sort', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBeCloseTo(0.9);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const raw = rawResult({ roundsPlayed: 1, correctPicks: 1, postSwitchPlayed: 1, postSwitchCorrect: 1 });
    const normalized = normalizeFlexibilityResult(raw, {
      gameId: 'flexibility-card-sort',
      difficulty: 'normal',
      durationMs: 0,
    });
    expect(normalized.raw).toEqual(expect.objectContaining({ seed: 's', difficulty: 'normal' }));
  });
});
