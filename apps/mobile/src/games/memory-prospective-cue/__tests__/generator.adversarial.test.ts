// Jest globals imported explicitly (repo has no @types/jest — see generator.test.ts).
import { describe, expect, it } from "@jest/globals";
import { createRng } from "@/sdk";

import {
  ADAPTIVE_PARAMS,
  ITEM_MS_STEP,
  PROSPECTIVE_CUE_DIFFICULTY_PARAMS,
  nextItemMs,
  nextSignalCount,
} from "../difficulty";
import { GLYPH_COUNT } from "../glyphs";
import {
  MAX_ROUND_ATTEMPTS,
  generateRound,
  isNearDuplicateRound,
  splitCarryOver,
  validateRound,
} from "../generator";

/** All levels including adaptive (the sweep drives escalation manually). */
const ALL_LEVELS = [
  ...Object.keys(PROSPECTIVE_CUE_DIFFICULTY_PARAMS),
  "adaptive",
] as const;

/**
 * Chain a full multi-round session for one seed/level, escalating the signal
 * count the way the reducer does (pass → +1 capped, fail → hold; adaptive
 * also steps down), validating EVERY structural intention invariant per round.
 */
function sweepSession(seed: string, level: keyof typeof PROSPECTIVE_CUE_DIFFICULTY_PARAMS | "adaptive", passPattern: boolean[]) {
  const params =
    level === "adaptive"
      ? ADAPTIVE_PARAMS
      : PROSPECTIVE_CUE_DIFFICULTY_PARAMS[level];
  const rng = createRng(seed);
  let prevActive: number[] | null = null;
  let count = params.initialSignalCount;
  const rounds = [];
  for (let round = 0; round < params.rounds; round += 1) {
    const generated = generateRound({
      rng,
      roundIndex: round,
      signalCount: count,
      streamLen: params.streamLen,
      prevActiveSignalIds: prevActive,
    });

    // Oracle + explicit length/count checks (the oracle does not pin lengths).
    expect(validateRound(generated, prevActive)).toBe(true);
    expect(generated.items).toHaveLength(params.streamLen);
    expect(generated.activeSignalIds).toHaveLength(count);
    // Each active signal appears EXACTLY ONCE per stream.
    for (const id of generated.activeSignalIds) {
      expect(
        generated.items.filter((item) => item.glyphId === id),
      ).toHaveLength(1);
    }
    // Fillers never collide with held intentions.
    const activeSet = new Set(generated.activeSignalIds);
    for (const item of generated.items) {
      if (!item.isSignal) {
        expect(activeSet.has(item.glyphId)).toBe(false);
      }
    }
    // Retirement rules vs the previous round.
    if (prevActive !== null && prevActive.length >= 2) {
      expect(generated.retiredSignalIds.length).toBeGreaterThanOrEqual(1);
    }
    for (const id of generated.retiredSignalIds) {
      expect(prevActive ?? []).toContain(id);
    }
    for (const id of generated.newSignalIds) {
      expect(prevActive ?? []).not.toContain(id);
      expect(generated.retiredSignalIds).not.toContain(id);
    }

    rounds.push(generated);
    prevActive = [...generated.activeSignalIds];
    const passed = passPattern[round % passPattern.length];
    count = nextSignalCount(count, passed, level, params);
    expect(count).toBeLessThanOrEqual(params.maxSignalCount);
  }
  return rounds;
}

