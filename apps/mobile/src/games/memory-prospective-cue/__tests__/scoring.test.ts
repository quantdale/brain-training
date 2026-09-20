// Jest globals imported explicitly (repo has no @types/jest).
//
// Scoring + normalization contract for the Cue Keeper game (057).
//
// Raw scoring is game-owned; `normalizeProspectiveCueResult` converts it to
// the SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
// rating/XP logic runs: value = clamp01(signalAccuracy × (0.6 + 0.4 × accuracy)).
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
import { GAME_ID } from "../types";
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

  it("weights prospective accuracy above the ongoing task", () => {
    // All signals caught but sloppy ongoing task → 0.6.
    expect(
      normalizeProspectiveCueResult(raw({ signalAccuracy: 1, accuracy: 0 }), CONTEXT)
        .value,
    ).toBeCloseTo(0.6);
    // Missed every signal → 0 regardless of ongoing accuracy.
    expect(
      normalizeProspectiveCueResult(raw({ signalAccuracy: 0, accuracy: 1 }), CONTEXT)
        .value,
    ).toBe(0);
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
