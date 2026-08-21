// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";
import { createRng } from "@/sdk";

import {
  PROSPECTIVE_CUE_DIFFICULTY_PARAMS,
  nextItemMs,
  nextSignalCount,
} from "../difficulty";
import { generateRound, validateRound } from "../generator";
import {
  itemPoints,
  normalizeProspectiveCueResult,
  perfectSessionScore,
} from "../scoring";
import type { ProspectiveCueRawResult } from "../types";

describe("generateRound", () => {
  it("produces valid rounds for every difficulty and seed", () => {
    const seeds = ["seed-a", "seed-b", "12345", "prospective-cue-determinism"];
    for (const seed of seeds) {
      for (const params of Object.values(PROSPECTIVE_CUE_DIFFICULTY_PARAMS)) {
        const rng = createRng(seed);
        let prevActive: number[] | null = null;
        let count = params.initialSignalCount;
        for (let round = 0; round < params.rounds; round += 1) {
          const generated = generateRound({
            rng,
            roundIndex: round,
            signalCount: count,
            streamLen: params.streamLen,
            prevActiveSignalIds: prevActive,
          });
          expect(validateRound(generated, prevActive)).toBe(true);
          expect(generated.items).toHaveLength(params.streamLen);
          expect(generated.activeSignalIds).toHaveLength(count);
          // Each active signal appears exactly once in the stream.
          for (const id of generated.activeSignalIds) {
            expect(
              generated.items.filter((item) => item.glyphId === id),
            ).toHaveLength(1);
          }
          prevActive = [...generated.activeSignalIds];
          count = Math.min(params.maxSignalCount, count + 1);
        }
      }
    }
  });

  it("is deterministic: the same seed always yields the same session", () => {
    const buildSession = () => {
      const rng = createRng("determinism-probe");
      const rounds = [];
      let prevActive: number[] | null = null;
      let count = 2;
      for (let round = 0; round < 4; round += 1) {
        const generated = generateRound({
          rng,
          roundIndex: round,
          signalCount: count,
          streamLen: 14,
          prevActiveSignalIds: prevActive,
        });
        rounds.push(JSON.stringify(generated));
        prevActive = [...generated.activeSignalIds];
        count = Math.min(4, count + 1);
      }
      return rounds;
    };
    expect(buildSession()).toEqual(buildSession());
  });

  it("retires at most the announced set and never re-briefs survivors", () => {
    const rng = createRng("retirement-rules");
    const first = generateRound({
      rng,
      roundIndex: 0,
      signalCount: 3,
      streamLen: 14,
      prevActiveSignalIds: null,
    });
    expect(first.retiredSignalIds).toEqual([]);
    expect(first.newSignalIds).toHaveLength(3);

    const second = generateRound({
      rng,
      roundIndex: 1,
      signalCount: 3,
      streamLen: 14,
      prevActiveSignalIds: [...first.activeSignalIds],
    });
    expect(validateRound(second, [...first.activeSignalIds])).toBe(true);
    // At least one departure whenever the previous watchlist had ≥ 2 members.
    expect(second.retiredSignalIds.length).toBeGreaterThanOrEqual(1);
    // Survivors carry over unnamed: they are neither new nor retired.
    const survivors = first.activeSignalIds.filter(
      (id) => !second.retiredSignalIds.includes(id),
    );
    expect(survivors.length).toBeGreaterThanOrEqual(1);
    expect(second.newSignalIds.some((id) => survivors.includes(id))).toBe(
      false,
    );
  });
});

describe("difficulty escalation", () => {
  it("escalates on pass, holds on fail, and floors the window", () => {
    const params = PROSPECTIVE_CUE_DIFFICULTY_PARAMS.normal;
    expect(nextSignalCount(2, true, "normal", params)).toBe(3);
    expect(nextSignalCount(2, false, "normal", params)).toBe(2);
    expect(nextItemMs(params.initialItemMs, true, params)).toBe(
      params.initialItemMs - 150,
    );
    expect(nextItemMs(params.minItemMs + 50, true, params)).toBe(
      params.minItemMs,
    );
    expect(nextItemMs(params.minItemMs, false, params)).toBe(
      params.minItemMs,
    );
    // Adaptive steps back down within bounds.
    expect(nextSignalCount(2, false, "adaptive", {
      ...params,
      minSignalCount: 2,
    })).toBe(2);
  });
});

describe("scoring", () => {
  it("scores each item kind per the documented table", () => {
    expect(itemPoints(true, "signal")).toBe(120);
    expect(itemPoints(true, "go")).toBe(-30);
    expect(itemPoints(true, "timeout")).toBe(-30);
    expect(itemPoints(false, "signal")).toBe(-40);
    expect(itemPoints(false, "go", 0)).toBe(20); // instant GO: full bonus
    expect(itemPoints(false, "go", 1)).toBe(10); // last-moment GO: no bonus
    expect(itemPoints(false, "timeout")).toBe(-5);
  });

  it("normalizes into [0,1] with prospective accuracy dominating", () => {
    const base = {
      totalRounds: 5,
      roundsPlayed: 5,
      roundsPassed: 5,
      bestStreak: 5,
      initialSignalCount: 2,
      maxSignalCount: 4,
      itemMs: 1900,
      streamLen: 14,
      challengeRating: 0.5,
      difficulty: "normal" as const,
      seed: "norm-seed",
      gameVersion: "1.0.0",
      generatorVersion: "1.0.0",
      scoringVersion: "1.0.0",
      forced: false,
      generatorInfo: {},
      diagnosticMetadata: {},
    };
    const raw = (overrides: Record<string, unknown>) =>
      ({
        score: 0,
        accuracy: 0,
        signalAccuracy: 0,
        ...base,
        ...overrides,
      }) as ProspectiveCueRawResult;
    const context = {
      gameId: "memory-prospective-cue",
      difficulty: "normal" as const,
      durationMs: 60_000,
    };

    // Perfect play → 1.
    expect(
      normalizeProspectiveCueResult(
        raw({ signalAccuracy: 1, accuracy: 1 }),
        context,
      ).value,
    ).toBe(1);
    // All signals caught but sloppy ongoing task → 0.6.
    expect(
      normalizeProspectiveCueResult(
        raw({ signalAccuracy: 1, accuracy: 0 }),
        context,
      ).value,
    ).toBeCloseTo(0.6);
    // Missed every signal → 0 regardless of ongoing accuracy.
    expect(
      normalizeProspectiveCueResult(
        raw({ signalAccuracy: 0, accuracy: 1 }),
        context,
      ).value,
    ).toBe(0);
    // Perfect-session score is positive and deterministic.
    expect(
      perfectSessionScore(PROSPECTIVE_CUE_DIFFICULTY_PARAMS.normal),
    ).toBeGreaterThan(0);
  });
});
