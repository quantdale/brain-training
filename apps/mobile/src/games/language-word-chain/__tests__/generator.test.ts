// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";
import { createRng } from "@/sdk";

import { loadContentPack } from "../content-validation";
import {
  MAX_GENERATION_ATTEMPTS,
  filterByLength,
  filterByTiers,
  generateRound,
  isNearDuplicateRound,
  validateGeneratedRound,
} from "../generator";
import type { WordChainDifficultyParams } from "../types";

const PACK = loadContentPack();

const PARAMS: WordChainDifficultyParams = {
  tierMask: 1 | 2,
  rounds: 6,
  timePerRoundMs: 12_000,
  minChainLen: 5,
  maxChainLen: 6,
  minBlanks: 2,
  maxBlanks: 3,
  optionsPerStep: 4,
};

const POOL = filterByLength(
  filterByTiers(PACK.chains, ["t1", "t2"]),
  PARAMS.minChainLen,
  PARAMS.maxChainLen,
);

describe("filters", () => {
  it("filterByTiers keeps pack order and only allowed tiers", () => {
    const pool = filterByTiers(PACK.chains, ["t3"]);
    expect(pool.length).toBeGreaterThan(0);
    for (const chain of pool) {
      expect(chain.tier).toBe("t3");
    }
  });

  it("filterByLength bounds chain lengths", () => {
    const pool = filterByLength(PACK.chains, 5, 5);
    expect(pool.length).toBeGreaterThan(0);
    for (const chain of pool) {
      expect(chain.words.length).toBe(5);
    }
  });
});

describe("generateRound", () => {
  it("is deterministic for the same seed + round index", () => {
    const a = generateRound({
      rng: createRng("det"),
      roundIndex: 0,
      pool: POOL,
      decoyPool: PACK.decoyPool,
      params: PARAMS,
      usedChainIds: new Set(),
      previousRound: null,
    });
    const b = generateRound({
      rng: createRng("det"),
      roundIndex: 0,
      pool: POOL,
      decoyPool: PACK.decoyPool,
      params: PARAMS,
      usedChainIds: new Set(),
      previousRound: null,
    });
    expect(a).toEqual(b);
  });

  it("diverges across seeds and round indexes", () => {
    const a = generateRound({
      rng: createRng("seed-A"),
      roundIndex: 0,
      pool: POOL,
      decoyPool: PACK.decoyPool,
      params: PARAMS,
      usedChainIds: new Set(),
      previousRound: null,
    });
    const b = generateRound({
      rng: createRng("seed-B"),
      roundIndex: 0,
      pool: POOL,
      decoyPool: PACK.decoyPool,
      params: PARAMS,
      usedChainIds: new Set(),
      previousRound: null,
    });
    expect(a).not.toEqual(b);
    // Same seed, next round salt → a different draw (pool has >1 chain).
    const c = generateRound({
      rng: createRng("seed-A"),
      roundIndex: 1,
      pool: POOL,
      decoyPool: PACK.decoyPool,
      params: PARAMS,
      usedChainIds: new Set([a.chainId]),
      previousRound: a,
    });
    expect(c.chainId).not.toBe(a.chainId);
  });

  it("produces valid rounds with a unique correct link per step", () => {
    for (const seed of ["v1", "v2", "v3", "v4", "v5"]) {
      let previous: ReturnType<typeof generateRound> | null = null;
      const used = new Set<string>();
      for (let roundIndex = 0; roundIndex < 6; roundIndex += 1) {
        const round = generateRound({
          rng: createRng(seed),
          roundIndex,
          pool: POOL,
          decoyPool: PACK.decoyPool,
          params: PARAMS,
          usedChainIds: used,
          previousRound: previous,
        });
        expect(validateGeneratedRound(round)).toBe(true);
        expect(round.blankCount).toBe(round.steps.length);
        expect(round.blankCount).toBeGreaterThanOrEqual(PARAMS.minBlanks);
        expect(round.blankCount).toBeLessThanOrEqual(PARAMS.maxBlanks);
        expect(round.fixed[0]).toBe(true); // anchor always revealed
        used.add(round.chainId);
        previous = round;
      }
    }
  });

  it("never reuses an unused-chain id while the pool allows it", () => {
    const used = new Set<string>(POOL.map((chain) => chain.id));
    used.delete(POOL[0].id); // exactly one eligible chain remains
    const round = generateRound({
      rng: createRng("single"),
      roundIndex: 0,
      pool: POOL,
      decoyPool: PACK.decoyPool,
      params: PARAMS,
      usedChainIds: used,
      previousRound: null,
    });
    expect(round.chainId).toBe(POOL[0].id);
  });

  it("falls back to deterministic reuse when the pool is exhausted", () => {
    const single = [POOL[0]];
    const used = new Set(single.map((chain) => chain.id));
    const round = generateRound({
      rng: createRng("exhausted"),
      roundIndex: 3,
      pool: single,
      decoyPool: PACK.decoyPool,
      params: PARAMS,
      usedChainIds: used,
      previousRound: null,
    });
    expect(round.chainId).toBe(single[0].id);
    expect(validateGeneratedRound(round)).toBe(true);
  });

  it("respects optionsPerStep and never duplicates an option", () => {
    const round = generateRound({
      rng: createRng("options"),
      roundIndex: 0,
      pool: POOL,
      decoyPool: PACK.decoyPool,
      params: PARAMS,
      usedChainIds: new Set(),
      previousRound: null,
    });
    for (const step of round.steps) {
      expect(step.options).toHaveLength(PARAMS.optionsPerStep);
      expect(new Set(step.options).size).toBe(step.options.length);
      expect(step.options[step.correctIndex]).toBe(step.correctWord);
    }
  });
});

