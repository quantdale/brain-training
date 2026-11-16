// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it, jest } from "@jest/globals";
import { RNG_ALGORITHM_VERSION } from "@/sdk";
import type { DifficultyProfile, GameRawResult } from "@/sdk";
import { expectConsoleNoise } from "@/test-utils";

import {
  LOGIC_DEDUCTION_DIFFICULTY_PARAMS,
  resolveLogicDeductionDifficulty,
} from "../difficulty";
import { createInitialLogicDeductionState, logicDeductionReducer } from "../reducer";
import { normalizeLogicDeductionResult } from "../scoring";
import { INITIAL_STATS } from "../types";
import type { LogicDeductionRawResult } from "../types";
import {
  buildLogicDeductionRawResult,
  buildSessionRecord,
  persistLogicDeductionSession,
  seedToNumber,
} from "../session";
import type { SessionPersistence } from "../session";
import { SCORING_VERSION, versionToNumber } from "../versions";

function buildRaw(overrides: Partial<Parameters<typeof buildLogicDeductionRawResult>[0]> = {}) {
  return buildLogicDeductionRawResult({
    gameVersion: "1.0.0",
    generatorVersion: "1.0.0",
    scoringVersion: SCORING_VERSION,
    difficulty: "normal",
    params: LOGIC_DEDUCTION_DIFFICULTY_PARAMS.normal,
    challengeRating: 0.5,
    seed: "seed-x",
    stats: { ...INITIAL_STATS },
    outcomes: [],
    forced: false,
    startedAtMs: 100,
    activeDurationMs: 1000,
    pausedDurationMs: 0,
    ...overrides,
  });
}

describe("buildLogicDeductionRawResult", () => {
  it("carries the full reproducibility envelope", () => {
    const raw = buildRaw();
    expect(raw.gameVersion).toBe("1.0.0");
    expect(raw.generatorVersion).toBe("1.0.0");
    expect(raw.scoringVersion).toBe(SCORING_VERSION);
    expect(raw.seed).toBe("seed-x");
    expect(raw.difficulty).toBe("normal");
    expect(raw.entityCount).toBe(3);
    expect(raw.attributeCount).toBe(3);
    expect(raw.clueCount).toBe(6);
    expect(raw.totalRounds).toBe(6);
    expect(raw.challengeRating).toBe(0.5);
    expect(raw.forced).toBe(false);
    expect(raw.generatorInfo.rngAlgorithm).toBe(RNG_ALGORITHM_VERSION);
    expect(raw.generatorInfo.entityCount).toBe(3);
    expect(raw.diagnosticMetadata.gameId).toBe("logic-deduction-table");
    expect(raw.diagnosticMetadata.seed).toBe("seed-x");
    expect(raw.diagnosticMetadata.difficulty).toBe("normal");
  });

  it("computes accuracy from rounds correct/played", () => {
    const raw = buildRaw({
      stats: { ...INITIAL_STATS, roundsPlayed: 4, roundsCorrect: 3 },
    });
    expect(raw.accuracy).toBe(0.75);
    expect(raw.roundsPlayed).toBe(4);
    expect(raw.roundsCorrect).toBe(3);
  });

  it("marks forced sessions", () => {
    expect(buildRaw({ forced: true }).forced).toBe(true);
  });
});

describe("seedToNumber", () => {
  it("keeps numeric seeds verbatim when safe", () => {
    expect(seedToNumber("12345")).toBe(12345);
    expect(seedToNumber(String(Number.MAX_SAFE_INTEGER))).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });
  it("hashes non-numeric seeds deterministically into uint32", () => {
    const a = seedToNumber("logic-deduction-table-seed");
    const b = seedToNumber("logic-deduction-table-seed");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(a)).toBe(true);
  });
  it("hashes differently for different seeds", () => {
    expect(seedToNumber("a")).not.toBe(seedToNumber("b"));
  });
});

describe("versionToNumber", () => {
  it('maps semver to major*1e6 + minor*1e3 + patch and ', () => { // 074: `GameDefinition.generatorVersion` is `string | null` (documented as
  // `null` for non-procedural games) and the db column is `NOT NULL`, so an
  // absent version now packs to the documented sentinel instead of throwing.
  // Throwing would have crashed the session-persist path the first time a
  // genuinely non-procedural game shipped.
  expect(versionToNumber(null)).toBe(0);
  expect(versionToNumber(undefined)).toBe(0);
  expect(versionToNumber('')).toBe(0); });
});

