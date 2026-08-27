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
import type { WordChainDifficultyParams, WordChainRound } from "../types";
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
      let previous: WordChainRound | null = null;
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

describe("deterministic selection and repetition over repeated sessions", () => {
  it("same seed yields identical chain sequence across repeated sessions", () => {
    const seed = "deterministic-session-seed";
    function runSession(): string[] {
      const used = new Set<string>();
      let previous: WordChainRound | null = null;
      const ids: string[] = [];
      for (let roundIndex = 0; roundIndex < 8; roundIndex += 1) {
        const round = generateRound({
          rng: createRng(seed),
          roundIndex,
          pool: PACK.chains,
          decoyPool: PACK.decoyPool,
          params: PARAMS,
          usedChainIds: used,
          previousRound: previous,
        });
        expect(validateGeneratedRound(round)).toBe(true);
        ids.push(round.chainId);
        used.add(round.chainId);
        previous = round;
      }
      return ids;
    }
    const first = runSession();
    const second = runSession();
    expect(first).toEqual(second);
    // Determinism across seeds: different seed diverges.
    const other = (() => {
      const used = new Set<string>();
      let prev: WordChainRound | null = null;
      const ids: string[] = [];
      for (let i = 0; i < 8; i += 1) {
        const r = generateRound({
          rng: createRng("other-seed"),
          roundIndex: i,
          pool: PACK.chains,
          decoyPool: PACK.decoyPool,
          params: PARAMS,
          usedChainIds: used,
          previousRound: prev,
        });
        ids.push(r.chainId);
        used.add(r.chainId);
        prev = r;
      }
      return ids;
    })();
    expect(other).not.toEqual(first);
  });

  it("never repeats a chain within a session while the pool allows it", () => {
    const used = new Set<string>();
    let previous: WordChainRound | null = null;
    const seen = new Set<string>();
    for (let roundIndex = 0; roundIndex < 8; roundIndex += 1) {
      const round = generateRound({
        rng: createRng("no-repeat"),
        roundIndex,
        pool: PACK.chains,
        decoyPool: PACK.decoyPool,
        params: PARAMS,
        usedChainIds: used,
        previousRound: previous,
      });
      expect(seen.has(round.chainId)).toBe(false);
      seen.add(round.chainId);
      used.add(round.chainId);
      previous = round;
    }
    expect(seen.size).toBe(8);
  });

  it("covers each tier deterministically over many seeds", () => {
    // Over many seeds, each tier's chains are reachable (at least one seed picks each tier).
    // This guards against tier starvation after expansion.
    const tierSeen: Record<string, Set<string>> = { t1: new Set<string>(), t2: new Set<string>(), t3: new Set<string>() };
    for (let s = 0; s < 30; s += 1) {
      const seed = `tier-seed-${s}`;
      const used = new Set<string>();
      let prev: WordChainRound | null = null;
      for (let i = 0; i < 6; i += 1) {
        const r = generateRound({
          rng: createRng(seed),
          roundIndex: i,
          pool: PACK.chains,
          decoyPool: PACK.decoyPool,
          params: PARAMS,
          usedChainIds: used,
          previousRound: prev,
        });
        tierSeen[r.tier].add(r.chainId);
        used.add(r.chainId);
        prev = r;
      }
    }
    expect(tierSeen.t1.size).toBeGreaterThan(5);
    expect(tierSeen.t2.size).toBeGreaterThan(5);
    expect(tierSeen.t3.size).toBeGreaterThan(5);
  });

  it("pack provides ≥30 chains per tier and ≥90 total (curated, not filler)", () => {
    expect(PACK.chains.length).toBeGreaterThanOrEqual(90);
    const counts: Record<string, number> = { t1: 0, t2: 0, t3: 0 };
    for (const c of PACK.chains) counts[c.tier] += 1;
    expect(counts.t1).toBeGreaterThanOrEqual(30);
    expect(counts.t2).toBeGreaterThanOrEqual(30);
    expect(counts.t3).toBeGreaterThanOrEqual(30);
    // Curated quality: no chain is a low-quality filler of single-letter repeats; each word ≥3 and chains are disjoint.
    const allWords = new Set<string>();
    for (const c of PACK.chains) {
      for (const w of c.words) {
        expect(w.length).toBeGreaterThanOrEqual(3);
        expect(/^[a-z]+$/.test(w)).toBe(true);
        expect(allWords.has(w)).toBe(false);
        allWords.add(w);
      }
    }
    expect(allWords.size).toBeGreaterThanOrEqual(90 * 4);
  });
});