describe("validateGeneratedRound", () => {
  it("rejects tampered rounds", () => {
    const round = generateRound({
      rng: createRng("tamper"),
      roundIndex: 0,
      pool: POOL,
      decoyPool: PACK.decoyPool,
      params: PARAMS,
      usedChainIds: new Set(),
      previousRound: null,
    });
    expect(validateGeneratedRound(round)).toBe(true);

    // A distractor that also satisfies the link breaks uniqueness.
    const ambiguous = {
      ...round,
      steps: round.steps.map((step, i) =>
        i === 0
          ? {
              ...step,
              options: [step.correctWord, `${step.requiredFirstLetter}xxx`, "zzz"],
              correctIndex: 0,
            }
          : step,
      ),
    };
    expect(validateGeneratedRound(ambiguous)).toBe(false);

    // Fixed mask out of sync with the blank positions.
    const maskBroken = {
      ...round,
      fixed: round.words.map(() => true),
    };
    expect(validateGeneratedRound(maskBroken)).toBe(false);

    // Empty steps are invalid.
    expect(
      validateGeneratedRound({ ...round, steps: Object.freeze([]), blankCount: 0 }),
    ).toBe(false);
  });
});

describe("isNearDuplicateRound / MAX_GENERATION_ATTEMPTS", () => {
  it("flags only identical consecutive chain picks", () => {
    const round = generateRound({
      rng: createRng("nd"),
      roundIndex: 0,
      pool: POOL,
      decoyPool: PACK.decoyPool,
      params: PARAMS,
      usedChainIds: new Set(),
      previousRound: null,
    });
    expect(isNearDuplicateRound(round, null)).toBe(false);
    expect(isNearDuplicateRound(round, round)).toBe(true);
  });

  it("bounds the re-draw budget", () => {
    expect(MAX_GENERATION_ATTEMPTS).toBeGreaterThanOrEqual(2);
  });

  it("regression: a degenerate single-chain pool falls back to a deterministic near-duplicate round instead of crashing", () => {
    const singleChainPool = [POOL[0]];
    // Round 0 picks the only chain; round 1 must re-pick it (pool exhausted
    // of alternatives). Before the fix the post-loop fallback re-threw the
    // uncaught NearDuplicateError and crashed generation.
    const previous = generateRound({
      rng: createRng("single-chain"),
      roundIndex: 0,
      pool: singleChainPool,
      decoyPool: PACK.decoyPool,
      params: PARAMS,
      usedChainIds: new Set(),
      previousRound: null,
    });
    expect(() =>
      generateRound({
        rng: createRng("single-chain"),
        roundIndex: 1,
        pool: singleChainPool,
        decoyPool: PACK.decoyPool,
        params: PARAMS,
        usedChainIds: new Set(),
        previousRound: previous,
      }),
    ).not.toThrow();
    const next = generateRound({
      rng: createRng("single-chain"),
      roundIndex: 1,
      pool: singleChainPool,
      decoyPool: PACK.decoyPool,
      params: PARAMS,
      usedChainIds: new Set(),
      previousRound: previous,
    });
    expect(next.chainId).toBe(previous.chainId);
    expect(validateGeneratedRound(next)).toBe(true);
  });
});
