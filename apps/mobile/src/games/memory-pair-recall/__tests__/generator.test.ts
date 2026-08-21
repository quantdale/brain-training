// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";
import { createRng } from "@/sdk";

import { PAIR_RECALL_DIFFICULTY_PARAMS, ADAPTIVE_PARAMS, nextPairCount } from "../difficulty";
import {
  carryOverCount,
  generateRound,
  isNearDuplicateRound,
  validateRound,
} from "../generator";
import type { PairRecallRound } from "../types";

describe("generateRound", () => {
  it("produces valid rounds for every difficulty and seed", () => {
    const seeds = ["seed-a", "seed-b", "12345", "pair-recall-determinism"];
    for (const seed of seeds) {
      let prev: PairRecallRound | null = null;
      for (const [level, params] of Object.entries(PAIR_RECALL_DIFFICULTY_PARAMS)) {
        void level;
        const rng = createRng(seed);
        let count = params.initialPairCount;
        for (let round = 0; round < params.rounds; round += 1) {
          const generated = generateRound({
            rng,
            roundIndex: round,
            pairCount: count,
            prevRound: prev,
          });
          expect(validateRound(generated, prev)).toBe(true);
          expect(generated.pairs).toHaveLength(count);
          prev = generated;
          count = Math.min(params.maxPairCount, count + 1);
        }
      }
    }
  });

  it("is deterministic: the same seed always yields the same session", () => {
    const buildSession = () => {
      const rng = createRng("determinism-seed");
      const rounds: PairRecallRound[] = [];
      let prev: PairRecallRound | null = null;
      for (let r = 0; r < 4; r += 1) {
        const round = generateRound({ rng, roundIndex: r, pairCount: 3, prevRound: prev });
        rounds.push(round);
        prev = round;
      }
      return rounds;
    };
    expect(buildSession()).toEqual(buildSession());
  });

  it("carries at least one stimulus from the previous round and re-pairs it", () => {
    const rng = createRng("carry-seed");
    const r0 = generateRound({ rng, roundIndex: 0, pairCount: 3, prevRound: null });
    const r1 = generateRound({ rng, roundIndex: 1, pairCount: 3, prevRound: r0 });

    const r0Map = new Map(r0.pairs.map((p) => [p.stimulusId, p.responseId]));
    const carried = r1.pairs.filter((p) => r0Map.has(p.stimulusId));
    expect(carried.length).toBeGreaterThanOrEqual(1);
    // Every carried stimulus must have a NEW partner (interference guarantee).
    for (const p of carried) {
      expect(p.responseId).not.toBe(r0Map.get(p.stimulusId));
    }
    expect(validateRound(r1, r0)).toBe(true);
  });

  it("keeps stimuli and responses unique within a round", () => {
    const rng = createRng("unique-seed");
    const round = generateRound({ rng, roundIndex: 0, pairCount: 6, prevRound: null });
    expect(new Set(round.pairs.map((p) => p.stimulusId)).size).toBe(6);
    expect(new Set(round.pairs.map((p) => p.responseId)).size).toBe(6);
  });

  it("rejects invalid inputs", () => {
    const rng = createRng("x");
    expect(() =>
      generateRound({ rng, roundIndex: 0, pairCount: 0, prevRound: null }),
    ).toThrow();
    expect(() =>
      generateRound({ rng, roundIndex: 0, pairCount: 99, prevRound: null }),
    ).toThrow();
  });
});

describe("carryOverCount", () => {
  it("is zero without a previous round", () => {
    expect(carryOverCount(3, null)).toBe(0);
  });

  it("keeps at least one and never exceeds the previous round's size", () => {
    const prev: PairRecallRound = {
      pairs: [
        { stimulusId: 0, responseId: 0 },
        { stimulusId: 1, responseId: 1 },
      ],
      cueOrder: [0, 1],
      responseOptions: [0, 1],
    };
    expect(carryOverCount(6, prev)).toBe(2);
    expect(carryOverCount(2, prev)).toBe(1);
  });
});

describe("isNearDuplicateRound", () => {
  const base: PairRecallRound = {
    pairs: [
      { stimulusId: 0, responseId: 6 },
      { stimulusId: 2, responseId: 5 },
    ],
    cueOrder: [0, 1],
    responseOptions: [6, 5],
  };

  it("flags an identical pair map regardless of presentation order", () => {
    const sameMapDifferentOrder: PairRecallRound = {
      pairs: base.pairs,
      cueOrder: [1, 0],
      responseOptions: [5, 6],
    };
    expect(isNearDuplicateRound(sameMapDifferentOrder, base)).toBe(true);
  });

  it("accepts a round where any pairing changed", () => {
    const rePaired: PairRecallRound = {
      ...base,
      pairs: [
        { stimulusId: 0, responseId: 6 },
        { stimulusId: 2, responseId: 7 }, // was 5
      ],
    };
    expect(isNearDuplicateRound(rePaired, base)).toBe(false);
  });

  it("returns false when there is no previous round or the size differs", () => {
    expect(isNearDuplicateRound(base, null)).toBe(false);
    expect(
      isNearDuplicateRound(base, { ...base, pairs: base.pairs.slice(0, 1) }),
    ).toBe(false);
  });
});

describe("nextPairCount", () => {
  const normal = PAIR_RECALL_DIFFICULTY_PARAMS.normal;

  it("escalates by one on a pass, capped; holds on a failure (fixed)", () => {
    expect(nextPairCount(3, true, "normal", normal)).toBe(4);
    expect(nextPairCount(normal.maxPairCount, true, "normal", normal)).toBe(
      normal.maxPairCount,
    );
    expect(nextPairCount(4, false, "normal", normal)).toBe(4);
  });

  it("moves ±1 within bounds on adaptive", () => {
    expect(nextPairCount(3, true, "adaptive", ADAPTIVE_PARAMS)).toBe(4);
    expect(nextPairCount(3, false, "adaptive", ADAPTIVE_PARAMS)).toBe(2);
    expect(nextPairCount(ADAPTIVE_PARAMS.maxPairCount, true, "adaptive", ADAPTIVE_PARAMS)).toBe(
      ADAPTIVE_PARAMS.maxPairCount,
    );
    expect(nextPairCount(ADAPTIVE_PARAMS.minPairCount!, false, "adaptive", ADAPTIVE_PARAMS)).toBe(
      ADAPTIVE_PARAMS.minPairCount!,
    );
  });
});
