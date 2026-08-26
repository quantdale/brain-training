// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  SWITCH_CORRECT_BONUS,
  UNCUED_FIRST_PICK_BONUS,
  accuracyOf,
  clamp01,
  flexibilityRuleFlipPerformanceNormalizer,
  normalizeFlexibilityRuleFlipResult,
  perfectPlanScore,
  perfectSessionScore,
  roundScore,
  speedScoreOf,
  switchAccuracyOf,
  trialRawScore,
  uncuedAccuracyOf,
} from '../scoring';
import { FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS } from '../difficulty';
import { GAME_ID } from '../types';
import type { FlexibilityRuleFlipRawResult } from '../types';

function raw(overrides: Partial<FlexibilityRuleFlipRawResult> = {}): FlexibilityRuleFlipRawResult {
  return {
    score: 0,
    totalRounds: 10,
    roundsPlayed: 10,
    correctPicks: 10,
    mistakes: 0,
    accuracy: 1,
    bestStreak: 10,
    totalResponseMs: 0,
    scoredPicks: 10,
    speedScore: 1,
    switchPlayed: 2,
    switchCorrect: 2,
    switchAccuracy: 1,
    repeatPlayed: 8,
    repeatCorrect: 8,
    repeatAccuracy: 1,
    uncuedPlayed: 0,
    uncuedCorrect: 0,
    uncuedAccuracy: 0,
    numShapes: 3,
    numColors: 3,
    numNumbers: 4,
    flipRate: 0.55,
    switchRate: 0.55,
    uncuedRate: 0.35,
    speedTargetMs: 5000,
    challengeRating: 0.5,
    difficulty: 'normal',
    seed: 's',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {} as FlexibilityRuleFlipRawResult['diagnosticMetadata'],
    ...overrides,
  };
}

describe('roundScore', () => {
  it('rewards a wrong pick with nothing', () => {
    expect(roundScore(false, 0, 5000)).toBe(0);
  });
  it('pays the 100 base plus a linear speed bonus clamped into [0, 50]', () => {
    expect(roundScore(true, 0, 5000)).toBe(150); // instant → full bonus
    expect(roundScore(true, 2500, 5000)).toBe(125); // halfway
    expect(roundScore(true, 5000, 5000)).toBe(100); // at target → no bonus
    expect(roundScore(true, 9000, 5000)).toBe(100); // slower → clamped, never negative
  });
});

describe('trialRawScore', () => {
  it('adds the switch-correct bonus only on switch trials', () => {
    expect(trialRawScore(true, 0, 5000, false)).toBe(150);
    expect(trialRawScore(true, 0, 5000, true)).toBe(150 + SWITCH_CORRECT_BONUS);
    expect(trialRawScore(false, 0, 5000, true)).toBe(0);
    expect(SWITCH_CORRECT_BONUS).toBe(20);
  });

  it('rewards uncued inference picks slightly higher than cued switches', () => {
    // Every pick in an uncued window is an unaided inference, so it earns a
    // bit more than the cued switch bonus (documented in scoring.ts).
    expect(trialRawScore(true, 0, 5000, false, true)).toBe(150 + UNCUED_FIRST_PICK_BONUS);
    expect(trialRawScore(true, 0, 5000, true, true)).toBe(
      150 + SWITCH_CORRECT_BONUS + UNCUED_FIRST_PICK_BONUS,
    );
    expect(UNCUED_FIRST_PICK_BONUS).toBeGreaterThan(SWITCH_CORRECT_BONUS);
    expect(trialRawScore(false, 0, 5000, false, true)).toBe(0);
  });
});

describe('perfectSessionScore / perfectPlanScore', () => {
  it('scores a perfect session at rounds × 150 (speed-only maximum)', () => {
    expect(perfectSessionScore(FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal)).toBe(1500);
    expect(perfectSessionScore(FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.easy)).toBe(8 * 150);
  });
  it('scores a perfect plan higher when it contains switch trials', () => {
    const plan = [{ isSwitch: false }, { isSwitch: true }, { isSwitch: false }];
    expect(perfectPlanScore(plan)).toBe(150 + 170 + 150);
    expect(perfectPlanScore([])).toBe(0);
  });

  it('scores a perfect plan higher when it contains uncued windows', () => {
    const plan = [
      { isSwitch: false, uncued: false },
      { isSwitch: true, uncued: true },
      { isSwitch: false, uncued: true },
      { isSwitch: false }, // legacy plan item without the uncued flag → cued
    ];
    expect(perfectPlanScore(plan)).toBe(150 + (170 + UNCUED_FIRST_PICK_BONUS) + (150 + UNCUED_FIRST_PICK_BONUS) + 150);
  });
});

