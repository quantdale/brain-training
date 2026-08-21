// Jest globals imported explicitly (repo has no @types/jest).
//
// Session result building, persistence seam, seed/version mapping, and the
// normalization contract for the Cue Keeper game — including division guards,
// hostile inputs, and the failure path of the atomic persister.
import { describe, expect, it, jest } from "@jest/globals";

import { resolveProspectiveCueDifficulty } from "../difficulty";
import {
  clamp01,
  normalizeProspectiveCueResult,
} from "../scoring";
import {
  buildProspectiveCueRawResult,
  buildSessionRecord,
  persistProspectiveCueSession,
  seedToNumber,
  versionToNumber,
} from "../session";
import type { SessionPersistence } from "../session";
import {
  INITIAL_STATS,
  createInitialProspectiveCueState,
} from "../types";
import type { ProspectiveCueRawResult, ProspectiveCueStats } from "../types";

const PARAMS = {
  initialSignalCount: 2,
  maxSignalCount: 4,
  initialItemMs: 1900,
  minItemMs: 1300,
  streamLen: 14,
  rounds: 5,
};

function stats(overrides: Partial<ProspectiveCueStats>): ProspectiveCueStats {
  return { ...INITIAL_STATS, ...overrides };
}

function rawInput(
  overrides: Partial<Parameters<typeof buildProspectiveCueRawResult>[0]> = {},
): Parameters<typeof buildProspectiveCueRawResult>[0] {
  return {
    gameVersion: "1.2.3",
    generatorVersion: "1.0.0",
    scoringVersion: "1.0.0",
    difficulty: "normal",
    params: { ...PARAMS },
    challengeRating: 0.5,
    finalItemMs: 1600,
    seed: "session-seed",
    stats: stats({}),
    forced: false,
    startedAtMs: 1_000,
    activeDurationMs: 45_000,
    pausedDurationMs: 5_000,
    ...overrides,
  };
}

describe("buildProspectiveCueRawResult", () => {
  it("maps stats into accuracies and carries the full reproducibility envelope", () => {
    const raw = buildProspectiveCueRawResult(
      rawInput({
        stats: stats({
          totalSignals: 10,
          signalHits: 8,
          totalItems: 60,
          correctResponses: 54,
          score: 900,
          roundsPlayed: 4,
          roundsPassed: 3,
          bestStreak: 2,
        }),
      }),
    );
    expect(raw.accuracy).toBeCloseTo(54 / 60);
    expect(raw.signalAccuracy).toBeCloseTo(8 / 10);
    expect(raw.score).toBe(900);
    expect(raw.totalRounds).toBe(PARAMS.rounds);
    expect(raw.itemMs).toBe(1600);
    expect(raw.seed).toBe("session-seed");
    expect(raw.gameVersion).toBe("1.2.3");
    expect(raw.generatorVersion).toBe("1.0.0");
    expect(raw.scoringVersion).toBe("1.0.0");
    expect(raw.forced).toBe(false);
    expect(raw.initialSignalCount).toBe(PARAMS.initialSignalCount);
    expect(raw.maxSignalCount).toBe(PARAMS.maxSignalCount);
    // Reproducibility metadata travels with the result.
    expect(raw.diagnosticMetadata.gameId).toBe("memory-prospective-cue");
    expect((raw.generatorInfo as Record<string, unknown>).streamLen).toBe(
      PARAMS.streamLen,
    );
  });

  it("guards empty-session divisions to 0 (never NaN)", () => {
    const raw = buildProspectiveCueRawResult(rawInput());
    expect(raw.accuracy).toBe(0);
    expect(raw.signalAccuracy).toBe(0);
    expect(Number.isNaN(raw.accuracy)).toBe(false);
  });

  it("marks forced QA sessions", () => {
    expect(buildProspectiveCueRawResult(rawInput({ forced: true })).forced).toBe(
      true,
    );
  });
});

