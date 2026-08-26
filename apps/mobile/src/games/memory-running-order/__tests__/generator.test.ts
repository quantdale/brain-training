// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";
import { createRng } from "@/sdk";

import {
  MAX_STREAM_ATTEMPTS,
  MIN_TARGET_HAMMING_DISTANCE,
  generateStream,
  isNearDuplicateTarget,
  streamTarget,
  targetDistance,
} from "../generator";
import { SYMBOL_COUNT } from "../symbols";

/** Full deterministic session mirror: rounds with escalating recall length. */
function fullSession(
  seed: string,
  streamLen: number,
  startRecall: number,
  rounds: number,
): number[][] {
  const rng = createRng(seed);
  const targets: number[][] = [];
  let recall = startRecall;
  for (let round = 0; round < rounds; round += 1) {
    const stream = generateStream({
      rng,
      roundIndex: round,
      streamLen,
      recallLength: recall,
      prevTarget: targets.length > 0 ? targets[targets.length - 1] : null,
    });
    targets.push(streamTarget(stream, recall));
    recall = Math.min(streamLen, recall + 1);
  }
  return targets;
}

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

  it("is deterministic across a full multi-round session", () => {
    expect(fullSession("det-session", 6, 3, 6)).toEqual(
      fullSession("det-session", 6, 3, 6),
    );
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
        expect(targetDistance(target, prevTarget)).toBeGreaterThanOrEqual(
          MIN_TARGET_HAMMING_DISTANCE,
        );
      }
      prevTarget = target;
    }
  });

  it("keeps consecutive targets at Hamming distance >= 2 across seeds and shapes", () => {
    // (streamLen, startRecall, rounds) spans the easy/normal/expert escalations.
    const shapes: [number, number, number][] = [
      [4, 2, 5],
      [6, 3, 6],
      [8, 4, 7],
    ];
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const [streamLen, startRecall, rounds] of shapes) {
        const session = fullSession(String(seed), streamLen, startRecall, rounds);
        for (let round = 1; round < session.length; round += 1) {
          expect(
            targetDistance(session[round], session[round - 1]),
          ).toBeGreaterThanOrEqual(MIN_TARGET_HAMMING_DISTANCE);
        }
      }
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
  it("flags trailing targets closer than MIN_TARGET_HAMMING_DISTANCE", () => {
    expect(isNearDuplicateTarget([1, 2], null)).toBe(false);
    // Identical and one-position-off windows are both coasting material.
    expect(isNearDuplicateTarget([1, 2], [1, 2])).toBe(true);
    expect(isNearDuplicateTarget([1, 2], [1, 3])).toBe(true);
    // Both positions differ: genuinely new material.
    expect(isNearDuplicateTarget([1, 2], [2, 1])).toBe(false);
    expect(isNearDuplicateTarget([1, 2], [3, 4])).toBe(false);
    // A one-symbol window growth counts toward the distance — recalling a
    // longer window that shares the previous answer as its prefix is a free ride.
    expect(isNearDuplicateTarget([1, 2, 3], [1, 2])).toBe(true);
    expect(isNearDuplicateTarget([1, 2, 3], [4, 5, 6])).toBe(false);
  });

  it("never flags short (<2 symbol) previous windows", () => {
    expect(isNearDuplicateTarget([5], [5])).toBe(false);
  });
});

describe("targetDistance", () => {
  it("counts length difference plus positional differences", () => {
    expect(targetDistance([1, 2], null)).toBe(Number.POSITIVE_INFINITY);
    expect(targetDistance([1, 2], [1, 2])).toBe(0);
    expect(targetDistance([1, 2], [1, 3])).toBe(1);
    expect(targetDistance([1, 2], [2, 1])).toBe(2);
    expect(targetDistance([1, 2], [1, 2, 3])).toBe(1);
    expect(targetDistance([1, 2], [3, 4, 5])).toBe(3);
  });
});

describe("MAX_STREAM_ATTEMPTS", () => {
  it("bounds the re-draw budget deterministically", () => {
    expect(MAX_STREAM_ATTEMPTS).toBeGreaterThan(0);
  });
});