describe('accuracyOf / switchAccuracyOf', () => {
  it('guards division by zero and divides correctly', () => {
    expect(accuracyOf(0, 0)).toBe(0);
    expect(accuracyOf(3, 5)).toBeCloseTo(0.6);
    expect(switchAccuracyOf(0, 0)).toBe(0);
    expect(switchAccuracyOf(1, 2)).toBe(0.5);
    expect(uncuedAccuracyOf(0, 0)).toBe(0);
    expect(uncuedAccuracyOf(3, 4)).toBe(0.75);
  });
});

describe('speedScoreOf', () => {
  it('is 0 with no scored picks', () => {
    expect(speedScoreOf(0, 0, 5000)).toBe(0);
  });
  it('decays linearly to 0 at the speed target and clamps below it', () => {
    expect(speedScoreOf(0, 4, 5000)).toBe(1);
    expect(speedScoreOf(10000, 4, 5000)).toBeCloseTo(0.5);
    expect(speedScoreOf(20000, 4, 5000)).toBe(0);
    expect(speedScoreOf(40000, 4, 5000)).toBe(0);
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

describe('normalizeFlexibilityRuleFlipResult', () => {
  const context = { gameId: GAME_ID, difficulty: 'normal' as const, durationMs: 1000 };

  it('reaches exactly 1 for a perfect instant run', () => {
    const result = normalizeFlexibilityRuleFlipResult(raw(), context);
    expect(result.value).toBe(1);
    expect(result.scale).toBe('0..1');
  });

  it('is 0 when nothing was picked or everything was missed', () => {
    expect(normalizeFlexibilityRuleFlipResult(raw({ correctPicks: 0, accuracy: 0 }), context).value).toBe(0);
    expect(
      normalizeFlexibilityRuleFlipResult(raw({ roundsPlayed: 0, correctPicks: 0, accuracy: 0 }), context).value,
    ).toBe(0);
  });

  it('blends accuracy (base) with speed and switch accuracy', () => {
    // accuracy 0.8; mean response 2500ms of a 5000ms target → speed 0.5;
    // switchAccuracy 0.5; NO uncued trials → v1 formula branch:
    // value = 0.8 * (0.55 + 0.25*0.5 + 0.20*0.5) = 0.8 * 0.775 = 0.62
    const result = normalizeFlexibilityRuleFlipResult(
      raw({
        correctPicks: 8,
        accuracy: 0.8,
        totalResponseMs: 25000,
        scoredPicks: 10,
        speedScore: 0.5,
        switchPlayed: 2,
        switchCorrect: 1,
        switchAccuracy: 0.5,
      }),
      context,
    );
    expect(result.value).toBeCloseTo(0.62);
  });

  it('blends uncued first-pick accuracy once inference windows were played', () => {
    // accuracy 0.8; speed 0.5; switchAccuracy 0.5; uncuedAccuracy 0.5:
    // value = 0.8 * (0.50 + 0.25*0.5 + 0.15*0.5 + 0.10*0.5) = 0.8 * 0.75 = 0.60
    const result = normalizeFlexibilityRuleFlipResult(
      raw({
        correctPicks: 8,
        accuracy: 0.8,
        totalResponseMs: 25000,
        scoredPicks: 10,
        speedScore: 0.5,
        switchPlayed: 2,
        switchCorrect: 1,
        switchAccuracy: 0.5,
        uncuedPlayed: 2,
        uncuedCorrect: 1,
        uncuedAccuracy: 0.5,
      }),
      context,
    );
    expect(result.value).toBeCloseTo(0.6);
  });

  it('still reaches exactly 1 with uncued windows on a perfect run', () => {
    const result = normalizeFlexibilityRuleFlipResult(
      raw({ uncuedPlayed: 3, uncuedCorrect: 3, uncuedAccuracy: 1 }),
      context,
    );
    expect(result.value).toBe(1);
  });

  it('stays within [0, 1] for degenerate inputs', () => {
    const result = normalizeFlexibilityRuleFlipResult(
      raw({ correctPicks: 10, accuracy: 1, totalResponseMs: 0, switchAccuracy: 1 }),
      context,
    );
    expect(result.value).toBeLessThanOrEqual(1);
    expect(result.value).toBeGreaterThanOrEqual(0);
  });

  it('keeps the raw snapshot for diagnostics', () => {
    const result = normalizeFlexibilityRuleFlipResult(raw({ seed: 'diag' }), context);
    expect((result.raw as FlexibilityRuleFlipRawResult).seed).toBe('diag');
  });

  it('exposes an SDK-conformant normalizer bound to the game id', () => {
    expect(flexibilityRuleFlipPerformanceNormalizer.gameId).toBe(GAME_ID);
    expect(flexibilityRuleFlipPerformanceNormalizer.normalize).toBe(normalizeFlexibilityRuleFlipResult);
  });
});
