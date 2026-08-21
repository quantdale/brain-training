// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";

import {
  accuracyOf,
  clamp01,
  normalizeRunningOrderResult,
  perfectSessionScore,
  recallProgress,
  referenceMaxTargets,
  roundScore,
  runningOrderPerformanceNormalizer,
} from "../scoring";
import { RUNNING_ORDER_DIFFICULTY_PARAMS } from "../difficulty";
import { GAME_ID } from "../types";
import type { RunningOrderRawResult } from "../types";

const CONTEXT = {
  gameId: GAME_ID,
  difficulty: "normal" as const,
  durationMs: 1000,
};

function raw(
  overrides: Partial<RunningOrderRawResult> = {},
): RunningOrderRawResult {
  return {
    score: 0,
    totalRounds: 5,
    roundsPlayed: 5,
    roundsPassed: 5,
    accuracy: 1,
    bestRecall: 4,
    bestStreak: 5,
    initialRecallLength: 3,
    streamLen: 4,
    flashMs: 800,
    challengeRating: 0.5,
    difficulty: "normal",
    seed: "s",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    scoringVersion: "1.0.0",
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {} as RunningOrderRawResult["diagnosticMetadata"],
    ...overrides,
  };
}

describe("roundScore", () => {
  it("rewards longer recall lengths with an escalation bonus", () => {
    expect(roundScore(3, 3)).toBe(100);
    expect(roundScore(4, 3)).toBe(100 + 20);
  });
  it("never drops below the base score", () => {
    expect(roundScore(2, 3)).toBe(100);
  });
});

describe("perfectSessionScore", () => {
  it("sums the escalated per-round scores", () => {
    // normal: lengths 3,4,4,4,4 -> 100,120,120,120,120 = 580
    expect(perfectSessionScore(RUNNING_ORDER_DIFFICULTY_PARAMS.normal)).toBe(
      580,
    );
    // easy: rounds 4, initial recall 2, streamLen 3 -> lengths 2,3,3,3
    expect(perfectSessionScore(RUNNING_ORDER_DIFFICULTY_PARAMS.easy)).toBe(
      100 + 120 + 120 + 120,
    );
  });
});

describe("referenceMaxTargets", () => {
  it("caps escalation at the stream length", () => {
    expect(referenceMaxTargets(RUNNING_ORDER_DIFFICULTY_PARAMS.normal)).toBe(
      4,
    ); // min(streamLen 4, 3 + 4)
    expect(referenceMaxTargets(RUNNING_ORDER_DIFFICULTY_PARAMS.expert)).toBe(
      8,
    ); // min(streamLen 8, 4 + 6)
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
  it("is proportional and clamped into [0, 1]", () => {
    expect(recallProgress(3, 4)).toBeCloseTo(0.75);
    expect(recallProgress(4, 4)).toBe(1);
    expect(recallProgress(9, 4)).toBe(1); // clamped above the reference max
    expect(recallProgress(0, 0)).toBe(1); // degenerate: bestRecall >= refMax
  });
});

describe("normalizeRunningOrderResult", () => {
  it("rewards both accuracy and escalation", () => {
    const perfect = normalizeRunningOrderResult(raw(), CONTEXT);
    expect(perfect.value).toBeCloseTo(1);
    expect(perfect.scale).toBe("0..1");
  });

  it("blends accuracy with escalation progress", () => {
    // accuracy 3/5 = 0.6; refMax = min(4, 3 + 4) = 4; progress = 3/4 = 0.75
    // value = 0.6 * (0.5 + 0.5 * 0.75) = 0.525
    const blended = normalizeRunningOrderResult(
      raw({ roundsPlayed: 5, roundsPassed: 3, bestRecall: 3 }),
      CONTEXT,
    );
    expect(blended.value).toBeCloseTo(0.525);
  });

  it("is 0 when no round passed", () => {
    const zero = normalizeRunningOrderResult(
      raw({ roundsPlayed: 5, roundsPassed: 0, bestRecall: 2 }),
      CONTEXT,
    );
    expect(zero.value).toBe(0);
  });

  it("never exceeds 1 even with a huge best recall", () => {
    const capped = normalizeRunningOrderResult(
      raw({ bestRecall: 100 }),
      CONTEXT,
    );
    expect(capped.value).toBeLessThanOrEqual(1);
  });

  it("keeps the raw snapshot for diagnostics", () => {
    const r = normalizeRunningOrderResult(raw({ seed: "diag" }), CONTEXT);
    expect((r.raw as RunningOrderRawResult).seed).toBe("diag");
  });
});

describe("runningOrderPerformanceNormalizer", () => {
  it("is bound to the game id and delegates to normalizeRunningOrderResult", () => {
    expect(runningOrderPerformanceNormalizer.gameId).toBe(GAME_ID);
    expect(runningOrderPerformanceNormalizer.normalize(raw(), CONTEXT).value)
      .toBeCloseTo(1);
  });
});
