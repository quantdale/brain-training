// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it, jest } from "@jest/globals";
import { RNG_ALGORITHM_VERSION } from "@/sdk";
import type { DifficultyProfile, GameRawResult } from "@/sdk";

import { resolveWordChainDifficulty } from "../difficulty";
import {
  buildSessionRecord,
  buildWordChainRawResult,
  persistWordChainSession,
  seedToNumber,
} from "../session";
import { CONTENT_PACK_ID, CONTENT_PACK_VERSION, SCORING_VERSION } from "../versions";
import { INITIAL_STATS } from "../types";
import type { LanguageWordChainRawResult } from "../types";

function rawInputStats() {
  return { ...INITIAL_STATS, roundsPlayed: 4, roundsCorrect: 3 };
}

function buildRaw(): LanguageWordChainRawResult {
  return buildWordChainRawResult({
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    scoringVersion: SCORING_VERSION,
    difficulty: "normal",
    params: {
      tierMask: 3,
      rounds: 6,
      timePerRoundMs: 12_000,
      minChainLen: 5,
      maxChainLen: 6,
      minBlanks: 2,
      maxBlanks: 3,
      optionsPerStep: 4,
    },
    challengeRating: 0.5,
    seed: "seed-x",
    stats: rawInputStats(),
    outcomes: ["correct", "wrong", "correct", "timeout"],
    finalTier: null,
    forced: false,
    startedAtMs: 100,
    activeDurationMs: 1000,
    pausedDurationMs: 50,
  });
}

describe("buildWordChainRawResult", () => {
  it("carries the full reproducibility envelope", () => {
    const raw = buildRaw();
    expect(raw.gameVersion).toBe("1.0.0");
    // Seeded pack selection is procedural provenance: versioned, never null.
    expect(raw.generatorVersion).toBe("1.0.0");
    expect(raw.scoringVersion).toBe(SCORING_VERSION);
    expect(raw.seed).toBe("seed-x");
    expect(raw.difficulty).toBe("normal");
    expect(raw.challengeRating).toBe(0.5);
    expect(raw.contentPackId).toBe(CONTENT_PACK_ID);
    expect(raw.contentPackVersion).toBe(CONTENT_PACK_VERSION);
    expect(raw.totalRounds).toBe(6);
    expect(raw.roundOutcomes).toEqual([
      "correct",
      "wrong",
      "correct",
      "timeout",
    ]);
    expect(raw.finalTier).toBeNull();
    expect(raw.forced).toBe(false);
    expect(raw.generatorInfo.rngAlgorithm).toBe(RNG_ALGORITHM_VERSION);
    expect(raw.generatorInfo.packId).toBe(CONTENT_PACK_ID);
    expect(raw.diagnosticMetadata.gameId).toBe("language-word-chain");
    expect(raw.diagnosticMetadata.seed).toBe("seed-x");
    expect(raw.diagnosticMetadata.generatorVersion).toBe("1.0.0");
    expect(raw.diagnosticMetadata.pausedDurationMs).toBe(50);
  });

  it("computes accuracy from rounds correct/played", () => {
    expect(buildRaw().accuracy).toBeCloseTo(0.75);
  });
});

describe("seedToNumber", () => {
  it("keeps numeric seeds verbatim when safe", () => {
    expect(seedToNumber("12345")).toBe(12345);
    expect(seedToNumber("0")).toBe(0);
  });

  it("hashes non-numeric seeds deterministically with FNV-1a", () => {
    const a = seedToNumber("language-word-chain-seed");
    const b = seedToNumber("language-word-chain-seed");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(a)).toBe(true);
  });

  it("hashes differently for different seeds", () => {
    expect(seedToNumber("a")).not.toBe(seedToNumber("b"));
  });

  it("falls back to hashing for numerically-unsafe seeds", () => {
    const hashed = seedToNumber("99999999999999999999");
    expect(Number.isSafeInteger(hashed)).toBe(true);
  });
});

describe("buildSessionRecord", () => {
  it("maps the outcome onto the persistence record shape", () => {
    const raw = buildRaw();
    const profile = resolveWordChainDifficulty("normal");
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
    expect(record.gameId).toBe("language-word-chain");
    expect(record.gameVersion).toBe(1_000_000); // 1.0.0
    // Seeded pack selection is versioned provenance (no longer null → 0).
    expect(record.generatorVersion).toBe(1_000_000);
    expect(record.scoringVersion).toBe(1_001_000); // 1.1.0
    expect(record.seed).toBe(seedToNumber("seed-x"));
    // `GameSessionRecord.difficulty` is `unknown` at the db boundary; the
    // session builder stores the resolved profile document.
    const storedDifficulty = record.difficulty as DifficultyProfile;
    expect(storedDifficulty.level).toBe("normal");
    expect(storedDifficulty.challengeRating).toBe(0.5);
    expect(storedDifficulty.parameters.tierMask).toBe(3);
    expect(record.normalizedResult).toBe(0.5);
    expect(record.xp).toBe(0);
    expect(record.startedAt).toBe(10);
    expect(record.completedAt).toBe(110);
    expect(record.durationMs).toBe(100);
    expect((record.rawResult as LanguageWordChainRawResult).seed).toBe(
      "seed-x",
    );
  });
});

describe("persistWordChainSession", () => {
  function recordFor(): ReturnType<typeof buildSessionRecord> {
    return buildSessionRecord({
      sessionId: "sid",
      rawResult: buildRaw(),
      difficulty: resolveWordChainDifficulty("normal"),
      normalized: { value: 1, scale: "0..1", raw: {} as GameRawResult },
      xp: 0,
      startedAtMs: 10,
      completedAtMs: 110,
      activeDurationMs: 100,
    });
  }

  it("returns the completion result on success", async () => {
    const record = recordFor();
    const completionOutcome = {
      session: record,
      xp: 5,
      currency: 2,
      deltas: [],
      balance: 2,
    };
    const completeSession = jest.fn(async () => ({
      session: record,
      ledgerEntry: null,
      balance: 2,
      rating: null,
      completionOutcome,
    }));
    const outcome = await persistWordChainSession(
      record,
      // Cast mirrors the sibling suites: the fake narrows the db seam.
      { completeSession } as unknown as Parameters<
        typeof persistWordChainSession
      >[1],
    );
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.completionOutcome).toEqual(completionOutcome);
    }
    expect(completeSession).toHaveBeenCalledWith({ session: record });
  });

  it("reports failures without throwing", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const record = recordFor();
    const completeSession = jest.fn(async () => {
      throw new Error("db locked");
    });
    const outcome = await persistWordChainSession(
      record,
      { completeSession } as unknown as Parameters<
        typeof persistWordChainSession
      >[1],
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(String(outcome.error)).toContain("db locked");
    }
    errorSpy.mockRestore();
  });
});
