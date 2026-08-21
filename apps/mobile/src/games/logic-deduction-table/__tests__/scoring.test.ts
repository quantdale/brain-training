// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";

import {
  accuracyOf,
  clamp01,
  normalizeLogicDeductionResult,
  perfectSessionScore,
  roundScore,
  speedScoreOf,
} from "../scoring";
import { LOGIC_DEDUCTION_DIFFICULTY_PARAMS } from "../difficulty";
import type { LogicDeductionRawResult } from "../types";

function raw(overrides: Partial<LogicDeductionRawResult> = {}): LogicDeductionRawResult {
  return {
    score: 0,
    totalRounds: 6,
    roundsPlayed: 6,
    roundsCorrect: 6,
    sumAnswerRatio: 0,
    accuracy: 1,
    bestStreak: 6,
    entityCount: 3,
    attributeCount: 3,
    clueCount: 6,
    challengeRating: 0.5,
    difficulty: "normal",
    seed: "s",
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    scoringVersion: "1.1.0",
    forced: false,
    generatorInfo: {},
    diagnosticMetadata: {} as LogicDeductionRawResult["diagnosticMetadata"],
    ...overrides,
  };
}

describe("roundScore", () => {
  it("gives 150 for an instant answer and 100 at the budget", () => {
    expect(roundScore(0, 26_000)).toBe(150);
    expect(roundScore(26_000, 26_000)).toBe(100);
  });
  it("clamps over-budget answers to the base score", () => {
    expect(roundScore(50_000, 26_000)).toBe(100);
  });
  it("rejects a non-positive budget", () => {
    expect(() => roundScore(0, 0)).toThrow();
  });
});

describe("perfectSessionScore", () => {
  it("is 150 per round", () => {
    expect(perfectSessionScore(LOGIC_DEDUCTION_DIFFICULTY_PARAMS.normal)).toBe(
      900,
    );
    expect(perfectSessionScore(LOGIC_DEDUCTION_DIFFICULTY_PARAMS.easy)).toBe(
      750,
    );
  });
});

describe("accuracyOf / speedScoreOf", () => {
  it("accuracy is 0 with no rounds and divides correctly otherwise", () => {
    expect(accuracyOf(0, 0)).toBe(0);
    expect(accuracyOf(3, 5)).toBeCloseTo(0.6);
  });
  it("speed is 1 minus the average ratio, clamped", () => {
    expect(speedScoreOf(0, 5)).toBe(1);
    expect(speedScoreOf(2.5, 5)).toBeCloseTo(0.5);
    expect(speedScoreOf(10, 5)).toBe(0); // clamped at the floor
    expect(speedScoreOf(0, 0)).toBe(0);
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

describe("normalizeLogicDeductionResult", () => {
  it("is 1 for a perfect session (all correct, instant)", () => {
    const perfect = normalizeLogicDeductionResult(raw(), {
      gameId: "logic-deduction-table",
      difficulty: "normal",
      durationMs: 1000,
    });
    expect(perfect.value).toBe(1);
    expect(perfect.scale).toBe("0..1");
  });

  it("is 0 when no round was answered correctly", () => {
    const zero = normalizeLogicDeductionResult(
      raw({ roundsCorrect: 0, accuracy: 0, bestStreak: 0 }),
      { gameId: "logic-deduction-table", difficulty: "normal", durationMs: 1000 },
    );
    expect(zero.value).toBe(0);
  });

  it("blends accuracy and speed deterministically", () => {
    // accuracy 3/5, average ratio 0.5 → speed 0.5 → 0.6 * 0.75 = 0.45
    const mixed = normalizeLogicDeductionResult(
      raw({
        roundsCorrect: 3,
        roundsPlayed: 5,
        totalRounds: 5,
        sumAnswerRatio: 2.5,
        accuracy: 0.6,
      }),
      { gameId: "logic-deduction-table", difficulty: "normal", durationMs: 1000 },
    );
    expect(mixed.value).toBeCloseTo(0.45);
  });

  it("never leaves [0, 1] even with extreme inputs", () => {
    const capped = normalizeLogicDeductionResult(
      raw({ roundsCorrect: 6, roundsPlayed: 6, sumAnswerRatio: 999 }),
      { gameId: "logic-deduction-table", difficulty: "normal", durationMs: 1000 },
    );
    expect(capped.value).toBeGreaterThanOrEqual(0);
    expect(capped.value).toBeLessThanOrEqual(1);
  });

  it("keeps the raw snapshot for diagnostics", () => {
    const r = normalizeLogicDeductionResult(raw({ seed: "diag" }), {
      gameId: "logic-deduction-table",
      difficulty: "normal",
      durationMs: 1000,
    });
    expect((r.raw as LogicDeductionRawResult).seed).toBe("diag");
  });
});
