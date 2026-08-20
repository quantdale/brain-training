// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";
import { createRng } from "@/sdk";

import {
  generateTargetCells,
  isNearDuplicateSet,
  targetSetDistance,
} from "../generator";

describe("generateTargetCells", () => {
  it("produces exactly targetCount distinct cells within the grid", () => {
    const rng = createRng("gen-1");
    const cells = generateTargetCells({
      rng,
      roundIndex: 0,
      gridSize: 16,
      targetCount: 5,
      prevTargets: null,
    });
    expect(cells).toHaveLength(5);
    expect(new Set(cells).size).toBe(5);
    for (const c of cells) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(16);
    }
  });

  it("is deterministic for the same seed + round", () => {
    const a = generateTargetCells({
      rng: createRng("det"),
      roundIndex: 2,
      gridSize: 9,
      targetCount: 3,
      prevTargets: null,
    });
    const b = generateTargetCells({
      rng: createRng("det"),
      roundIndex: 2,
      gridSize: 9,
      targetCount: 3,
      prevTargets: null,
    });
    expect(a).toEqual(b);
    // Returns a sorted copy; the original indices array is never mutated.
    expect(a).toEqual([...a].sort((x, y) => x - y));
  });

  it("diverges for different seeds", () => {
    const a = generateTargetCells({
      rng: createRng("seed-A"),
      roundIndex: 0,
      gridSize: 16,
      targetCount: 4,
      prevTargets: null,
    });
    const b = generateTargetCells({
      rng: createRng("seed-B"),
      roundIndex: 0,
      gridSize: 16,
      targetCount: 4,
      prevTargets: null,
    });
    expect(a).not.toEqual(b);
  });

  it("avoids near-duplicate target sets between consecutive rounds (distance >= 2)", () => {
    const gridSize = 25;
    const targetCount = 8;
    let prev = generateTargetCells({
      rng: createRng("near"),
      roundIndex: 0,
      gridSize,
      targetCount,
      prevTargets: null,
    });
    for (let round = 1; round < 6; round += 1) {
      const cells = generateTargetCells({
        rng: createRng("near"),
        roundIndex: round,
        gridSize,
        targetCount,
        prevTargets: prev,
      });
      const distance = targetSetDistance(cells, prev);
      expect(distance).toBeGreaterThanOrEqual(2);
      prev = cells;
    }
  });

  it("throws on invalid gridSize / targetCount", () => {
    expect(() =>
      generateTargetCells({
        rng: createRng("x"),
        roundIndex: 0,
        gridSize: 0,
        targetCount: 1,
        prevTargets: null,
      }),
    ).toThrow();
    expect(() =>
      generateTargetCells({
        rng: createRng("x"),
        roundIndex: 0,
        gridSize: 9,
        targetCount: 10,
        prevTargets: null,
      }),
    ).toThrow();
    expect(() =>
      generateTargetCells({
        rng: createRng("x"),
        roundIndex: 0,
        gridSize: 9,
        targetCount: 0,
        prevTargets: null,
      }),
    ).toThrow();
  });
});

describe("targetSetDistance / isNearDuplicateSet", () => {
  it("counts symmetric set difference", () => {
    expect(targetSetDistance([1, 2, 3], [1, 2, 4])).toBe(2);
    expect(targetSetDistance([1, 2], null)).toBe(Number.POSITIVE_INFINITY);
    expect(targetSetDistance([1, 2], [1, 2])).toBe(0);
  });

  it("flags only confusable (too-similar) sets as near-duplicates", () => {
    expect(isNearDuplicateSet([1, 2, 3], [1, 2, 4])).toBe(false); // distance 2 is >= MIN 2, not confusable
    expect(isNearDuplicateSet([1, 2, 3], [1, 2, 3])).toBe(true); // identical
    expect(isNearDuplicateSet([1, 2, 3], [1, 2, 5])).toBe(false); // distance 2 is >= MIN 2, not confusable
    expect(isNearDuplicateSet([1, 2, 3], [4, 5, 6])).toBe(false);
    expect(isNearDuplicateSet([1, 2], null)).toBe(false);
    expect(isNearDuplicateSet([1], [2])).toBe(false); // prev length < 2
  });
});
