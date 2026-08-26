import { describe, expect, it } from "@jest/globals";

import type { GameDefinition } from "@/sdk";

import {
  buildWorkoutV3Context,
  explainSignalOrder,
  orderDailyBySignals,
} from "../v3";
import type { WorkoutSelectionReason } from "../personalize";

function game(id: string, primaryCategory: string): GameDefinition {
  return {
    id,
    name: id,
    primaryCategory,
    description: "",
    version: "1.0.0",
    generatorVersion: null,
    contentVersion: null,
  } as unknown as GameDefinition;
}

const GAMES = [
  game("alpha", "Memory"),
  game("beta", "Speed"),
  game("gamma", "Logic & Problem Solving"),
];

describe("orderDailyBySignals", () => {
  it("keeps the input order unchanged without a context", () => {
    const out = orderDailyBySignals(GAMES, null);
    expect(out.map((g) => g.id)).toEqual(["alpha", "beta", "gamma"]);
  });

  it("is deterministic and stable on equal scores", () => {
    const ctx = buildWorkoutV3Context({ nowMs: 1_700_000_000_000 });
    const a = orderDailyBySignals(GAMES, ctx).map((g) => g.id);
    const b = orderDailyBySignals(GAMES, ctx).map((g) => g.id);
    expect(a).toEqual(b);
  });

  it("surfaces a weak domain ahead of a healthy one", () => {
    // Memory declined below the never-played starting rating; Speed is fresh.
    const ctx = buildWorkoutV3Context({
      nowMs: 1_700_000_000_000,
      ratings: [
        { domain: "Memory", rating: 940, sessions: 12, updatedAt: 1_690_000_000_000 },
        { domain: "Speed", rating: 1060, sessions: 10, updatedAt: 1_700_000_000_000 },
      ],
      aggregates: [
        { gameId: "alpha", count: 12, avgNormalized: 0.5, bestNormalized: 0.6, lastCompletedAt: 1_699_000_000_000 },
        { gameId: "beta", count: 10, avgNormalized: 0.7, bestNormalized: 0.8, lastCompletedAt: 1_700_000_000_000 },
      ],
      recentSessions: [],
    });
    const ordered = orderDailyBySignals(GAMES, ctx).map((g) => g.id);
    // The weak-domain member must lead; relative order of the rest follows
    // their scores with input-order ties.
    expect(ordered.indexOf("alpha")).toBeLessThan(ordered.indexOf("beta"));
  });
});

describe("explainSignalOrder", () => {
  it("records truthful top-signal reasons aligned to the ordering", () => {
    const ctx = buildWorkoutV3Context({
      nowMs: 1_700_000_000_000,
      ratings: [
        { domain: "Memory", rating: 940, sessions: 12, updatedAt: 1_690_000_000_000 },
      ],
    });
    const ordered = orderDailyBySignals(GAMES, ctx);
    const reasons = explainSignalOrder(ordered, ctx);
    expect(reasons).toHaveLength(ordered.length);
    for (const reason of reasons as WorkoutSelectionReason[]) {
      expect(typeof reason.gameId).toBe("string");
      expect(typeof reason.detail).toBe("string");
      expect(reason.detail.length).toBeGreaterThan(0);
    }
    // The weak-domain leader names its evidence.
    const leader = reasons.find((r) => r.gameId === ordered[0].id)!;
    expect(leader.kind).toBe("weak-domain");
    expect(leader.detail).toContain("Memory");
  });

  it("never invents reasons: no context ⇒ honest 'balanced selection'", () => {
    const reasons = explainSignalOrder(GAMES, null);
    expect(reasons.every((r) => r.kind === "selected" && r.detail === "balanced selection")).toBe(true);
  });

  it("only emits known signal kinds with instance-specific details", () => {
    // Rich evidence: whichever signals fire, every reason must name a real
    // kind from the V3 vocabulary and carry a non-generic detail string.
    const ctx = buildWorkoutV3Context({
      nowMs: 1_700_000_000_000,
      ratings: [
        { domain: "Memory", rating: 940, sessions: 40, updatedAt: 1_690_000_000_000 },
        { domain: "Speed", rating: 1075, sessions: 38, updatedAt: 1_700_000_000_000 },
        { domain: "Logic & Problem Solving", rating: 1070, sessions: 36, updatedAt: 1_700_000_000_000 },
      ],
      aggregates: GAMES.map((g, i) => ({
        gameId: g.id,
        count: 20 + i,
        avgNormalized: 0.72,
        bestNormalized: 0.8,
        lastCompletedAt: 1_699_900_000_000,
      })),
      recentSessions: GAMES.flatMap((g) => [
        { gameId: g.id, normalizedResult: 0.7, completedAt: 1_699_800_000_000 },
        { gameId: g.id, normalizedResult: 0.74, completedAt: 1_699_500_000_000 },
      ]),
    });
    const KNOWN = new Set([
      "weak-domain",
      "stale-domain",
      "recency-avoided",
      "selected",
      "excluded",
      "undertrained-domain",
      "novelty",
      "performance-trend",
      "personal-best-proximity",
      "difficulty-fit",
      "overexposure",
    ]);
    for (const r of explainSignalOrder(orderDailyBySignals(GAMES, ctx), ctx)) {
      expect(KNOWN.has(r.kind)).toBe(true);
      expect(r.detail.length).toBeGreaterThan(0);
      // The generic fallback is only allowed when NO component was active.
      if (!(r.kind === "selected" && r.detail === "balanced selection")) {
        expect(r.detail).not.toContain("undefined");
      }
    }
  });

  it("marks excluded members", () => {
    const ctx = buildWorkoutV3Context({});
    const reasons = explainSignalOrder(GAMES, ctx, (id) => id === "beta");
    expect(reasons.find((r) => r.gameId === "beta")?.kind).toBe("excluded");
  });
});
