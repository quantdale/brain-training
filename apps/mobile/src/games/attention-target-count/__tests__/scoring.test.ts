// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  accuracyOf,
  clamp01,
  efficiency,
  normalizeTargetCountResult,
  perfectSessionScore,
  roundScore,
} from '../scoring';
import type { TargetCountRawResult } from '../types';
import { TARGET_COUNT_DIFFICULTY_PARAMS } from '../difficulty';

describe('roundScore', () => {
  it('awards base 100 for a correct instant answer', () => {
    expect(roundScore(true, 9000, 0)).toBe(200);
  });

  it('awards base 100 plus speed bonus for a correct slower answer', () => {
    // roundTimeMs 9000, elapsed 4500 -> bonus = round((9000-4500)/9000*100) = 50
    expect(roundScore(true, 9000, 4500)).toBe(150);
  });

  it('never goes below 100 even when over budget', () => {
    expect(roundScore(true, 9000, 12000)).toBe(100);
  });

  it('returns 0 for a wrong/timeout answer', () => {
    expect(roundScore(false, 9000, 1234)).toBe(0);
  });
});

describe('perfectSessionScore', () => {
  it('calculates the maximum possible score (200 per round)', () => {
    expect(perfectSessionScore(TARGET_COUNT_DIFFICULTY_PARAMS.easy)).toBe(6 * 200);
    expect(perfectSessionScore(TARGET_COUNT_DIFFICULTY_PARAMS.normal)).toBe(8 * 200);
  });
});

describe('accuracyOf', () => {
  it('returns 0 when nothing was played', () => {
    expect(accuracyOf(0, 0)).toBe(0);
  });

  it('calculates accuracy correctly', () => {
    expect(accuracyOf(3, 4)).toBeCloseTo(0.75);
    expect(accuracyOf(4, 4)).toBe(1);
    expect(accuracyOf(0, 4)).toBe(0);
  });
});

describe('clamp01', () => {
  it('clamps to [0, 1]', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1.5)).toBe(1);
  });

  it('throws on non-finite input', () => {
    expect(() => clamp01(NaN)).toThrow('finite');
    expect(() => clamp01(Infinity)).toThrow('finite');
  });
});

describe('efficiency', () => {
  it('returns 1 when no time used', () => {
    expect(efficiency(0, 8000)).toBe(1);
  });

  it('returns 0 when full budget used', () => {
    expect(efficiency(8000, 8000)).toBe(0);
  });

  it('returns 0 when budget is 0', () => {
    expect(efficiency(5000, 0)).toBe(0);
  });

  it('calculates partial efficiency', () => {
    expect(efficiency(4000, 8000)).toBeCloseTo(0.5);
  });
});

describe('normalizeTargetCountResult', () => {
  function buildRaw(overrides: Partial<TargetCountRawResult> = {}): TargetCountRawResult {
    return {
      score: 400,
      totalRounds: 8,
      roundsPlayed: 8,
      roundsCorrect: 6,
      accuracy: 0.75,
      bestStreak: 4,
      bestRoundTimeMs: 3000,
      totalElapsedMs: 40000,
      totalBudgetMs: 72000,
      challengeRating: 0.5,
      difficulty: 'normal',
      seed: '42',
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: '1.0.0',
      forced: false,
      generatorInfo: {},
      diagnosticMetadata: {
        gameId: 'attention-target-count',
        sdkVersion: '0.1.0',
        gameVersion: '1.0.0',
        generatorVersion: '1.0.0',
        seed: '42',
        difficulty: 'normal',
        startedAtMs: 1000,
        activeDurationMs: 45000,
        pausedDurationMs: 5000,
      },
      ...overrides,
    };
  }

  it('normalizes a mixed session result', () => {
    const raw = buildRaw();
    const result = normalizeTargetCountResult(raw, {
      gameId: 'attention-target-count',
      difficulty: 'normal',
      durationMs: 45000,
    });
    expect(result.scale).toBe('0..1');
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(1);
  });

  it('returns 0 for a session with no correct rounds', () => {
    const raw = buildRaw({ roundsCorrect: 0, roundsPlayed: 8 });
    const result = normalizeTargetCountResult(raw, {
      gameId: 'attention-target-count',
      difficulty: 'normal',
      durationMs: 45000,
    });
    expect(result.value).toBe(0);
  });

  it('returns 1 for a perfect session with instant answers', () => {
    const raw = buildRaw({
      roundsCorrect: 8,
      roundsPlayed: 8,
      totalElapsedMs: 0,
      totalBudgetMs: 72000,
    });
    const result = normalizeTargetCountResult(raw, {
      gameId: 'attention-target-count',
      difficulty: 'normal',
      durationMs: 45000,
    });
    // accuracy=1, efficiency=1, value=1*(0.5+0.5*1)=1
    expect(result.value).toBeCloseTo(1);
  });
});
