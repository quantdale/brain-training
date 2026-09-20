/**
 * 057: optimistic-vs-authoritative XP parity. The hook must return exactly
 * what `computeRatingOutcome` (and therefore `completeSession`'s storedXp)
 * computes for the same normalized value + difficulty level, so the first
 * rendered reward is already correct.
 */
import { describe, expect, it } from "@jest/globals";
import type { GameSessionRecord } from "@/db";
import type { DifficultyLevel } from "@/sdk";
import { computeRatingOutcome, computeXp } from "@/rating/pipeline";
import { pipelineXpRatingHook } from "@/rating/xp-hook";

const LEVELS: DifficultyLevel[] = ["easy", "normal", "hard", "expert", "adaptive"];
const VALUES = [0, 0.13, 0.5, 0.87, 1];

function recordFor(value: number, level: DifficultyLevel): GameSessionRecord {
  return {
    id: "parity-session",
    gameId: "memory",
    gameVersion: 1,
    generatorVersion: 1,
    scoringVersion: 1,
    seed: 7,
    difficulty: { level },
    rawResult: {},
    normalizedResult: value,
    xp: 0,
    startedAt: 1_700_000_000_000,
    completedAt: 1_700_000_000_000 + 60_000,
    durationMs: 60_000,
  };
}

describe("pipelineXpRatingHook parity", () => {
  it("matches the authoritative pipeline outcome XP for every level and value", () => {
    for (const level of LEVELS) {
      for (const value of VALUES) {
        const optimistic = pipelineXpRatingHook.computeXp(
          { value, scale: "0..1" },
          { gameId: "memory", difficulty: level, durationMs: 60_000 },
        );
        const authoritative = computeRatingOutcome(
          recordFor(value, level),
          () => ["Memory"],
        );
        expect(optimistic).toBe(authoritative.xp);
        // Sanity: equals the direct pipeline function on the same inputs.
        expect(optimistic).toBe(computeXp(value, level));
      }
    }
  });

  it("falls back neutrally for unknown levels, identically to the pipeline", () => {
    const odd = "unknown-level" as DifficultyLevel;
    const optimistic = pipelineXpRatingHook.computeXp(
      { value: 0.5, scale: "0..1" },
      { gameId: "memory", difficulty: odd, durationMs: 60_000 },
    );
    const authoritative = computeRatingOutcome(recordFor(0.5, odd), () => ["Memory"]);
    expect(optimistic).toBe(authoritative.xp);
  });

  it("awards no rating movement optimistically (authoritative deltas arrive via completionOutcome)", () => {
    expect(
      pipelineXpRatingHook.computeRatingDeltas(
        { value: 0.9, scale: "0..1" },
        { gameId: "memory", difficulty: "normal", durationMs: 60_000 },
      ),
    ).toEqual([]);
  });
});
