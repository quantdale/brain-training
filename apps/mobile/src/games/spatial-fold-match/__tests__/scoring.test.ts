// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import { DIFFICULTY_PARAMS } from '../difficulty';
import {
  ANSWER_SPEED_WINDOW_MS,
  CORRECT_POINTS,
  MAX_ROUND_SCORE,
  SPEED_BONUS,
  accuracyOf,
  answerSpeedTargetMs,
  clamp01,
  normalizeSpatialFoldMatchResult,
  perfectSessionScore,
  roundScore,
  spatialFoldMatchPerformanceNormalizer,
  speedScoreOf,
} from '../scoring';
import { GAME_ID } from '../types';
import type { SpatialFoldMatchRawResult } from '../types';

function raw(overrides: Partial<SpatialFoldMatchRawResult> = {}): SpatialFoldMatchRawResult {
  return {
    score: 0,
    totalRounds: 6,
    roundsPlayed: 6,
    roundsPassed: 6,
    accuracy: 1,
    averageAnswerMs: 0,
    bestStreak: 6,
    gridRows: 3,
    gridCols: 4,
    filledCells: 4,
    sourceRevealMs: 1300,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {} as SpatialFoldMatchRawResult['diagnosticMetadata'],
    ...overrides,
  };
}

const CONTEXT = { gameId: GAME_ID, difficulty: 'normal' as const, durationMs: 1000 };

describe('roundScore', () => {
  it('awards nothing for a wrong answer', () => {
    expect(roundScore(false, 0, 1300)).toBe(0);
    expect(roundScore(false, 10_000, 1300)).toBe(0);
  });

  it('pays base + full speed bonus for an instant correct answer', () => {
    expect(roundScore(true, 0, 1300)).toBe(MAX_ROUND_SCORE);
    expect(MAX_ROUND_SCORE).toBe(CORRECT_POINTS + SPEED_BONUS);
    expect(MAX_ROUND_SCORE).toBe(150);
  });

  it('decays the speed bonus linearly and floors at the base points', () => {
    expect(roundScore(true, 650, 1300)).toBe(CORRECT_POINTS + SPEED_BONUS / 2); // half window
    expect(roundScore(true, 1300, 1300)).toBe(CORRECT_POINTS); // at target
    expect(roundScore(true, 130_000, 1300)).toBe(CORRECT_POINTS); // clamped, never below base
  });
});

describe('answerSpeedTargetMs', () => {
  it('adds the shared 10s answer window to the reveal time', () => {
    expect(answerSpeedTargetMs(1300)).toBe(11_300);
    expect(answerSpeedTargetMs(0)).toBe(ANSWER_SPEED_WINDOW_MS);
  });

  it('rewards normal-fast play on the same basis normalization uses', () => {
    // Campaign 014 regression pin: raw scoring previously targeted
    // sourceRevealMs (~1-1.5s) while normalization targeted revealMs + 10s, so
    // realistic answers earned no bonus on screen. The bases must stay shared.
    const reveal = DIFFICULTY_PARAMS.normal.sourceRevealMs;
    const fastAnswer = 2500; // normal-fast human answer, slower than the old basis
    expect(reveal).toBeLessThan(fastAnswer);
    expect(roundScore(true, fastAnswer, answerSpeedTargetMs(reveal))).toBeGreaterThan(
      CORRECT_POINTS,
    );
    // Identical denominators ⇒ identical speed credit in raw and normalized space.
    expect(speedScoreOf(fastAnswer, answerSpeedTargetMs(reveal))).toBe(
      speedScoreOf(fastAnswer, reveal + 10_000),
    );
  });
});

describe('perfectSessionScore', () => {
  it('sums max-round scores across the level’s rounds', () => {
    expect(perfectSessionScore(DIFFICULTY_PARAMS.normal)).toBe(6 * MAX_ROUND_SCORE);
    expect(perfectSessionScore(DIFFICULTY_PARAMS.easy)).toBe(5 * MAX_ROUND_SCORE);
    expect(perfectSessionScore(DIFFICULTY_PARAMS.expert)).toBe(7 * MAX_ROUND_SCORE);
  });
});

describe('accuracyOf', () => {
  it('is 0 with no rounds and divides correctly otherwise', () => {
    expect(accuracyOf(0, 0)).toBe(0);
    expect(accuracyOf(3, 5)).toBeCloseTo(0.6);
    expect(accuracyOf(6, 6)).toBe(1);
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
    expect(() => clamp01(Infinity)).toThrow();
  });
});

describe('speedScoreOf', () => {
  it('is 1 when instant and 0 at/beyond the speed target', () => {
    expect(speedScoreOf(0, 1000)).toBe(1);
    expect(speedScoreOf(1000, 1000)).toBe(0);
    expect(speedScoreOf(5000, 1000)).toBe(0); // clamped
    expect(speedScoreOf(250, 1000)).toBeCloseTo(0.75);
  });
});

describe('normalizeSpatialFoldMatchResult', () => {
  it('returns 1 for a perfect, fast session', () => {
    const perfect = normalizeSpatialFoldMatchResult(raw(), CONTEXT);
    expect(perfect.value).toBe(1);
    expect(perfect.scale).toBe('0..1');
  });

  it('is 0 when no round passed', () => {
    const zero = normalizeSpatialFoldMatchResult(
      raw({ roundsPlayed: 6, roundsPassed: 0, accuracy: 0 }),
      CONTEXT,
    );
    expect(zero.value).toBe(0);
  });

  it('weights accuracy 70% even with very slow answers', () => {
    const slow = normalizeSpatialFoldMatchResult(
      raw({ averageAnswerMs: 50_000 }), // speed score clamps to 0
      CONTEXT,
    );
    expect(slow.value).toBeCloseTo(0.7);
  });

  it('never leaves the [0, 1] range', () => {
    const extremes = normalizeSpatialFoldMatchResult(
      raw({ averageAnswerMs: -1000 }), // hostile input
      CONTEXT,
    );
    expect(extremes.value).toBeGreaterThanOrEqual(0);
    expect(extremes.value).toBeLessThanOrEqual(1);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const r = normalizeSpatialFoldMatchResult(raw({ seed: 'diag' }), CONTEXT);
    expect((r.raw as SpatialFoldMatchRawResult).seed).toBe('diag');
  });

  it('exposes an SDK-conformant normalizer instance', () => {
    expect(spatialFoldMatchPerformanceNormalizer.gameId).toBe(GAME_ID);
    expect(
      spatialFoldMatchPerformanceNormalizer.normalize(raw(), CONTEXT).scale,
    ).toBe('0..1');
  });
});
