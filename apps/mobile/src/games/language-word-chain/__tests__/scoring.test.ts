// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";

import { WORD_CHAIN_DIFFICULTY_PARAMS } from "../difficulty";
import {
  FULL_CHAIN_BONUS,
  PER_STEP_BASE,
  PER_STEP_MAX_SPEED,
  accuracyOf,
  clamp01,
  normalizeWordChainResult,
  perfectSessionScore,
  speedScoreOf,
  stepScore,
  wordChainPerformanceNormalizer,
} from "../scoring";
import { GAME_ID } from "../types";
import type { LanguageWordChainRawResult } from "../types";

function raw(
  overrides: Partial<LanguageWordChainRawResult> = {},
): LanguageWordChainRawResult {
  return {
    score: 0,
    totalRounds: 6,
    roundsPlayed: 6,
    roundsCorrect: 6,
    accuracy: 1,
    bestStreak: 6,
    totalAnswerMs: 0,
    sumAnswerRatio: 0,
    stepsPlayed: 18,
    stepsCorrect: 18,
    roundOutcomes: [],
    contentPackId: "language-word-chain-core-v1",
    contentPackVersion: "1.0.0",
    challengeRating: 0.5,
    finalTier: null,
    difficulty: "normal",
    seed: "s",
    gameVersion: "1.0.0",
    generatorVersion: null,
    scoringVersion: "1.1.0",
    forced: false,
    generatorInfo: {},
    diagnosticMetadata:
      {} as LanguageWordChainRawResult["diagnosticMetadata"],
    ...overrides,
  };
}

describe("stepScore", () => {
  it("rewards instant answers with the full speed bonus", () => {
    expect(stepScore(0, 12_000)).toBe(PER_STEP_BASE + PER_STEP_MAX_SPEED);
  });

  it("degrades linearly to the base at the budget", () => {
    expect(stepScore(6_000, 12_000)).toBe(
      PER_STEP_BASE + Math.round(PER_STEP_MAX_SPEED / 2),
    );
    expect(stepScore(12_000, 12_000)).toBe(PER_STEP_BASE);
  });

  it("clamps over-budget answers to the base", () => {
    expect(stepScore(99_000, 12_000)).toBe(PER_STEP_BASE);
  });

  it("rejects a non-positive budget", () => {
    expect(() => stepScore(100, 0)).toThrow(RangeError);
    expect(() => stepScore(100, -5)).toThrow(RangeError);
  });
});

describe("perfectSessionScore", () => {
  it("sums max step points plus a full-chain bonus per chain", () => {
    // normal: 6 rounds × (3 blanks × 15 + 10) = 330
    expect(perfectSessionScore(WORD_CHAIN_DIFFICULTY_PARAMS.normal)).toBe(330);
    expect(perfectSessionScore(WORD_CHAIN_DIFFICULTY_PARAMS.easy)).toBe(
      5 * (2 * (PER_STEP_BASE + PER_STEP_MAX_SPEED) + FULL_CHAIN_BONUS),
    );
  });
});

describe("accuracyOf / speedScoreOf", () => {
  it("accuracy is 0 with no rounds and divides correctly otherwise", () => {
    expect(accuracyOf(0, 0)).toBe(0);
    expect(accuracyOf(3, 5)).toBeCloseTo(0.6);
    expect(accuracyOf(6, 6)).toBe(1);
  });

  it("speed is 1 for instant answers and 0 when the budget was consumed", () => {
    expect(speedScoreOf(0, 18)).toBe(1);
    expect(speedScoreOf(18, 18)).toBe(0);
    expect(speedScoreOf(9, 18)).toBeCloseTo(0.5);
    expect(speedScoreOf(0, 0)).toBe(0);
  });

  it("speed clamps pathological ratios above 1", () => {
    expect(speedScoreOf(36, 18)).toBe(0);
  });
});

describe("clamp01", () => {
  it("clamps into [0, 1]", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.4)).toBe(0.4);
  });

  it("rejects non-finite input", () => {
    expect(() => clamp01(NaN)).toThrow();
    expect(() => clamp01(Infinity)).toThrow();
  });
});

describe("normalizeWordChainResult", () => {
  const context = {
    gameId: GAME_ID,
    difficulty: "normal" as const,
    durationMs: 1000,
  };

  it("gives a perfect fast run the maximum value of 1", () => {
    const perfect = normalizeWordChainResult(raw(), context);
    expect(perfect.value).toBe(1);
    expect(perfect.scale).toBe("0..1");
  });

  it("is 0 when nothing was answered correctly", () => {
    const zero = normalizeWordChainResult(
      raw({ roundsCorrect: 0, accuracy: 0 }),
      context,
    );
    expect(zero.value).toBe(0);
  });

  it("is 0 for an empty session (no rounds played)", () => {
    const empty = normalizeWordChainResult(
      raw({
        roundsPlayed: 0,
        roundsCorrect: 0,
        stepsPlayed: 0,
        accuracy: 0,
      }),
      context,
    );
    expect(empty.value).toBe(0);
  });

  it("blends speed so slow-but-perfect play stays below 1", () => {
    const slow = normalizeWordChainResult(
      raw({ sumAnswerRatio: 18, totalAnswerMs: 216_000 }), // avg ratio 1
      context,
    );
    expect(slow.value).toBeCloseTo(0.5);
    const half = normalizeWordChainResult(
      raw({ sumAnswerRatio: 9 }), // avg ratio 0.5
      context,
    );
    expect(half.value).toBeCloseTo(0.75);
  });

  it("stays within [0, 1] for arbitrary inputs", () => {
    const weird = normalizeWordChainResult(
      raw({ roundsCorrect: 4, roundsPlayed: 7, sumAnswerRatio: 11, stepsPlayed: 9 }),
      context,
    );
    expect(weird.value).toBeGreaterThanOrEqual(0);
    expect(weird.value).toBeLessThanOrEqual(1);
  });

  it("keeps the raw snapshot for diagnostics", () => {
    const result = normalizeWordChainResult(raw({ seed: "diag" }), context);
    expect((result.raw as LanguageWordChainRawResult).seed).toBe("diag");
  });
});

describe("wordChainPerformanceNormalizer", () => {
  it("is bound to the game id and delegates to normalize", () => {
    expect(wordChainPerformanceNormalizer.gameId).toBe(GAME_ID);
    const result = wordChainPerformanceNormalizer.normalize(raw(), {
      gameId: GAME_ID,
      difficulty: "normal",
      durationMs: 1000,
    });
    expect(result.value).toBe(1);
  });
});
