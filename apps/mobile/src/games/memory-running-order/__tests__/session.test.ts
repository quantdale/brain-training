// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it, jest } from "@jest/globals";
import { RNG_ALGORITHM_VERSION } from "@/sdk";
import type { DifficultyProfile, GameRawResult } from "@/sdk";

import { RUNNING_ORDER_DIFFICULTY_PARAMS, resolveRunningOrderDifficulty } from "../difficulty";
import { INITIAL_STATS } from "../types";
import type { RunningOrderRawResult } from "../types";
import {
  buildRunningOrderRawResult,
  buildSessionRecord,
  persistRunningOrderSession,
  seedToNumber,
} from "../session";
import type { SessionPersistence } from "../session";
import { SCORING_VERSION, versionToNumber } from "../versions";

describe("buildRunningOrderRawResult", () => {
  const params = RUNNING_ORDER_DIFFICULTY_PARAMS.normal;

  it("carries the full reproducibility envelope", () => {
    const raw = buildRunningOrderRawResult({
      gameVersion: "1.0.0",
      generatorVersion: "1.0.0",
      scoringVersion: SCORING_VERSION,
      difficulty: "normal",
      params,
      challengeRating: 0.5,
      seed: "seed-x",
      stats: { ...INITIAL_STATS },
      forced: false,
      startedAtMs: 100,
      activeDurationMs: 1000,
      pausedDurationMs: 0,
    });
    expect(raw.gameVersion).toBe("1.0.0");
    expect(raw.generatorVersion).toBe("1.0.0");
    expect(raw.scoringVersion).toBe(SCORING_VERSION);
    expect(raw.seed).toBe("seed-x");
    expect(raw.difficulty).toBe("normal");
    expect(raw.streamLen).toBe(4);
    expect(raw.initialRecallLength).toBe(3);
    expect(raw.flashMs).toBe(800);
    expect(raw.totalRounds).toBe(5);
    expect(raw.challengeRating).toBe(0.5);
    expect(raw.forced).toBe(false);
    expect(raw.generatorInfo.rngAlgorithm).toBe(RNG_ALGORITHM_VERSION);
    expect(raw.generatorInfo.streamLen).toBe(4);
    expect(raw.generatorInfo.rounds).toBe(5);
    expect(raw.diagnosticMetadata.gameId).toBe("memory-running-order");
    expect(raw.diagnosticMetadata.seed).toBe("seed-x");
    expect(raw.diagnosticMetadata.gameVersion).toBe("1.0.0");
  });

  it("computes accuracy from rounds passed/played", () => {
    const raw = buildRunningOrderRawResult({
      gameVersion: "1.0.0",
      generatorVersion: "1.0.0",
      scoringVersion: SCORING_VERSION,
      difficulty: "normal",
      params,
      challengeRating: 0.5,
      seed: "s",
      stats: { ...INITIAL_STATS, roundsPlayed: 4, roundsPassed: 3 },
      forced: false,
      startedAtMs: 1,
      activeDurationMs: 1,
      pausedDurationMs: 0,
    });
    expect(raw.accuracy).toBe(0.75);
  });
});

describe("seedToNumber", () => {
  it("keeps numeric seeds verbatim when safe", () => {
    expect(seedToNumber("12345")).toBe(12345);
  });
  it("hashes non-numeric seeds deterministically", () => {
    const a = seedToNumber("memory-running-order-seed");
    const b = seedToNumber("memory-running-order-seed");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(a)).toBe(true);
  });
  it("hashes oversized numeric seeds instead of losing precision", () => {
    const hashed = seedToNumber("99999999999999999999");
    expect(Number.isInteger(hashed)).toBe(true);
    expect(hashed).toBeGreaterThanOrEqual(0);
  });
  it("hashes differently for different seeds", () => {
    expect(seedToNumber("a")).not.toBe(seedToNumber("b"));
  });
});