describe("normalization contract", () => {
  const context = {
    gameId: "memory-prospective-cue",
    difficulty: "normal" as const,
    durationMs: 30_000,
  };
  const base = buildProspectiveCueRawResult(rawInput());

  it("implements value = clamp01(signalAccuracy × (0.6 + 0.4 × accuracy))", () => {
    const makeRaw = (sigAcc: number, acc: number) => ({
      ...base,
      signalAccuracy: sigAcc,
      accuracy: acc,
    });
    // Exact interior points.
    expect(
      normalizeProspectiveCueResult(makeRaw(0.8, 0.5), context).value,
    ).toBeCloseTo(0.8 * (0.6 + 0.4 * 0.5));
    expect(
      normalizeProspectiveCueResult(makeRaw(1, 1), context).value,
    ).toBe(1);
    expect(
      normalizeProspectiveCueResult(makeRaw(0, 1), context).value,
    ).toBe(0);
    expect(
      normalizeProspectiveCueResult(makeRaw(1, 0), context).value,
    ).toBeCloseTo(0.6);
  });

  it("clamps hostile out-of-range inputs into [0,1]", () => {
    const over = normalizeProspectiveCueResult(
      { ...base, signalAccuracy: 1.5, accuracy: 1 },
      context,
    );
    expect(over.value).toBe(1);
    expect(over.scale).toBe("0..1");
    const under = normalizeProspectiveCueResult(
      { ...base, signalAccuracy: -2, accuracy: 0.5 },
      context,
    );
    expect(under.value).toBe(0);
  });

  it("throws on non-finite inputs instead of emitting a broken rating", () => {
    expect(() =>
      normalizeProspectiveCueResult(
        { ...base, signalAccuracy: Number.NaN },
        context,
      ),
    ).toThrow(RangeError);
    expect(() =>
      normalizeProspectiveCueResult(
        { ...base, signalAccuracy: Number.POSITIVE_INFINITY },
        context,
      ),
    ).toThrow(RangeError);
    expect(() => clamp01(Number.NaN)).toThrow(RangeError);
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
  });

  it("returns a copy of the raw result (callers can't mutate the record)", () => {
    const raw = { ...base };
    const normalized = normalizeProspectiveCueResult(raw, context);
    expect(normalized.raw).not.toBe(raw);
    expect(normalized.raw).toEqual(raw);
  });
});

