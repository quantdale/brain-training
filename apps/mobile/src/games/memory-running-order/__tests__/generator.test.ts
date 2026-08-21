// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";
import { createRng } from "@/sdk";

import {
  MAX_STREAM_ATTEMPTS,
  generateStream,
  isNearDuplicateTarget,
  streamTarget,
} from "../generator";
import { SYMBOL_COUNT } from "../symbols";

describe("generateStream", () => {
  it("produces a full stream of valid symbol ids", () => {
    const stream = generateStream({
      rng: createRng("gen-1"),
      roundIndex: 0,
      streamLen: 4,
      recallLength: 3,
      prevTarget: null,
    });
    expect(stream).toHaveLength(4);
    for (const id of stream) {
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThan(SYMBOL_COUNT);
    }
  });

  it("is deterministic for the same seed + round fork", () => {
    const make = () =>
      generateStream({
        rng: createRng("det"),
        roundIndex: 2,
        streamLen: 6,
        recallLength: 3,
        prevTarget: null,
      });
    expect(make()).toEqual(make());
  });

  it("diverges for different seeds", () => {
    const a = generateStream({
      rng: createRng("seed-A"),
      roundIndex: 0,
      streamLen: 8,
      recallLength: 4,
      prevTarget: null,
    });
    const b = generateStream({
      rng: createRng("seed-B"),
      roundIndex: 0,
      streamLen: 8,
      recallLength: 4,
      prevTarget: null,
    });
    expect(a).not.toEqual(b);
  });

  it("never repeats the previous round's trailing target", () => {
    // Consecutive rounds with the same recall length must not let the player
    // coast on the previous answer.
    let prevTarget: readonly number[] | null = null;
    for (let round = 0; round < 8; round += 1) {
      const stream = generateStream({
        rng: createRng("near"),
        roundIndex: round,
        streamLen: 5,
        recallLength: 3,
        prevTarget,
      });
      const target = streamTarget(stream, 3);
      if (prevTarget !== null) {
        expect(target).not.toEqual(prevTarget);
      }
      prevTarget = target;
    }
  });

  it("throws on invalid streamLen / recallLength", () => {
    const make =
      (streamLen: number, recallLength: number) =>
      (): number[] =>
        generateStream({
          rng: createRng("x"),
          roundIndex: 0,
          streamLen,
          recallLength,
          prevTarget: null,
        });
    expect(make(0, 1)).toThrow();
    expect(make(4, 0)).toThrow();
    expect(make(4, 5)).toThrow();
  });
});

describe("streamTarget", () => {
  it("returns the trailing recallLength symbols in order", () => {
    expect(streamTarget([0, 1, 2, 3], 2)).toEqual([2, 3]);
    expect(streamTarget([0, 1, 2], 3)).toEqual([0, 1, 2]);
    expect(streamTarget([5, 4], 2)).toEqual([5, 4]);
  });
});

describe("isNearDuplicateTarget", () => {
  it("flags only identical trailing targets (order matters)", () => {
    expect(isNearDuplicateTarget([1, 2], null)).toBe(false);
    expect(isNearDuplicateTarget([1, 2], [1, 2])).toBe(true);
    expect(isNearDuplicateTarget([1, 2], [2, 1])).toBe(false);
    expect(isNearDuplicateTarget([1, 2], [1, 2, 3])).toBe(false);
  });
});

describe("MAX_STREAM_ATTEMPTS", () => {
  it("bounds the re-draw budget deterministically", () => {
    expect(MAX_STREAM_ATTEMPTS).toBeGreaterThan(0);
  });
});