describe("versionToNumber", () => {
  it("maps semantic versions onto the db integer columns", () => {
    expect(versionToNumber("1.2.3")).toBe(1_002_003);
    expect(versionToNumber("1.0.0")).toBe(1_000_000);
  });
  it("rejects a null version (non-procedural games)", () => {
    expect(() => versionToNumber(null)).toThrow();
  });
});

describe("buildSessionRecord", () => {
  it("maps the outcome onto the persistence record shape", () => {
    const params = RUNNING_ORDER_DIFFICULTY_PARAMS.normal;
    const raw = buildRunningOrderRawResult({
      gameVersion: "1.0.0",
      generatorVersion: "1.0.0",
      scoringVersion: SCORING_VERSION,
      difficulty: "normal",
      params,
      challengeRating: 0.5,
      seed: "rec-seed",
      stats: { ...INITIAL_STATS },
      forced: false,
      startedAtMs: 10,
      activeDurationMs: 100,
      pausedDurationMs: 0,
    });
    const profile = resolveRunningOrderDifficulty("normal");
    const record = buildSessionRecord({
      sessionId: "sid",
      rawResult: raw,
      difficulty: profile,
      normalized: {
        value: 0.5,
        scale: "0..1",
        raw: { ...raw } as GameRawResult,
      },
      xp: 0,
      startedAtMs: 10,
      completedAtMs: 110,
      activeDurationMs: 100,
    });
    expect(record.id).toBe("sid");
    expect(record.gameId).toBe("memory-running-order");
    expect(record.gameVersion).toBe(1_000_000);
    expect(record.generatorVersion).toBe(1_000_000);
    expect(record.scoringVersion).toBe(1_000_000);
    expect(record.seed).toBe(seedToNumber("rec-seed"));
    // `GameSessionRecord.difficulty` is `unknown` at the db boundary; the
    // session builder stores the resolved profile document.
    const storedDifficulty = record.difficulty as DifficultyProfile;
    expect(storedDifficulty.level).toBe("normal");
    expect(storedDifficulty.challengeRating).toBe(0.5);
    expect(record.normalizedResult).toBe(0.5);
    expect(record.xp).toBe(0);
    expect(record.startedAt).toBe(10);
    expect(record.completedAt).toBe(110);
    expect(record.durationMs).toBe(100);
    expect((record.rawResult as RunningOrderRawResult).seed).toBe("rec-seed");
  });
});

describe("persistRunningOrderSession", () => {
  function recordFor(): ReturnType<typeof buildSessionRecord> {
    const params = RUNNING_ORDER_DIFFICULTY_PARAMS.normal;
    const raw = buildRunningOrderRawResult({
      gameVersion: "1.0.0",
      generatorVersion: "1.0.0",
      scoringVersion: SCORING_VERSION,
      difficulty: "normal",
      params,
      challengeRating: 0.5,
      seed: "persist-seed",
      stats: { ...INITIAL_STATS },
      forced: false,
      startedAtMs: 1,
      activeDurationMs: 10,
      pausedDurationMs: 0,
    });
    return buildSessionRecord({
      sessionId: "persist-1",
      rawResult: raw,
      difficulty: resolveRunningOrderDifficulty("normal"),
      normalized: { value: 1, scale: "0..1", raw: { ...raw } as GameRawResult },
      xp: 0,
      startedAtMs: 1,
      completedAtMs: 11,
      activeDurationMs: 10,
    });
  }

  it("returns the completion result on success", async () => {
    const persister: SessionPersistence = {
      completeSession: async (input) => ({
        session: input.session,
        ledgerEntry: null,
        balance: 0,
        rating: null,
        completionOutcome: null,
      }),
    };
    const outcome = await persistRunningOrderSession(recordFor(), persister);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.session.id).toBe("persist-1");
    }
  });

  it("reports failures without throwing and never crashes the game", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const boom = new Error("db locked");
    const failing: SessionPersistence = {
      completeSession: async () => {
        throw boom;
      },
    };
    const outcome = await persistRunningOrderSession(recordFor(), failing);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toBe(boom);
    }
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
