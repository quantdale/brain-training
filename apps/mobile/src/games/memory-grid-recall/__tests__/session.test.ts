// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";
import { createRng, RNG_ALGORITHM_VERSION } from "@/sdk";
import type { GameRawResult } from "@/sdk";

import {
  GRID_RECALL_DIFFICULTY_PARAMS,
  resolveGridRecallDifficulty,
} from "../difficulty";
import { generateTargetCells } from "../generator";
import { INITIAL_STATS } from "../types";
import type { GridRecallRawResult } from "../types";
import {
  buildGridRecallRawResult,
  buildSessionRecord,
  seedToNumber,
} from "../session";
import { SCORING_VERSION } from "../versions";

describe("buildGridRecallRawResult", () => {
  const params = GRID_RECALL_DIFFICULTY_PARAMS.normal;

  it("carries the full reproducibility envelope", () => {
    const raw = buildGridRecallRawResult({
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
    expect(raw.gridSize).toBe(16);
    expect(raw.initialTargetCount).toBe(5);
    expect(raw.studyMs).toBe(1800);
    expect(raw.challengeRating).toBe(0.5);
    expect(raw.forced).toBe(false);
    expect(raw.generatorInfo.rngAlgorithm).toBe(RNG_ALGORITHM_VERSION);
    expect(raw.diagnosticMetadata.gameId).toBe("memory-grid-recall");
    expect(raw.diagnosticMetadata.seed).toBe("seed-x");
  });

  it("computes accuracy from rounds passed/played", () => {
    const raw = buildGridRecallRawResult({
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
    const a = seedToNumber("memory-grid-recall-seed");
    const b = seedToNumber("memory-grid-recall-seed");
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
    const params = GRID_RECALL_DIFFICULTY_PARAMS.normal;
    const raw = buildGridRecallRawResult({
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
    const profile = resolveGridRecallDifficulty("normal");
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
    expect(record.gameId).toBe("memory-grid-recall");
    expect(record.seed).toBe(seedToNumber("rec-seed"));
    expect(record.difficulty.level).toBe("normal");
    expect(record.difficulty.challengeRating).toBe(0.5);
    expect(record.normalizedResult).toBe(0.5);
    expect(record.xp).toBe(0);
    expect(record.durationMs).toBe(100);
    expect((record.rawResult as GridRecallRawResult).seed).toBe("rec-seed");
  });
});

describe("generator determinism", () => {
  it("produces distinct valid target sets across rounds for a seed", () => {
    const seed = "gen-seed";
    const r0 = generateTargetCells({
      rng: createRng(seed),
      roundIndex: 0,
      gridSize: 16,
      targetCount: 5,
      prevTargets: null,
    });
    const r1 = generateTargetCells({
      rng: createRng(seed),
      roundIndex: 1,
      gridSize: 16,
      targetCount: 5,
      prevTargets: r0,
    });
    expect(r0).toHaveLength(5);
    expect(new Set(r0).size).toBe(5);
    expect(r1).toHaveLength(5);
    expect(new Set(r1).size).toBe(5);
    expect(r1).not.toEqual(r0);
    // stable
    expect(
      generateTargetCells({
        rng: createRng(seed),
        roundIndex: 0,
        gridSize: 16,
        targetCount: 5,
        prevTargets: null,
      }),
    ).toEqual(r0);
  });

  it("rejects invalid inputs", () => {
    expect(() =>
      generateTargetCells({
        rng: createRng("x"),
        roundIndex: 0,
        gridSize: 4,
        targetCount: 9,
        prevTargets: null,
      }),
    ).toThrow();
  });
});
