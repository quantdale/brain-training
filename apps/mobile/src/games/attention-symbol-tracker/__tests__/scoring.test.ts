// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  accuracyOf,
  clamp01,
  normalizeSymbolTrackerResult,
  perfectSessionScore,
  recallProgress,
  referenceMaxRecall,
  roundScore,
  symbolTrackerPerformanceNormalizer,
} from '../scoring';
import { ADAPTIVE_PARAMS, SYMBOL_TRACKER_DIFFICULTY_PARAMS } from '../difficulty';
import type { SymbolTrackerRawResult } from '../types';

function raw(overrides: Partial<SymbolTrackerRawResult> = {}): SymbolTrackerRawResult {
  return {
    score: 0,
    totalRounds: 5,
    roundsPlayed: 5,
    roundsPassed: 5,
    accuracy: 1,
    bestRecall: 6,
    bestStreak: 5,
    initialTrackCount: 2,
    tokenCount: 6,
    gridSize: 9,
    observeMs: 2200,
    respondDeadlineMs: 7000,
    distractors: 0,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {} as SymbolTrackerRawResult['diagnosticMetadata'],
    ...overrides,
  };
}

describe('roundScore', () => {
  it('rewards larger track counts with an escalation bonus', () => {
    expect(roundScore(2, 2)).toBe(100);
    expect(roundScore(6, 2)).toBe(100 + 15 * 4);
  });
});

describe('perfectSessionScore', () => {
  it('sums the escalated per-round scores', () => {
    // normal: counts 2,3,4,5,6 -> 100,115,130,145,160 = 650
    expect(perfectSessionScore(SYMBOL_TRACKER_DIFFICULTY_PARAMS.normal)).toBe(650);
    // easy: counts 1,2,3,4 -> 100,115,130,145 = 490
    expect(perfectSessionScore(SYMBOL_TRACKER_DIFFICULTY_PARAMS.easy)).toBe(
      100 + 115 + 130 + 145,
    );
  });

  it('caps escalation at the adaptive max track count', () => {
    // adaptive: counts min(2+r, 4) -> 2,3,4,4,4,4 = 735
    expect(perfectSessionScore(ADAPTIVE_PARAMS)).toBe(735);
  });
});

describe('referenceMaxRecall', () => {
  it('caps escalation at the token count', () => {
    expect(referenceMaxRecall(SYMBOL_TRACKER_DIFFICULTY_PARAMS.normal)).toBe(6);
    expect(referenceMaxRecall(SYMBOL_TRACKER_DIFFICULTY_PARAMS.easy)).toBe(4);
    expect(referenceMaxRecall(SYMBOL_TRACKER_DIFFICULTY_PARAMS.expert)).toBe(9); // 3 + (7-1) = 9
  });

  it('caps escalation at the adaptive max track count', () => {
    expect(referenceMaxRecall(ADAPTIVE_PARAMS)).toBe(4);
  });
});

describe('accuracyOf', () => {
  it('is 0 with no rounds and divides correctly otherwise', () => {
    expect(accuracyOf(0, 0)).toBe(0);
    expect(accuracyOf(3, 5)).toBeCloseTo(0.6);
  });
});

describe('clamp01', () => {
  it('clamps into [0, 1]', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.4)).toBe(0.4);
  });
  it('rejects non-finite input', () => {
    expect(() => clamp01(NaN)).toThrow();
  });
});

describe('recallProgress', () => {
  it('is 0 at the start and 1 when reaching the reference max', () => {
    expect(recallProgress(3, 6)).toBeCloseTo(0.5);
    expect(recallProgress(6, 6)).toBe(1);
    expect(recallProgress(0, 0)).toBe(1); // degenerate: bestRecall >= refMax
  });
});

describe('normalizeSymbolTrackerResult', () => {
  it('rewards both accuracy and escalation', () => {
    const perfect = normalizeSymbolTrackerResult(
      raw({ roundsPassed: 5, roundsPlayed: 5, bestRecall: 6 }),
      { gameId: 'attention-symbol-tracker', difficulty: 'normal', durationMs: 1000 },
    );
    expect(perfect.value).toBeCloseTo(1);
    expect(perfect.scale).toBe('0..1');
  });

  it('is 0 when no round passed', () => {
    const zero = normalizeSymbolTrackerResult(
      raw({ roundsPlayed: 5, roundsPassed: 0, bestRecall: 0 }),
      { gameId: 'attention-symbol-tracker', difficulty: 'normal', durationMs: 1000 },
    );
    expect(zero.value).toBe(0);
  });

  it('never exceeds 1 even with a huge best recall', () => {
    const capped = normalizeSymbolTrackerResult(
      raw({ roundsPassed: 5, roundsPlayed: 5, bestRecall: 100 }),
      { gameId: 'attention-symbol-tracker', difficulty: 'normal', durationMs: 1000 },
    );
    expect(capped.value).toBeLessThanOrEqual(1);
  });

  it('stays within [0, 1] for partial sessions', () => {
    const partial = normalizeSymbolTrackerResult(
      raw({ roundsPlayed: 4, roundsPassed: 2, bestRecall: 3 }),
      { gameId: 'attention-symbol-tracker', difficulty: 'normal', durationMs: 1000 },
    );
    expect(partial.value).toBeGreaterThan(0);
    expect(partial.value).toBeLessThan(1);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const r = normalizeSymbolTrackerResult(raw({ seed: 'diag' }), {
      gameId: 'attention-symbol-tracker',
      difficulty: 'normal',
      durationMs: 1000,
    });
    expect((r.raw as SymbolTrackerRawResult).seed).toBe('diag');
  });
});

describe('symbolTrackerPerformanceNormalizer', () => {
  it('is bound to the game id and delegates to normalize', () => {
    expect(symbolTrackerPerformanceNormalizer.gameId).toBe('attention-symbol-tracker');
    expect(symbolTrackerPerformanceNormalizer.normalize(raw(), {
      gameId: 'attention-symbol-tracker',
      difficulty: 'normal',
      durationMs: 1000,
    }).value).toBeCloseTo(1);
  });
});
