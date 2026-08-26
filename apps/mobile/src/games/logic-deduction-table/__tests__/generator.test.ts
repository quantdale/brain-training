// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";
import { createRng } from "@/sdk";

import {
  MAX_GENERATION_ATTEMPTS,
  generateRound,
  validateGeneratedRound,
} from "../generator";
import { answerSet } from "../solver";
import { LOGIC_DEDUCTION_DIFFICULTY_PARAMS } from "../difficulty";
import type {
  LogicDeductionDifficultyParams,
  LogicDeductionRound,
} from "../types";

function roundFor(
  seed: string,
  roundIndex: number,
  params: LogicDeductionDifficultyParams,
  prev: LogicDeductionRound | null = null,
): LogicDeductionRound {
  return generateRound({
    rng: createRng(seed),
    roundIndex,
    params,
    prevRound: prev,
  });
}

describe("generateRound", () => {
  it("produces a valid, uniquely solvable round for every fixed level", () => {
    for (const [level, params] of Object.entries(
      LOGIC_DEDUCTION_DIFFICULTY_PARAMS,
    )) {
      const round = roundFor(`valid-${level}`, 0, params);
      expect(validateGeneratedRound(round)).toBe(true);
      expect(round.entityCount).toBe(params.entityCount);
      expect(round.entities).toHaveLength(params.entityCount);
      // The answer is always among the options and correctly indexed.
      expect(round.options).toContain(round.answer);
      expect(round.options[round.correctIndex]).toBe(round.answer);
      // Options are the question attribute's full domain (shuffled).
      const attr = round.attributes.find(
        (a) => a.id === round.question.attribute,
      );
      expect(attr).toBeDefined();
      expect(round.options).toHaveLength(attr!.values.length);
      expect([...round.options].sort()).toEqual([...attr!.values].sort());
      // Every round ships at least one clue.
      expect(round.clues.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("is deterministic for the same seed + round index", () => {
    const params = LOGIC_DEDUCTION_DIFFICULTY_PARAMS.normal;
    const a = roundFor("det", 2, params);
    const b = roundFor("det", 2, params);
    expect(a).toEqual(b);
  });

  it("diverges for different seeds", () => {
    const params = LOGIC_DEDUCTION_DIFFICULTY_PARAMS.normal;
    const a = roundFor("seed-A", 0, params);
    const b = roundFor("seed-B", 0, params);
    expect(a).not.toEqual(b);
  });

  it("generates distinct consecutive rounds (near-duplicate avoidance)", () => {
    const params = LOGIC_DEDUCTION_DIFFICULTY_PARAMS.easy;
    let prev = roundFor("chain", 0, params);
    for (let i = 1; i < 5; i += 1) {
      const next = roundFor("chain", i, params, prev);
      expect(validateGeneratedRound(next)).toBe(true);
      // The retried question never repeats the previous entity+attribute pair.
      const sameQuestion =
        next.question.entity === prev.question.entity &&
        next.question.attribute === prev.question.attribute;
      expect(sameQuestion).toBe(false);
      prev = next;
    }
  });

  it("uses the attempt salt so later rounds differ under one rng", () => {
    // Mirrors the reducer: one rng per session, forked per round/attempt.
    const params = LOGIC_DEDUCTION_DIFFICULTY_PARAMS.hard;
    const r0 = roundFor("salt", 0, params);
    const r1 = roundFor("salt", 1, params);
    expect(r0).not.toEqual(r1);
  });

  it("caps the outer retry loop", () => {
    expect(MAX_GENERATION_ATTEMPTS).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_GENERATION_ATTEMPTS)).toBe(true);
  });
});

describe("validateGeneratedRound", () => {
  const params = LOGIC_DEDUCTION_DIFFICULTY_PARAMS.easy;

  it("accepts a generator-produced round", () => {
    expect(validateGeneratedRound(roundFor("ok", 0, params))).toBe(true);
  });

  it("rejects empty options / broken correctIndex mapping", () => {
    const base = roundFor("bad", 0, params);
    expect(
      validateGeneratedRound({ ...base, options: [], correctIndex: -1 }),
    ).toBe(false);
    expect(
      validateGeneratedRound({
        ...base,
        options: [...base.options],
        correctIndex: -1,
      }),
    ).toBe(false);
    const swapped = [...base.options];
    const other = swapped.findIndex((v) => v !== base.answer);
    swapped[base.correctIndex] = swapped[other];
    swapped[other] = base.answer;
    expect(
      validateGeneratedRound({
        ...base,
        options: swapped,
        correctIndex: base.correctIndex,
      }),
    ).toBe(false);
  });

  it("rejects an ambiguous round (clues stripped)", () => {
    const base = roundFor("ambig", 0, params);
    expect(base.clues.length).toBeGreaterThanOrEqual(1);
    expect(validateGeneratedRound({ ...base, clues: [] })).toBe(false);
  });
});

describe("anti-giveaway clue filter (campaign 014)", () => {
  // A shipped clue must never ALONE determine the asked cell: the direct
  // equality naming the asked entity+attribute (or, on tiny domains, an
  // exclusion collapsing it to one value) converts deduction into reading.
  function aloneDetermines(round: LogicDeductionRound): boolean {
    return round.clues.some(
      (clue) => answerSet({ ...round, clues: [clue] }, round.question).size <= 1,
    );
  }

  it("ships no lone-giveaway clue across all levels and many seeds", () => {
    for (const [level, params] of Object.entries(LOGIC_DEDUCTION_DIFFICULTY_PARAMS)) {
      for (let seed = 1; seed <= 40; seed += 1) {
        const round = roundFor(`giveaway-${level}-${seed}`, seed % 3, params);
        expect(validateGeneratedRound(round)).toBe(true);
        expect(aloneDetermines(round)).toBe(false);
      }
    }
  });

  it("keeps uniqueness proven while allowing fewer than clueCount clues", () => {
    for (const [level, params] of Object.entries(LOGIC_DEDUCTION_DIFFICULTY_PARAMS)) {
      for (let seed = 1; seed <= 10; seed += 1) {
        const round = roundFor(`pad-${level}-${seed}`, 0, params);
        expect(validateGeneratedRound(round)).toBe(true);
        // The safe-pool pad may legitimately exhaust before clueCount; it
        // never overshoots, and uniqueness stays solver-proven either way.
        expect(round.clues.length).toBeLessThanOrEqual(params.clueCount);
      }
    }
  });

  it("stays deterministic under the filter", () => {
    for (const [level, params] of Object.entries(LOGIC_DEDUCTION_DIFFICULTY_PARAMS)) {
      const a = roundFor(`filter-det-${level}`, 2, params);
      const b = roundFor(`filter-det-${level}`, 2, params);
      expect(a).toEqual(b);
    }
  });
});
