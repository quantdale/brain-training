// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";

import {
  WRONG_TAP_PENALTY,
  accuracyOf,
  clamp01,
  normalizePairRecallResult,
  pairProgress,
  pairRecallPerformanceNormalizer,
  perfectSessionScore,
  referenceMaxPairs,
  roundScore,
} from "../scoring";
import { GAME_ID } from "../types";
import type { PairRecallRawResult } from "../types";
import { PAIR_RECALL_DIFFICULTY_PARAMS } from "../difficulty";

function makeRaw(overrides: Partial<PairRecallRawResult>): PairRecallRawResult {
  const params = PAIR_RECALL_DIFFICULTY_PARAMS.normal;
  return {
    score: 0,
    totalRounds: params.rounds,
    roundsPlayed: params.rounds,
    roundsPassed: params.rounds,
    accuracy: 1,
    bestRecall: params.initialPairCount,
    bestStreak: params.rounds,
    initialPairCount: params.initialPairCount,
    maxPairCount: params.maxPairCount,
    studyMs: params.studyMs,
    challengeRating: 0.5,
    difficulty: "normal",
    seed: "scoring-seed",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    scoringVersion: "1.0.0",
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {} as PairRecallRawResult["diagnosticMetadata"],
    ...overrides,
  };
}

describe("roundScore", () => {
  it("pays 100 base plus 20 per extra pair past the start", () => {
    expect(roundScore(3, 3)).toBe(100);
    expect(roundScore(5, 3)).toBe(140);
  });
});

describe("perfectSessionScore / referenceMaxPairs", () => {
  it("computes the canonical perfect run for a level", () => {
    const params = PAIR_RECALL_DIFFICULTY_PARAMS.normal; // 3 pairs, cap 6, 5 rounds
    expect(referenceMaxPairs(params)).toBe(6); // min(6, 3 + 4)
    let expected = 0;
    const counts = [3, 4, 5, 6, 6];
    for (const count of counts) {
      expected += roundScore(count, 3);
    }
    expect(perfectSessionScore(params)).toBe(expected);
  });
});

describe("normalizePairRecallResult", () => {
  it("returns 1.0 for a perfect escalated run", () => {
    const raw = makeRaw({
      roundsPlayed: 5,
      roundsPassed: 5,
      bestRecall: 6,
      score: perfectSessionScore(PAIR_RECALL_DIFFICULTY_PARAMS.normal),
    });
    expect(normalizePairRecallResult(raw, { gameId: GAME_ID, difficulty: "normal", durationMs: 1000 }).value).toBe(1);
  });

  it("blends accuracy and escalation multiplicatively", () => {
    // Half the rounds passed, best recall only the starting count.
    const raw = makeRaw({ roundsPlayed: 4, roundsPassed: 2, bestRecall: 3 });
    const value = normalizePairRecallResult(raw, {
      gameId: GAME_ID,
      difficulty: "normal",
      durationMs: 1000,
    }).value;
    expect(value).toBeCloseTo(1 * (0.5 + 0.5 * (3 / 6)) * 0.5);
  });

  it("is 0 when nothing was played", () => {
    const raw = makeRaw({ roundsPlayed: 0, roundsPassed: 0, bestRecall: 0 });
    expect(
      normalizePairRecallResult(raw, { gameId: GAME_ID, difficulty: "normal", durationMs: 0 })
        .value,
    ).toBe(0);
  });

  it("exposes the SDK normalizer contract", () => {
    expect(pairRecallPerformanceNormalizer.gameId).toBe(GAME_ID);
    expect(typeof pairRecallPerformanceNormalizer.normalize).toBe("function");
  });
});

describe("helpers", () => {
  it("accuracyOf guards division by zero", () => {
    expect(accuracyOf(0, 0)).toBe(0);
    expect(accuracyOf(3, 4)).toBe(0.75);
  });

  it("pairProgress clamps to [0, 1]", () => {
    expect(pairProgress(10, 6)).toBe(1);
    expect(pairProgress(-1, 6)).toBe(0);
    expect(pairProgress(3, 6)).toBe(0.5);
  });

  it("clamp01 rejects non-finite input", () => {
    expect(() => clamp01(Number.NaN)).toThrow();
    expect(clamp01(1.5)).toBe(1);
  });

  it("wrong picks cost points", () => {
    expect(WRONG_TAP_PENALTY).toBeGreaterThan(0);
  });
});