describe("seedToNumber", () => {
  it("keeps pure-numeric seeds verbatim within the safe range", () => {
    expect(seedToNumber("42")).toBe(42);
    expect(seedToNumber("0")).toBe(0);
    expect(seedToNumber(String(Number.MAX_SAFE_INTEGER))).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it("hashes non-numeric and unsafe-numeric seeds with pinned FNV-1a values", () => {
    // Pinned vectors (32-bit FNV-1a, ECMA-safe integer math) — changing the
    // hash silently breaks historical session-seed lookups.
    expect(seedToNumber("abc")).toBe(440920331);
    expect(seedToNumber("cue-keeper-seed")).toBe(3809702337);
    expect(seedToNumber("9007199254740993")).toBeLessThanOrEqual(0xffffffff);
  });

  it("is deterministic across engines-safe math (uint32 domain)", () => {
    for (let i = 0; i < 50; i += 1) {
      const value = seedToNumber(`walk-${i}`);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0xffffffff);
      expect(seedToNumber(`walk-${i}`)).toBe(value);
    }
  });
});

describe("versionToNumber", () => {
  it("packs semantic versions as major*1e6 + minor*1e3 + patch", () => {
    expect(versionToNumber("1.0.0")).toBe(1_000_000);
    expect(versionToNumber("2.3.7")).toBe(2_003_007);
    expect(versionToNumber("0.1.0")).toBe(1_000);
  });

  it("rejects null/undefined versions loudly", () => {
    expect(() => versionToNumber(null)).toThrow(/null/);
    expect(() =>
      versionToNumber(undefined as unknown as string),
    ).toThrow();
  });
});

describe("buildSessionRecord", () => {
  it("maps the raw result onto the db record with numeric versions/seeds", () => {
    const profile = resolveProspectiveCueDifficulty("normal");
    const rawResult = buildProspectiveCueRawResult(rawInput());
    const record = buildSessionRecord({
      sessionId: "sess-42",
      rawResult,
      difficulty: profile,
      normalized: { value: 0.75, scale: "0..1", raw: rawResult },
      xp: 120,
      startedAtMs: 1_000,
      completedAtMs: 46_000,
      activeDurationMs: 45_000,
    });
    expect(record.id).toBe("sess-42");
    expect(record.gameId).toBe("memory-prospective-cue");
    expect(record.gameVersion).toBe(1_002_003);
    expect(record.generatorVersion).toBe(1_000_000);
    expect(record.scoringVersion).toBe(1_000_000);
    expect(record.seed).toBe(seedToNumber("session-seed"));
    expect(record.difficulty.level).toBe(profile.level);
    expect(record.difficulty.challengeRating).toBe(profile.challengeRating);
    expect(record.normalizedResult).toBe(0.75);
    expect(record.xp).toBe(120);
    expect(record.startedAt).toBe(1_000);
    expect(record.completedAt).toBe(46_000);
    expect(record.durationMs).toBe(45_000);
  });

  it("deep-copies difficulty parameters (later mutation cannot corrupt records)", () => {
    const profile = resolveProspectiveCueDifficulty("adaptive");
    const rawResult = buildProspectiveCueRawResult(
      rawInput({ difficulty: "adaptive" }),
    );
    const record = buildSessionRecord({
      sessionId: "s",
      rawResult,
      difficulty: profile,
      normalized: { value: 0.5, scale: "0..1", raw: rawResult },
      xp: 0,
      startedAtMs: 0,
      completedAtMs: 0,
      activeDurationMs: 0,
    });
    (record.difficulty.parameters as Record<string, unknown>).streamLen = 9999;
    expect(
      (profile.parameters as Record<string, unknown>).streamLen,
    ).not.toBe(9999);
  });
});

describe("persistProspectiveCueSession", () => {
  function makeRecord() {
    const rawResult = buildProspectiveCueRawResult(rawInput());
    return buildSessionRecord({
      sessionId: "persist-me",
      rawResult,
      difficulty: resolveProspectiveCueDifficulty("easy"),
      normalized: { value: 0.6, scale: "0..1", raw: rawResult },
      xp: 40,
      startedAtMs: 0,
      completedAtMs: 1,
      activeDurationMs: 1,
    });
  }

  it("returns the completion outcome on success", async () => {
    const outcome = { ok: true as const };
    const persister: SessionPersistence = {
      completeSession: async () =>
        ({
          session: makeRecord(),
          ledgerEntry: null,
          balance: 0,
          completionOutcome: undefined,
          ...outcome,
        }) as unknown as Awaited<
          ReturnType<SessionPersistence["completeSession"]>
        >,
    };
    const result = await persistProspectiveCueSession(makeRecord(), persister);
    expect(result.ok).toBe(true);
  });

  it("converts persistence failures into { ok:false } without throwing", async () => {
    const errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      const boom = new Error("disk on fire");
      const persister: SessionPersistence = {
        completeSession: async () => {
          throw boom;
        },
      };
      const result = await persistProspectiveCueSession(makeRecord(), persister);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(boom);
      }
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("also survives synchronous throws from the persister", async () => {
    const errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      const persister: SessionPersistence = {
        completeSession: () => {
          throw new Error("sync explosion");
        },
      };
      const result = await persistProspectiveCueSession(makeRecord(), persister);
      expect(result.ok).toBe(false);
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe("initial state sanity", () => {
  it("starts clean at intro with normal preselected", () => {
    const state = createInitialProspectiveCueState();
    expect(state.phase).toBe("intro");
    expect(state.difficulty).toBe("normal");
    expect(state.stats).toEqual(INITIAL_STATS);
    expect(state.persistState).toBe("idle");
    expect(state.tutorialOpen).toBe(false);
  });
});
