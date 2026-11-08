// Jest globals imported explicitly (repo has no @types/jest).
//
// Scoring + normalization contract for the Cue Keeper game (057).
//
// Raw scoring is game-owned; `normalizeProspectiveCueResult` converts it to
// the SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
// rating/XP logic runs: value = clamp01(signalAccuracy × accuracy) (scoring 1.2.0).
import { describe, expect, it } from "@jest/globals";

import {
  accuracyOf,
  clamp01,
  itemAccuracyOf,
  normalizeProspectiveCueResult,
  perfectSessionScore,
  prospectiveCuePerformanceNormalizer,
  signalAccuracyOf,
} from "../scoring";
import { PROSPECTIVE_CUE_DIFFICULTY_PARAMS } from "../difficulty";
import { buildProspectiveCueRawResult } from "../session";
import { GAME_ID, INITIAL_STATS } from "../types";
import type { ProspectiveCueRawResult } from "../types";

function raw(overrides: Record<string, unknown> = {}): ProspectiveCueRawResult {
  return {
    score: 0,
    totalRounds: 5,
    roundsPlayed: 5,
    roundsPassed: 5,
    accuracy: 1,
    signalAccuracy: 1,
    bestStreak: 5,
    initialSignalCount: 2,
    maxSignalCount: 4,
    itemMs: 1900,
    streamLen: 14,
    challengeRating: 0.5,
    difficulty: "normal",
    seed: "scoring-seed",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    scoringVersion: "1.0.0",
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {},
    ...overrides,
  } as ProspectiveCueRawResult;
}

const CONTEXT = {
  gameId: "memory-prospective-cue",
  difficulty: "normal" as const,
  durationMs: 60_000,
};

describe("clamp01", () => {
  it("clamps into [0, 1]", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0.42)).toBe(0.42);
  });

  it("collapses non-finite input to 0 (matches rating/pipeline.ts)", () => {
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clamp01(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe("accuracy helpers", () => {
  it("guard division by zero", () => {
    expect(accuracyOf(0, 0)).toBe(0);
    expect(signalAccuracyOf(0, 0)).toBe(0);
    expect(itemAccuracyOf(0, 0)).toBe(0);
  });

  it("compute the documented ratios", () => {
    expect(accuracyOf(3, 4)).toBe(0.75);
    expect(signalAccuracyOf(8, 10)).toBeCloseTo(0.8);
    expect(itemAccuracyOf(54, 60)).toBeCloseTo(0.9);
  });
});

describe("normalizeProspectiveCueResult", () => {
  it("returns 1.0 for perfect play", () => {
    expect(
      normalizeProspectiveCueResult(raw({ signalAccuracy: 1, accuracy: 1 }), CONTEXT)
        .value,
    ).toBe(1);
  });

  it("requires both prospective and ongoing-task accuracy", () => {
    // All signals caught but nothing else answered correctly → 0 (1.1.0 gave 0.6).
    expect(
      normalizeProspectiveCueResult(raw({ signalAccuracy: 1, accuracy: 0 }), CONTEXT)
        .value,
    ).toBe(0);
    // Missed every signal → 0 regardless of ongoing accuracy.
    expect(
      normalizeProspectiveCueResult(raw({ signalAccuracy: 0, accuracy: 1 }), CONTEXT)
        .value,
    ).toBe(0);
  });

  it("does not reward pressing SIGNAL on every item (audit: spam scored ~0.68)", () => {
    // Normal level, every item answered SIGNAL: all 17 signals are caught but
    // every one of the 53 fillers is a false alarm, so only 17/70 responses
    // are correct and every round fails.
    const spam = buildProspectiveCueRawResult({
      gameVersion: "1.3.0",
      generatorVersion: "1.0.0",
      scoringVersion: "1.2.0",
      difficulty: "normal",
      params: PROSPECTIVE_CUE_DIFFICULTY_PARAMS.normal,
      challengeRating: 0.5,
      finalItemMs: 1900,
      seed: "spam",
      stats: {
        ...INITIAL_STATS,
        roundsPlayed: 5,
        roundsPassed: 0,
        totalSignals: 17,
        signalHits: 17,
        falseAlarms: 53,
        totalItems: 70,
        correctResponses: 17,
      },
      forced: false,
      startedAtMs: 0,
      activeDurationMs: 60_000,
      pausedDurationMs: 0,
    });
    const spamValue = normalizeProspectiveCueResult(spam, CONTEXT).value;
    expect(spamValue).toBeLessThan(0.3);
    // A strictly worse-than-perfect honest run (one miss, no false alarms)
    // must beat spamming by a wide margin.
    const honest = normalizeProspectiveCueResult(
      raw({ signalAccuracy: 16 / 17, accuracy: 69 / 70 }),
      CONTEXT,
    ).value;
    expect(honest).toBeGreaterThan(spamValue + 0.5);
  });

  it("collapses a corrupt signal tally to 0 instead of throwing", () => {
    let value = -1;
    expect(() => {
      value = normalizeProspectiveCueResult(
        raw({ signalAccuracy: Number.NaN, accuracy: 0.9 }),
        CONTEXT,
      ).value;
    }).not.toThrow();
    expect(value).toBe(0);
  });

  it("collapses a corrupt ongoing-task accuracy to 0 instead of throwing", () => {
    let value = -1;
    expect(() => {
      value = normalizeProspectiveCueResult(
        raw({ signalAccuracy: 0.8, accuracy: Number.POSITIVE_INFINITY }),
        CONTEXT,
      ).value;
    }).not.toThrow();
    expect(value).toBe(0);
  });

  it("exposes the SDK normalizer contract", () => {
    expect(prospectiveCuePerformanceNormalizer.gameId).toBe(GAME_ID);
    expect(typeof prospectiveCuePerformanceNormalizer.normalize).toBe("function");
  });

  it("perfect-session score is positive and deterministic", () => {
    expect(
      perfectSessionScore(PROSPECTIVE_CUE_DIFFICULTY_PARAMS.normal),
    ).toBeGreaterThan(0);
  });
});