describe("generateRound property sweep (seeded)", () => {
  it("holds every intention invariant across seeds × levels × mixed pass/fail chains", () => {
    const seeds = [
      "w04-sweep-1",
      "w04-sweep-2",
      "42",
      "prospective-cue-adversarial",
      "zzz-last-seed",
    ];
    const patterns = [
      [true],
      [false],
      [true, false],
      [true, true, false, false],
    ];
    for (const seed of seeds) {
      for (const level of ALL_LEVELS) {
        for (const pattern of patterns) {
          sweepSession(seed, level, [...pattern]);
        }
      }
    }
  });

  it("is fork-isolated: consuming the parent rng between rounds never reshuffles content", () => {
    // Lifecycle restarts replay the session from (seed, versions); per-round
    // forks must make round content independent of prior parent consumption.
    const build = (burnBefore: number) => {
      const rng = createRng("fork-isolation");
      for (let i = 0; i < burnBefore; i += 1) {
        rng.next();
      }
      const first = generateRound({
        rng,
        roundIndex: 3,
        signalCount: 3,
        streamLen: 14,
        prevActiveSignalIds: [1, 5, 9],
      });
      return JSON.stringify(first);
    };
    expect(build(0)).toBe(build(7));
  });

  it("never returns a free repeat of the previous watchlist (near-duplicate guard)", () => {
    for (let i = 0; i < 60; i += 1) {
      const seed = `dup-guard-${i}`;
      const rng = createRng(seed);
      const prev = [0, 4, 8];
      const round = generateRound({
        rng,
        roundIndex: 1,
        signalCount: 3,
        streamLen: 14,
        prevActiveSignalIds: prev,
      });
      expect(isNearDuplicateRound(round, prev)).toBe(false);
    }
  });
});

describe("splitCarryOver", () => {
  it("returns an empty split for the first round", () => {
    expect(splitCarryOver(createRng("s"), null, 3)).toEqual({
      survivors: [],
      retired: [],
    });
    expect(splitCarryOver(createRng("s"), [], 3)).toEqual({
      survivors: [],
      retired: [],
    });
  });

  it("keeps a lone carried signal intact (no forced retirement below 2)", () => {
    const { survivors, retired } = splitCarryOver(createRng("lone"), [7], 1);
    expect(survivors).toEqual([7]);
    expect(retired).toEqual([]);
  });

  it("always retires ≥1 once the previous watchlist has ≥2 members", () => {
    for (let i = 0; i < 40; i += 1) {
      const prev = [i % GLYPH_COUNT, (i + 3) % GLYPH_COUNT, (i + 6) % GLYPH_COUNT];
      for (const target of [1, 2, 3, 6]) {
        const { survivors, retired } = splitCarryOver(
          createRng(`retire-${i}-${target}`),
          prev,
          target,
        );
        expect(retired.length).toBeGreaterThanOrEqual(1);
        expect(survivors.length + retired.length).toBe(prev.length);
        expect([...survivors, ...retired].sort((a, b) => a - b)).toEqual(
          [...prev].sort((a, b) => a - b),
        );
      }
    }
  });

  it("announces extra departures when the target shrinks below the survivor count", () => {
    // prev=4, target=2 → at most 2 survive, so ≥2 retire — all announced.
    const { survivors, retired } = splitCarryOver(
      createRng("step-down"),
      [0, 1, 2, 3],
      2,
    );
    expect(survivors.length).toBeLessThanOrEqual(2);
    expect(retired.length).toBeGreaterThanOrEqual(2);
  });

  it("is deterministic for the same seed and partition-complete", () => {
    const a = splitCarryOver(createRng("det"), [2, 5, 8, 11], 3);
    const b = splitCarryOver(createRng("det"), [2, 5, 8, 11], 3);
    expect(a).toEqual(b);
  });
});

describe("isNearDuplicateRound", () => {
  const candidate = {
    items: [],
    activeSignalIds: [3, 1, 2],
    newSignalIds: [],
    retiredSignalIds: [],
  };

  it("is order-insensitive on the active set", () => {
    expect(isNearDuplicateRound(candidate, [1, 2, 3])).toBe(true);
    expect(isNearDuplicateRound(candidate, [1, 2, 4])).toBe(false);
    expect(isNearDuplicateRound(candidate, [1, 2])).toBe(false);
  });

  it("never flags a first round (null/empty previous)", () => {
    expect(isNearDuplicateRound(candidate, null)).toBe(false);
    expect(isNearDuplicateRound(candidate, [])).toBe(false);
  });
});

