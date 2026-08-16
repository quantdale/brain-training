// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  bestOf,
  clamp01,
  completionOf,
  falseStartScore,
  meanOf,
  medianOf,
  normalizeSpeedResult,
  perfectSessionScore,
  reactionScore,
  roundScore,
} from '../scoring';
import { SPEED_DIFFICULTY_PARAMS } from '../difficulty';
import type { SpeedRawResult } from '../types';

function rawResult(overrides: Partial<SpeedRawResult>): SpeedRawResult {
  return {
    totalRounds: 10,
    roundsPlayed: 0,
    roundsPassed: 0,
    falseStarts: 0,
    timeouts: 0,
    falseStartAborted: false,
    bestReactionMs: null,
    medianReactionMs: null,
    meanReactionMs: null,
    reactions: [],
    minDelayMs: 1000,
    maxDelayMs: 3000,
    falseStartBudget: 1,
    targetMs: 400,
    passMs: 600,
    failMs: 800,
    timeoutMs: 2200,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {
      gameId: 'speed-reaction-time',
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
  it('awards 150 for elite reactions, 100 for passed rounds, 0 otherwise', () => {
    expect(roundScore(400, 400, 600)).toBe(150);
    expect(roundScore(300, 400, 600)).toBe(150);
    expect(roundScore(450, 400, 600)).toBe(100);
    expect(roundScore(600, 400, 600)).toBe(100);
    expect(roundScore(601, 400, 600)).toBe(0);
    expect(roundScore(2000, 400, 600)).toBe(0);
  });
});

describe('perfectSessionScore', () => {
  it('is 150 per round for a perfect run', () => {
    expect(perfectSessionScore(SPEED_DIFFICULTY_PARAMS.normal)).toBe(1500);
    expect(perfectSessionScore(SPEED_DIFFICULTY_PARAMS.easy)).toBe(1200);
  });
});

describe('medianOf / meanOf / bestOf', () => {
  it('computes the median (odd/even) and guards empty input', () => {
    expect(medianOf([400, 500, 600])).toBe(500);
    expect(medianOf([400, 500])).toBe(450);
    expect(medianOf([])).toBeNull();
  });

  it('computes the mean and guards empty input', () => {
    expect(meanOf([400, 500, 600])).toBe(500);
    expect(meanOf([400, 450, 500, 550])).toBe(475);
    expect(meanOf([])).toBeNull();
  });

  it('finds the fastest reaction and guards empty input', () => {
    expect(bestOf([500, 400, 600])).toBe(400);
    expect(bestOf([])).toBeNull();
  });
});

describe('completionOf', () => {
  it('is the share of rounds completed with a valid reaction', () => {
    expect(completionOf(5, 10)).toBe(0.5);
    expect(completionOf(0, 10)).toBe(0);
    expect(completionOf(10, 10)).toBe(1);
  });

  it('guards division by zero', () => {
    expect(completionOf(3, 0)).toBe(0);
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

describe('reactionScore', () => {
  it('is 1 at or faster than the target, 0 at or slower than the fail point', () => {
    expect(reactionScore(400, 400, 800)).toBe(1);
    expect(reactionScore(300, 400, 800)).toBe(1);
    expect(reactionScore(800, 400, 800)).toBe(0);
    expect(reactionScore(900, 400, 800)).toBe(0);
  });

  it('scales linearly between target and fail', () => {
    expect(reactionScore(600, 400, 800)).toBe(0.5);
    expect(reactionScore(500, 400, 800)).toBe(0.75);
  });

  it('scores 0 with no valid reaction', () => {
    expect(reactionScore(null, 400, 800)).toBe(0);
  });

  it('handles a degenerate span (target === fail)', () => {
    expect(reactionScore(400, 400, 400)).toBe(1);
    expect(reactionScore(401, 400, 400)).toBe(0);
  });
});

describe('falseStartScore', () => {
  it('is 1 with no false starts and 0 at budget + 1', () => {
    expect(falseStartScore(0, 1)).toBe(1);
    expect(falseStartScore(1, 1)).toBe(0.5);
    expect(falseStartScore(2, 1)).toBe(0);
    expect(falseStartScore(0, 2)).toBe(1);
    expect(falseStartScore(3, 2)).toBe(0);
  });
});

describe('normalizeSpeedResult (documented formula)', () => {
  it('scores a perfect run at exactly 1', () => {
    const normalized = normalizeSpeedResult(
      rawResult({
        reactions: [400, 400, 400, 400, 400, 400, 400, 400, 400, 400],
        roundsPlayed: 10,
        roundsPassed: 10,
        bestReactionMs: 400,
        medianReactionMs: 400,
        meanReactionMs: 400,
      }),
      { gameId: 'speed-reaction-time', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.scale).toBe('0..1');
    expect(normalized.value).toBe(1);
  });

  it('is 0 when no round was completed with a valid reaction', () => {
    const normalized = normalizeSpeedResult(
      rawResult({ roundsPlayed: 10, falseStarts: 2, falseStartAborted: true }),
      { gameId: 'speed-reaction-time', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(0);
  });

  it('blends completion with reaction speed', () => {
    // 8/10 valid (0.8), median 600 → reaction 0.5, no false starts:
    // 0.8 * (0.5 + 0.25) = 0.6
    const normalized = normalizeSpeedResult(
      rawResult({
        reactions: [600, 600, 600, 600, 600, 600, 600, 600],
        roundsPlayed: 10,
        roundsPassed: 8,
        bestReactionMs: 600,
        medianReactionMs: 600,
        meanReactionMs: 600,
      }),
      { gameId: 'speed-reaction-time', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBeCloseTo(0.6);
  });

  it('penalizes each false start within the budget', () => {
    // Perfect reactions but one false start (budget 1): 1 * 1 * 0.5 = 0.5
    const normalized = normalizeSpeedResult(
      rawResult({
        reactions: [400, 400, 400, 400, 400, 400, 400, 400, 400, 400],
        roundsPlayed: 11,
        roundsPassed: 10,
        falseStarts: 1,
        bestReactionMs: 400,
        medianReactionMs: 400,
        meanReactionMs: 400,
      }),
      { gameId: 'speed-reaction-time', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(0.5);
  });

  it('never exceeds 1 even with an impossible fast median', () => {
    const normalized = normalizeSpeedResult(
      rawResult({
        reactions: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
        roundsPlayed: 10,
        roundsPassed: 10,
        bestReactionMs: 100,
        medianReactionMs: 100,
        meanReactionMs: 100,
      }),
      { gameId: 'speed-reaction-time', difficulty: 'normal', durationMs: 0 },
    );
    expect(normalized.value).toBe(1);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const raw = rawResult({ medianReactionMs: 550, reactions: [550] });
    const normalized = normalizeSpeedResult(raw, {
      gameId: 'speed-reaction-time',
      difficulty: 'normal',
      durationMs: 0,
    });
    expect(normalized.raw).toEqual(expect.objectContaining({ seed: 's', difficulty: 'normal' }));
  });
});