describe("buildSessionRecord", () => {
  it("maps the outcome onto the persistence record shape", () => {
    const raw = buildRaw({ seed: "rec-seed" });
    const profile = resolveLogicDeductionDifficulty("normal");
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
    expect(record.gameId).toBe("logic-deduction-table");
    expect(record.gameVersion).toBe(1_000_000);
    expect(record.generatorVersion).toBe(1_000_000);
    expect(record.scoringVersion).toBe(versionToNumber(SCORING_VERSION));
    expect(record.seed).toBe(seedToNumber("rec-seed"));
    // `GameSessionRecord.difficulty` is `unknown` at the db boundary; the
    // session builder stores the resolved profile document.
    const storedDifficulty = record.difficulty as DifficultyProfile;
    expect(storedDifficulty.level).toBe("normal");
    expect(storedDifficulty.challengeRating).toBe(0.5);
    expect(storedDifficulty.parameters.entityCount).toBe(3);
    expect(record.normalizedResult).toBe(0.5);
    expect(record.xp).toBe(0);
    expect(record.startedAt).toBe(10);
    expect(record.completedAt).toBe(110);
    expect(record.durationMs).toBe(100);
    expect((record.rawResult as LogicDeductionRawResult).seed).toBe("rec-seed");
  });
});

describe("persistLogicDeductionSession", () => {
  it("persists through the injected persister", async () => {
    const completeSession = jest.fn(async () => ({
      session: {} as never,
      ledgerEntry: null,
      balance: 0,
    }));
    const persister = { completeSession } as unknown as SessionPersistence;
    const outcome = await persistLogicDeductionSession(
      { id: "sid" } as never,
      persister,
    );
    expect(outcome.ok).toBe(true);
    expect(completeSession).toHaveBeenCalledTimes(1);
  });

  it("reports (never throws) on persistence failure", async () => {
    const completeSession = jest.fn(async () => {
      throw new Error("db closed");
    });
    const persister = { completeSession } as unknown as SessionPersistence;
    await expectConsoleNoise(
      /\[logic-deduction-table\] failed to persist completed session sid/,
      async () => {
        const outcome = await persistLogicDeductionSession(
          { id: "sid" } as never,
          persister,
        );
        expect(outcome.ok).toBe(false);
        if (!outcome.ok) {
          expect((outcome.error as Error).message).toBe("db closed");
        }
      },
    );
  });
});


describe('exact supplied replay outcomes', () => {
  it('copies outcomes, including empty and forced histories, without fabricating rounds', () => {
    const outcomes: import('../types').RoundOutcome[] = ['correct', 'timeout', 'wrong'];
    const raw = buildRaw({ outcomes, forced: true });
    expect(raw.roundOutcomes).toEqual(outcomes);
    expect(raw.roundOutcomes).not.toBe(outcomes);
    outcomes.push('correct');
    expect(raw.roundOutcomes).toEqual(['correct', 'timeout', 'wrong']);
    expect(buildRaw().roundOutcomes).toEqual([]);
  });

  it('distinguishes aggregate-colliding adaptive histories and replays their intermediate rounds', () => {
    function play(outcomes: readonly import('../types').RoundOutcome[]) {
      let state = logicDeductionReducer(createInitialLogicDeductionState(), { type: 'select-difficulty', level: 'adaptive' });
      state = logicDeductionReducer(state, { type: 'start-session', seed: 'collision', sessionId: 'collision', startedAtMs: 0, nowMs: 0 });
      const rounds = [];
      for (const outcome of outcomes) {
        rounds.push(state.round);
        state = logicDeductionReducer(state, {
          type: 'answer-option',
          index: outcome === 'correct' ? state.round!.correctIndex : (state.round!.correctIndex + 1) % state.round!.options.length,
          nowMs: state.roundStartedAtMs! + state.params!.roundTimeMs / 2,
        });
        state = logicDeductionReducer(state, { type: 'next-round', nowMs: 0 });
      }
      const raw = buildRaw({ difficulty: 'adaptive', stats: state.stats, params: state.params!, outcomes: state.roundOutcomes });
      return { raw, rounds, params: state.params };
    }
    const a = play(['correct', 'correct', 'wrong', 'wrong', 'correct', 'wrong']);
    const b = play(['correct', 'wrong', 'correct', 'correct', 'wrong', 'wrong']);
    expect(a.raw.score).toBe(375);
    expect(a.raw.score).toBe(b.raw.score);
    expect(a.raw.bestStreak).toBe(2);
    expect(a.raw.bestStreak).toBe(b.raw.bestStreak);
    expect(a.raw.sumAnswerRatio).toBe(3);
    expect(a.params).toEqual(b.params);
    expect(a.rounds).not.toEqual(b.rounds);
    expect(a.raw.roundOutcomes).not.toEqual(b.raw.roundOutcomes);
    expect(play(a.raw.roundOutcomes as readonly import('../types').RoundOutcome[]).rounds).toEqual(a.rounds);
    expect(play(b.raw.roundOutcomes as readonly import('../types').RoundOutcome[]).rounds).toEqual(b.rounds);
    const context = { gameId: 'logic-deduction-table', difficulty: 'adaptive' as const, durationMs: 1000 };
    const legacy = { ...a.raw };
    delete legacy.roundOutcomes;
    expect(normalizeLogicDeductionResult(a.raw, context).value).toBe(0.375);
    expect(normalizeLogicDeductionResult(legacy, context).value).toBe(0.375);
  });
});
