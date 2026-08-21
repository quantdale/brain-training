// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";
import { RNG_ALGORITHM_VERSION } from "@/sdk";
import type { DifficultyProfile, GameRawResult } from "@/sdk";

import {
  PAIR_RECALL_DIFFICULTY_PARAMS,
  resolvePairRecallDifficulty,
} from "../difficulty";
import { INITIAL_STATS } from "../types";
import type { PairRecallRawResult } from "../types";
import {
  buildPairRecallRawResult,
  buildSessionRecord,
  seedToNumber,
} from "../session";
import { SCORING_VERSION } from "../versions";

describe("buildPairRecallRawResult", () => {
  const params = PAIR_RECALL_DIFFICULTY_PARAMS.normal;

  it("carries the full reproducibility envelope", () => {
    const raw = buildPairRecallRawResult({
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
    expect(raw.seed).toBe("seed-x");
    expect(raw.difficulty).toBe("normal");
    expect(raw.initialPairCount).toBe(params.initialPairCount);
    expect(raw.maxPairCount).toBe(params.maxPairCount);
    expect(raw.studyMs).toBe(params.studyMs);
    expect(raw.challengeRating).toBe(0.5);
    expect(raw.forced).toBe(false);
    expect(raw.generatorInfo.rngAlgorithm).toBe(RNG_ALGORITHM_VERSION);
    expect(raw.diagnosticMetadata.gameId).toBe("memory-pair-recall");
    expect(raw.diagnosticMetadata.seed).toBe("seed-x");
  });

  it("computes accuracy from rounds passed/played", () => {
    const raw = buildPairRecallRawResult({
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
    const a = seedToNumber("memory-pair-recall-seed");
    const b = seedToNumber("memory-pair-recall-seed");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(a)).toBe(true);
  });
  it("hashes differently for different seeds", () => {
    expect(seedToNumber("a")).not.toBe(seedToNumber("b"));
  });
});

describe("buildSessionRecord", () => {
  it("maps the outcome onto the persistence record shape", () => {
    const params = PAIR_RECALL_DIFFICULTY_PARAMS.normal;
    const raw = buildPairRecallRawResult({
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
    const profile = resolvePairRecallDifficulty("normal");
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
    expect(record.gameId).toBe("memory-pair-recall");
    expect(record.seed).toBe(seedToNumber("rec-seed"));
    // `GameSessionRecord.difficulty` is `unknown` at the db boundary; the
    // session builder stores the resolved profile document.
    const storedDifficulty = record.difficulty as DifficultyProfile;
    expect(storedDifficulty.level).toBe("normal");
    expect(storedDifficulty.challengeRating).toBe(0.5);
    expect(record.normalizedResult).toBe(0.5);
    expect(record.xp).toBe(0);
    expect(record.durationMs).toBe(100);
    expect((record.rawResult as PairRecallRawResult).seed).toBe("rec-seed");
  });
});
