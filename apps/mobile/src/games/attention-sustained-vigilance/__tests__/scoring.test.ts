// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import { VIGILANCE_DIFFICULTY_PARAMS } from '../difficulty';
import {
  applyScoreDelta,
  hitScore,
  normalizeVigilanceResult,
  perfectSessionScore,
  speedFactorOf,
} from '../scoring';
import { INITIAL_STATS } from '../types';
import type { VigilanceRawResult } from '../types';

const params = VIGILANCE_DIFFICULTY_PARAMS.normal; // rtTarget 400 / rtFail 1000

/** Synthetic raw result with the given outcome mix. */
function rawWith(
  overrides: Partial<Pick<
    VigilanceRawResult,
    'hits' | 'omissions' | 'correctHolds' | 'commissions' | 'meanSpeed'
  >>,
): VigilanceRawResult {
  const hits = overrides.hits ?? 0;
  return {
    score: 0,
    trialsTotal: params.trials,
    trialsPlayed: params.trials,
    hits,
    commissions: overrides.commissions ?? 0,
    omissions: overrides.omissions ?? 0,
    correctHolds: overrides.correctHolds ?? 0,
    bestStreak: 0,
    meanReactionMs: null,
    bestReactionMs: null,
    reactions: [],
    goAccuracy: 0,
    holdAccuracy: 0,
    accuracy: 0,
    // Callers pass meanSpeed directly so normalization is exercised in
    // isolation from the stats aggregation.
    meanSpeed: overrides.meanSpeed ?? 0,
    finalResponseWindowMs: params.responseWindowMs,
    stopDigit: 3,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 'test',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {
      gameId: 'attention-sustained-vigilance',
      sdkVersion: '0.1.0',
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      seed: 'test',
      difficulty: 'normal',
      startedAtMs: 0,
      activeDurationMs: 0,
      pausedDurationMs: 0,
    },
  };
}

describe('speedFactorOf', () => {
  it('anchors at rtTargetMs (1), rtFailMs (0), and the midpoint (0.5)', () => {
    expect(speedFactorOf(400, params)).toBe(1);
    expect(speedFactorOf(1000, params)).toBe(0);
    expect(speedFactorOf(700, params)).toBeCloseTo(0.5, 10);
    expect(speedFactorOf(200, params)).toBe(1); // clamped above the target
  });
});

describe('normalizeVigilanceResult', () => {
  it('reaches exactly 1.0 for a perfect session and 0 for a fully failed one', () => {
    const context = {
      gameId: 'attention-sustained-vigilance' as const,
      difficulty: 'normal' as const,
      durationMs: 30_000,
    };
    const perfect = normalizeVigilanceResult(
      rawWith({ hits: 26, omissions: 0, correctHolds: 4, commissions: 0, meanSpeed: 1 }),
      context,
    );
    expect(perfect.value).toBe(1);

    const failed = normalizeVigilanceResult(
      rawWith({ hits: 0, omissions: 26, correctHolds: 0, commissions: 4 }),
      context,
    );
    expect(failed.value).toBe(0);
  });

  it('rewards a clean mixed session more than an error-prone one', () => {
    const context = {
      gameId: 'attention-sustained-vigilance' as const,
      difficulty: 'normal' as const,
      durationMs: 30_000,
    };
    const clean = normalizeVigilanceResult(
      rawWith({ hits: 24, omissions: 2, correctHolds: 4, commissions: 0, meanSpeed: 0.8 }),
      context,
    );
    const sloppy = normalizeVigilanceResult(
      rawWith({ hits: 20, omissions: 6, correctHolds: 2, commissions: 2, meanSpeed: 0.5 }),
      context,
    );
    expect(clean.value).toBeGreaterThan(sloppy.value);
  });
});

describe('score primitives', () => {
  it('floors the running score at zero and anchors the perfect-session score', () => {
    expect(applyScoreDelta(50, -80)).toBe(0);
    expect(applyScoreDelta(50, 120)).toBe(170);
    expect(hitScore(params.rtTargetMs, params)).toBe(150);
    expect(hitScore(params.rtFailMs, params)).toBe(100);
    expect(perfectSessionScore(params, 4)).toBe(26 * 150 + 4 * 120);
    expect(INITIAL_STATS.score).toBe(0);
  });
});
