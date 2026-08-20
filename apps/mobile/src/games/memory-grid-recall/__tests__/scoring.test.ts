// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";

import {
  accuracyOf,
  clamp01,
  normalizeGridRecallResult,
  perfectSessionScore,
  recallProgress,
  referenceMaxTargets,
  roundScore,
} from "../scoring";
import { GRID_RECALL_DIFFICULTY_PARAMS } from "../difficulty";
import type { GridRecallRawResult } from "../types";

function raw(
  overrides: Partial<GridRecallRawResult> = {},
): GridRecallRawResult {
  return {
    score: 0,
    totalRounds: 5,
    roundsPlayed: 5,
    roundsPassed: 5,
    accuracy: 1,
    bestRecall: 9,
    bestStreak: 5,
    initialTargetCount: 5,
    gridSize: 16,
    studyMs: 1800,
    challengeRating: 0.5,
    difficulty: "normal",
    seed: "s",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    scoringVersion: "1.0.0",
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {} as GridRecallRawResult["diagnosticMetadata"],
    ...overrides,
  };
}

describe("roundScore", () => {
  it("rewards larger patterns with an escalation bonus", () => {
    expect(roundScore(3, 3)).toBe(100);
    expect(roundScore(9, 5)).toBe(100 + 15 * 4);
  });
});

describe("perfectSessionScore", () => {
  it("sums the escalated per-round scores", () => {
    // normal: counts 5,6,7,8,9 -> 100,115,130,145,160 = 650
    expect(perfectSessionScore(GRID_RECALL_DIFFICULTY_PARAMS.normal)).toBe(650);
    expect(perfectSessionScore(GRID_RECALL_DIFFICULTY_PARAMS.easy)).toBe(
      100 + 115 + 130 + 145,
    );
  });
});

describe("referenceMaxTargets", () => {
  it("caps escalation at the grid size", () => {
    expect(referenceMaxTargets(GRID_RECALL_DIFFICULTY_PARAMS.normal)).toBe(9);
    expect(referenceMaxTargets(GRID_RECALL_DIFFICULTY_PARAMS.expert)).toBe(18); // 12 + (7-1) = 18, capped at grid size 36
  });
});

describe("accuracyOf", () => {
  it("is 0 with no rounds and divides correctly otherwise", () => {
    expect(accuracyOf(0, 0)).toBe(0);
    expect(accuracyOf(3, 5)).toBeCloseTo(0.6);
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
  });
});

describe("recallProgress", () => {
  it("is 0 at the start and 1 when reaching the reference max", () => {
    expect(recallProgress(5, 9)).toBeCloseTo(5 / 9);
    expect(recallProgress(9, 9)).toBe(1);
    expect(recallProgress(0, 0)).toBe(1); // degenerate: bestRecall >= refMax
  });
});

describe("normalizeGridRecallResult", () => {
  it("rewards both accuracy and escalation", () => {
    const perfect = normalizeGridRecallResult(
      raw({ roundsPassed: 5, roundsPlayed: 5, bestRecall: 9 }),
      { gameId: "memory-grid-recall", difficulty: "normal", durationMs: 1000 },
    );
    expect(perfect.value).toBeCloseTo(1);
    expect(perfect.scale).toBe("0..1");
  });

  it("is 0 when no round passed", () => {
    const zero = normalizeGridRecallResult(
      raw({ roundsPlayed: 5, roundsPassed: 0, bestRecall: 0 }),
      { gameId: "memory-grid-recall", difficulty: "normal", durationMs: 1000 },
    );
    expect(zero.value).toBe(0);
  });

  it("never exceeds 1 even with a huge best recall", () => {
    const capped = normalizeGridRecallResult(
      raw({ roundsPassed: 5, roundsPlayed: 5, bestRecall: 100 }),
      { gameId: "memory-grid-recall", difficulty: "normal", durationMs: 1000 },
    );
    expect(capped.value).toBeLessThanOrEqual(1);
  });

  it("keeps the raw snapshot for diagnostics", () => {
    const r = normalizeGridRecallResult(raw({ seed: "diag" }), {
      gameId: "memory-grid-recall",
      difficulty: "normal",
      durationMs: 1000,
    });
    expect((r.raw as GridRecallRawResult).seed).toBe("diag");
  });
});
