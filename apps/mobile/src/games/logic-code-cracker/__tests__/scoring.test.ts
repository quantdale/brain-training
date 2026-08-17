// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  accuracyOf,
  clamp01,
  efficiency,
  normalizeCodeCrackerResult,
  perfectSessionScore,
  roundScore,
} from '../scoring';
import type { CodeCrackerRawResult } from '../types';
import { CODE_CRACKER_DIFFICULTY_PARAMS } from '../difficulty';

describe('roundScore', () => {
  it('awards base points plus bonus for fewer guesses', () => {
    expect(roundScore(10, 10)).toBe(100);
    expect(roundScore(10, 1)).toBe(190);
    expect(roundScore(10, 5)).toBe(150);
  });

  it('never goes below 100 even with more guesses than budget', () => {
    expect(roundScore(10, 15)).toBe(100);
  });
});

describe('perfectSessionScore', () => {
  it('calculates the maximum possible score', () => {
    expect(perfectSessionScore(CODE_CRACKER_DIFFICULTY_PARAMS.easy)).toBe(3 * (100 + 9 * 10));
    expect(perfectSessionScore(CODE_CRACKER_DIFFICULTY_PARAMS.normal)).toBe(4 * (100 + 9 * 10));
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
  it('returns 1 when no guesses used', () => {
    expect(efficiency(0, 10)).toBe(1);
  });

  it('returns 0 when all budget used', () => {
    expect(efficiency(10, 10)).toBe(0);
  });

  it('returns 0 when budget is 0', () => {
    expect(efficiency(5, 0)).toBe(0);
  });

  it('calculates partial efficiency', () => {
    expect(efficiency(5, 10)).toBeCloseTo(0.5);
  });
});

describe('normalizeCodeCrackerResult', () => {
  function buildRaw(overrides: Partial<CodeCrackerRawResult> = {}): CodeCrackerRawResult {
    return {
      score: 400,
      totalRounds: 4,
      roundsPlayed: 4,
      roundsSolved: 3,
      accuracy: 0.75,
      totalGuessesUsed: 20,
      totalGuessesBudget: 40,
      bestStreak: 2,
      bestSolveGuesses: 2,
      codeLength: 4,
      colorCount: 6,
      guessBudget: 10,
      challengeRating: 0.5,
      difficulty: 'normal',
      seed: '42',
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: '1.0.0',
      forced: false,
      guessHistory: [],
      generatorInfo: {},
      diagnosticMetadata: {
        gameId: 'logic-code-cracker',
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
    const result = normalizeCodeCrackerResult(raw, {
      gameId: 'logic-code-cracker',
      difficulty: 'normal',
      durationMs: 45000,
    });
    expect(result.scale).toBe('0..1');
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(1);
  });

  it('returns 0 for a session with no solves', () => {
    const raw = buildRaw({ roundsSolved: 0, roundsPlayed: 4 });
    const result = normalizeCodeCrackerResult(raw, {
      gameId: 'logic-code-cracker',
      difficulty: 'normal',
      durationMs: 45000,
    });
    expect(result.value).toBe(0);
  });

  it('returns near-1 for a perfect session with optimal guess usage', () => {
    const raw = buildRaw({
      roundsSolved: 4,
      roundsPlayed: 4,
      totalGuessesUsed: 4, // 1 guess per round
      totalGuessesBudget: 40,
    });
    const result = normalizeCodeCrackerResult(raw, {
      gameId: 'logic-code-cracker',
      difficulty: 'normal',
      durationMs: 45000,
    });
    // accuracy=1, efficiency=1-(4/40)=0.9, value=1*(0.5+0.5*0.9)=0.95
    expect(result.value).toBeCloseTo(0.95);
  });
});
