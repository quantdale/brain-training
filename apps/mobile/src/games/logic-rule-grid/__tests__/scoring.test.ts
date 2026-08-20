// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  accuracyOf,
  clamp01,
  efficiency,
  normalizeRuleGridResult,
  perfectSessionScore,
  roundScore,
} from '../scoring';
import type { RuleGridRawResult } from '../types';
import { RULE_GRID_DIFFICULTY_PARAMS } from '../difficulty';

describe('roundScore', () => {
  it('awards base points plus a size bonus for correct answers', () => {
    expect(roundScore(true, 4)).toBe(140);
    expect(roundScore(true, 6)).toBe(160);
  });

  it('awards 0 for wrong or timed-out rounds', () => {
    expect(roundScore(false, 4)).toBe(0);
    expect(roundScore(false, 6)).toBe(0);
  });
});

describe('perfectSessionScore', () => {
  it('calculates the maximum possible score', () => {
    expect(perfectSessionScore(RULE_GRID_DIFFICULTY_PARAMS.easy)).toBe(6 * (100 + 3 * 10));
    expect(perfectSessionScore(RULE_GRID_DIFFICULTY_PARAMS.normal)).toBe(7 * (100 + 4 * 10));
    expect(perfectSessionScore(RULE_GRID_DIFFICULTY_PARAMS.expert)).toBe(9 * (100 + 6 * 10));
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
    expect(efficiency(0, 10_000)).toBe(1);
  });

  it('returns 0 when all budget used', () => {
    expect(efficiency(10_000, 10_000)).toBe(0);
  });

  it('returns 0 when budget is 0', () => {
    expect(efficiency(5_000, 0)).toBe(0);
  });

  it('calculates partial efficiency', () => {
    expect(efficiency(5_000, 10_000)).toBeCloseTo(0.5);
  });
});

describe('normalizeRuleGridResult', () => {
  function buildRaw(overrides: Partial<RuleGridRawResult> = {}): RuleGridRawResult {
    return {
      score: 400,
      totalRounds: 7,
      roundsPlayed: 4,
      roundsCorrect: 3,
      accuracy: 0.75,
      bestStreak: 2,
      bestRoundTimeMs: 1200,
      totalElapsedMs: 0,
      totalBudgetMs: 1,
      size: 4,
      roundTimeMs: 20_000,
      challengeRating: 0.5,
      difficulty: 'normal',
      seed: '42',
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: '1.0.0',
      forced: false,
      generatorInfo: {},
      diagnosticMetadata: {
        gameId: 'logic-rule-grid',
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
    const result = normalizeRuleGridResult(raw, {
      gameId: 'logic-rule-grid',
      difficulty: 'normal',
      durationMs: 45000,
    });
    expect(result.scale).toBe('0..1');
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(1);
  });

  it('returns 0 for a session with no correct answers', () => {
    const raw = buildRaw({ roundsCorrect: 0, roundsPlayed: 4 });
    const result = normalizeRuleGridResult(raw, {
      gameId: 'logic-rule-grid',
      difficulty: 'normal',
      durationMs: 45000,
    });
    expect(result.value).toBe(0);
  });

  it('returns 1 for a perfect session answered instantly', () => {
    const raw = buildRaw({
      roundsCorrect: 4,
      roundsPlayed: 4,
      totalElapsedMs: 0,
      totalBudgetMs: 80_000,
    });
    const result = normalizeRuleGridResult(raw, {
      gameId: 'logic-rule-grid',
      difficulty: 'normal',
      durationMs: 45000,
    });
    // accuracy=1, efficiency=1-(0/80000)=1, value=1*(0.5+0.5*1)=1
    expect(result.value).toBeCloseTo(1);
  });
});