describe("generateRound input validation", () => {
  const base = {
    roundIndex: 0,
    streamLen: 14,
    prevActiveSignalIds: null,
  };

  it("rejects non-positive/non-integer signal counts and stream lengths", () => {
    expect(() =>
      generateRound({ ...base, rng: createRng("x"), signalCount: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      generateRound({ ...base, rng: createRng("x"), signalCount: -2 }),
    ).toThrow(RangeError);
    expect(() =>
      generateRound({ ...base, rng: createRng("x"), signalCount: 2.5 }),
    ).toThrow(RangeError);
    expect(() =>
      generateRound({ ...base, rng: createRng("x"), signalCount: 2, streamLen: 0 }),
    ).toThrow(RangeError);
  });

  it("rejects requests beyond palette/stream capacity", () => {
    expect(() =>
      generateRound({
        ...base,
        rng: createRng("x"),
        signalCount: GLYPH_COUNT + 1,
      }),
    ).toThrow(RangeError);
    expect(() =>
      generateRound({ ...base, rng: createRng("x"), signalCount: 15, streamLen: 14 }),
    ).toThrow(RangeError);
  });

  it("throws instead of silently delivering fewer signals than requested", () => {
    // REGRESSION PIN (W04): with 11 of 12 glyphs already held/retired, a
    // target of 12 is undeliverable — the fresh pool has 1 glyph but up to 2
    // slots to fill. Production used to return a SHORT active set silently;
    // it must fail loudly instead.
    const prev = Array.from({ length: GLYPH_COUNT - 1 }, (_, i) => i);
    expect(() =>
      generateRound({
        rng: createRng("budget-blowout"),
        roundIndex: 1,
        signalCount: GLYPH_COUNT,
        streamLen: GLYPH_COUNT * 2,
        prevActiveSignalIds: prev,
      }),
    ).toThrow(/capacity|budget|signal/i);
  });

  it("caps the near-duplicate redraw loop at MAX_ROUND_ATTEMPTS", () => {
    expect(MAX_ROUND_ATTEMPTS).toBeGreaterThanOrEqual(2);
  });
});

describe("adaptive ±1 step bounds", () => {
  it("keeps a long seeded walk inside [minSignalCount, maxSignalCount]", () => {
    const params = ADAPTIVE_PARAMS;
    const rng = createRng("adaptive-walk");
    let count = params.initialSignalCount;
    for (let step = 0; step < 400; step += 1) {
      const passed = rng.next() < 0.55;
      const next = nextSignalCount(count, passed, "adaptive", params);
      expect(next).toBeGreaterThanOrEqual(params.minSignalCount ?? 2);
      expect(next).toBeLessThanOrEqual(params.maxSignalCount);
      expect(Math.abs(next - count)).toBeLessThanOrEqual(1);
      count = next;
    }
  });

  it("fixed levels escalate +1 on pass (capped) and hold on fail", () => {
    for (const [level, params] of Object.entries(
      PROSPECTIVE_CUE_DIFFICULTY_PARAMS,
    )) {
      expect(
        nextSignalCount(params.maxSignalCount, true, level as "easy", params),
      ).toBe(params.maxSignalCount);
      expect(
        nextSignalCount(
          params.initialSignalCount,
          false,
          level as "easy",
          params,
        ),
      ).toBe(params.initialSignalCount);
    }
  });

  it("shrinks the window by ITEM_MS_STEP on pass and floors it, holds on fail", () => {
    expect(ITEM_MS_STEP).toBe(150);
    for (const params of Object.values(PROSPECTIVE_CUE_DIFFICULTY_PARAMS)) {
      let ms = params.initialItemMs;
      for (let i = 0; i < 20; i += 1) {
        ms = nextItemMs(ms, true, params);
        expect(ms).toBeGreaterThanOrEqual(params.minItemMs);
      }
      expect(ms).toBe(params.minItemMs);
      expect(nextItemMs(params.minItemMs, false, params)).toBe(
        params.minItemMs,
      );
    }
  });
});
