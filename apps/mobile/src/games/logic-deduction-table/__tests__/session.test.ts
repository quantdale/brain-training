// Jest globals imported explicitly (repo has no @types/jest).
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { RNG_ALGORITHM_VERSION } from "@/sdk";
import type { DifficultyProfile, GameRawResult } from "@/sdk";

import {
  LOGIC_DEDUCTION_DIFFICULTY_PARAMS,
  resolveLogicDeductionDifficulty,
} from "../difficulty";
import { INITIAL_STATS } from "../types";
import type { LogicDeductionRawResult } from "../types";
import {
  buildLogicDeductionRawResult,
  buildSessionRecord,
  persistLogicDeductionSession,
  seedToNumber,
} from "../session";
import type { SessionPersistence } from "../session";
import { SCORING_VERSION, versionToNumber } from "../versions";

function buildRaw(overrides: Partial<Parameters<typeof buildLogicDeductionRawResult>[0]> = {}) {
  return buildLogicDeductionRawResult({
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    scoringVersion: SCORING_VERSION,
    difficulty: "normal",
    params: LOGIC_DEDUCTION_DIFFICULTY_PARAMS.normal,
    challengeRating: 0.5,
    seed: "seed-x",
    stats: { ...INITIAL_STATS },
    outcomes: [],
    forced: false,
    startedAtMs: 100,
    activeDurationMs: 1000,
    pausedDurationMs: 0,
    ...overrides,
  });
}

describe("buildLogicDeductionRawResult", () => {
  it("carries the full reproducibility envelope", () => {
    const raw = buildRaw();
    expect(raw.gameVersion).toBe("1.0.0");
    expect(raw.generatorVersion).toBe("1.0.0");
    expect(raw.scoringVersion).toBe(SCORING_VERSION);
    expect(raw.seed).toBe("seed-x");
    expect(raw.difficulty).toBe("normal");
    expect(raw.entityCount).toBe(3);
    expect(raw.attributeCount).toBe(3);
    expect(raw.clueCount).toBe(6);
    expect(raw.totalRounds).toBe(6);
    expect(raw.challengeRating).toBe(0.5);
    expect(raw.forced).toBe(false);
    expect(raw.generatorInfo.rngAlgorithm).toBe(RNG_ALGORITHM_VERSION);
    expect(raw.generatorInfo.entityCount).toBe(3);
    expect(raw.diagnosticMetadata.gameId).toBe("logic-deduction-table");
    expect(raw.diagnosticMetadata.seed).toBe("seed-x");
    expect(raw.diagnosticMetadata.difficulty).toBe("normal");
  });

  it("computes accuracy from rounds correct/played", () => {
    const raw = buildRaw({
      stats: { ...INITIAL_STATS, roundsPlayed: 4, roundsCorrect: 3 },
    });
    expect(raw.accuracy).toBe(0.75);
    expect(raw.roundsPlayed).toBe(4);
    expect(raw.roundsCorrect).toBe(3);
  });

  it("marks forced sessions", () => {
    expect(buildRaw({ forced: true }).forced).toBe(true);
  });
});

describe("seedToNumber", () => {
  it("keeps numeric seeds verbatim when safe", () => {
    expect(seedToNumber("12345")).toBe(12345);
    expect(seedToNumber(String(Number.MAX_SAFE_INTEGER))).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });
  it("hashes non-numeric seeds deterministically into uint32", () => {
    const a = seedToNumber("logic-deduction-table-seed");
    const b = seedToNumber("logic-deduction-table-seed");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(a)).toBe(true);
  });
  it("hashes differently for different seeds", () => {
    expect(seedToNumber("a")).not.toBe(seedToNumber("b"));
  });
});

describe("versionToNumber", () => {
  it("maps semver to major*1e6 + minor*1e3 + patch and null to 0", () => {
    expect(versionToNumber("1.2.3")).toBe(1_002_003);
    expect(versionToNumber("1.0.0")).toBe(1_000_000);
    expect(versionToNumber(null)).toBe(0);
  });
});

describe("buildSessionRecord", () => {
  it("maps the outcome onto the persistence record shape", () => {
    const raw = buildRaw({ seed: "rec-seed" });
    const profile = resolveLogicDeductionDifficulty("normal");
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
    expect(record.gameId).toBe("logic-deduction-table");
    expect(record.gameVersion).toBe(1_000_000);
    expect(record.generatorVersion).toBe(1_000_000);
    expect(record.scoringVersion).toBe(versionToNumber(SCORING_VERSION));
    expect(record.seed).toBe(seedToNumber("rec-seed"));
    // `GameSessionRecord.difficulty` is `unknown` at the db boundary; the
    // session builder stores the resolved profile document.
    const storedDifficulty = record.difficulty as DifficultyProfile;
    expect(storedDifficulty.level).toBe("normal");
    expect(storedDifficulty.challengeRating).toBe(0.5);
    expect(storedDifficulty.parameters.entityCount).toBe(3);
    expect(record.normalizedResult).toBe(0.5);
    expect(record.xp).toBe(0);
    expect(record.startedAt).toBe(10);
    expect(record.completedAt).toBe(110);
    expect(record.durationMs).toBe(100);
    expect((record.rawResult as LogicDeductionRawResult).seed).toBe("rec-seed");
  });
});

describe("persistLogicDeductionSession", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("persists through the injected persister", async () => {
    const completeSession = jest.fn(async () => ({
      session: {} as never,
      ledgerEntry: null,
      balance: 0,
    }));
    const persister = { completeSession } as unknown as SessionPersistence;
    const outcome = await persistLogicDeductionSession(
      { id: "sid" } as never,
      persister,
    );
    expect(outcome.ok).toBe(true);
    expect(completeSession).toHaveBeenCalledTimes(1);
  });

  it("reports (never throws) on persistence failure", async () => {
    const errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const completeSession = jest.fn(async () => {
      throw new Error("db closed");
    });
    const persister = { completeSession } as unknown as SessionPersistence;
    const outcome = await persistLogicDeductionSession(
      { id: "sid" } as never,
      persister,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect((outcome.error as Error).message).toBe("db closed");
    }
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
