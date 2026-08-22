// Jest globals imported explicitly (repo has no @types/jest).
// Adversarial persistence/profile suite (campaign 011 W01): the persisted raw
// result must satisfy the db layer's completion contract AND stay visible to
// the shared analytics extractors; seeds map deterministically onto the db's
// integer column; version mapping tolerates prerelease suffixes; corrupt or
// malformed stored difficulty profiles are rejected loudly instead of
// producing broken sessions.
import { describe, expect, it, jest } from '@jest/globals';

import {
  ADAPTIVE_PARAMS,
  VIGILANCE_DIFFICULTY_PARAMS,
  resolveVigilanceDifficulty,
  vigilanceParamsForLevel,
  vigilanceParamsFromProfile,
  vigilanceParamsToRecord,
} from '../difficulty';
import {
  goAccuracyOf,
  holdAccuracyOf,
  normalizeVigilanceResult,
  overallAccuracyOf,
} from '../scoring';
import {
  buildSessionRecord,
  buildVigilanceRawResult,
  persistVigilanceSession,
  seedToNumber,
} from '../session';
import { SCORING_VERSION, versionToNumber } from '../versions';
import { GAME_ID } from '../types';
import { INITIAL_STATS } from '../types';
import type { CompleteSessionResult } from '@/db';
import type { GameSessionRecord } from '@/db';
import type { VigilanceRawResult, VigilanceStats } from '../types';
import { extractAccuracy, extractDifficultyRating, extractReactionMs, extractScore } from '@/analytics/metrics-map';

const NORMAL = VIGILANCE_DIFFICULTY_PARAMS.normal;

function statsWith(
  hits: number,
  omissions: number,
  correctHolds: number,
  commissions: number,
  speed = 0.8,
): VigilanceStats {
  return {
    ...INITIAL_STATS,
    trialsPlayed: hits + omissions + correctHolds + commissions,
    hits,
    omissions,
    correctHolds,
    commissions,
    streak: 3,
    bestStreak: 7,
    reactions: Array.from({ length: hits }, (_, i) => 300 + i * 10),
    totalSpeed: hits * speed,
    bestReactionMs: hits > 0 ? 300 : null,
  };
}

function buildRaw(stats: VigilanceStats): VigilanceRawResult {
  return buildVigilanceRawResult({
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: SCORING_VERSION,
    difficulty: 'normal',
    params: NORMAL,
    finalResponseWindowMs: NORMAL.responseWindowMs,
    challengeRating: 0.5,
    seed: 'persist-seed',
    stopDigit: 7,
    stats,
    forced: false,
    startedAtMs: 1_000,
    activeDurationMs: 45_000,
    pausedDurationMs: 2_500,
  });
}

const CONTEXT = {
  gameId: GAME_ID,
  difficulty: 'normal' as const,
  durationMs: 45_000,
};

describe('persisted raw result → analytics extractor contract', () => {
  // Campaign-011 regression pin: the raw result previously carried only
  // goAccuracy/holdAccuracy, which `extractAccuracy` does not recognize, so
  // this game's accuracy trend silently vanished from history/trend UIs.
  it('exposes score, accuracy, reaction, and difficulty fields to the shared extractors', () => {
    const stats = statsWith(20, 4, 3, 1);
    const raw = buildRaw(stats);

    expect(extractScore(raw)).toBe(raw.score);

    const accuracy = extractAccuracy(raw);
    expect(accuracy).not.toBeNull();
    expect(accuracy).toBeCloseTo((20 + 3) / 28, 12);
    expect(raw.accuracy).toBeCloseTo((20 + 3) / 28, 12);
    // Detail fields survive alongside the analytics field.
    expect(raw.goAccuracy).toBeCloseTo(goAccuracyOf(20, 4), 12);
    expect(raw.holdAccuracy).toBeCloseTo(holdAccuracyOf(3, 1), 12);

    expect(extractReactionMs(raw)).toBe(raw.meanReactionMs);
    expect(raw.meanReactionMs).not.toBeNull();

    const profile = resolveVigilanceDifficulty('hard');
    expect(extractDifficultyRating(profile)).toBe(profile.challengeRating);
  });

  it('keeps every extractor-safe field present even on degenerate stat lines', () => {
    const empty = buildRaw({ ...INITIAL_STATS });
    expect(extractScore(empty)).toBe(0);
    expect(empty.accuracy).toBe(0); // division guard, not NaN
    expect(empty.meanReactionMs).toBeNull();
    // Reaction extraction legitimately yields null with zero hits.
    expect(extractReactionMs(empty)).toBeNull();
  });

  it('round-trips a perfect run to exactly 1.0 through the real pipeline', () => {
    const raw = buildRaw(statsWith(26, 0, 4, 0, 1));
    const normalized = normalizeVigilanceResult(raw, CONTEXT);
    expect(normalized.value).toBe(1);
    expect(normalized.scale).toBe('0..1');
    expect(normalized.raw).toEqual(raw);
  });
});

describe('buildSessionRecord vs the db completion contract', () => {
  it('produces a record completeSession accepts and analytics can read', () => {
    const stats = statsWith(18, 6, 3, 3);
    const raw = buildRaw(stats);
    const normalized = normalizeVigilanceResult(raw, CONTEXT);
    const profile = resolveVigilanceDifficulty('normal');

    const record = buildSessionRecord({
      sessionId: 'sess-contract',
      rawResult: raw,
      difficulty: profile,
      normalized,
      xp: 42,
      startedAtMs: 1_000,
      completedAtMs: 46_000,
      activeDurationMs: 45_000,
    });

    expect(record.id).toBe('sess-contract');
    expect(record.gameId).toBe(GAME_ID);
    expect(record.gameVersion).toBe(1_000_000);
    expect(record.generatorVersion).toBe(1_000_000);
    expect(record.scoringVersion).toBe(1_000_000);
    expect(Number.isSafeInteger(record.seed)).toBe(true);
    expect(record.seed).toBe(seedToNumber('persist-seed'));
    // Validation rules enforced by SessionRepository.completeSession:
    expect(record.completedAt).toBeGreaterThanOrEqual(record.startedAt);
    expect(record.durationMs).toBeGreaterThanOrEqual(0);
    expect(record.durationMs).toBe(45_000);
    // Shared normalized scale:
    expect(record.normalizedResult).toBe(normalized.value);
    expect(record.normalizedResult).toBeGreaterThanOrEqual(0);
    expect(record.normalizedResult).toBeLessThanOrEqual(1);
    expect(record.difficulty).toEqual({
      level: 'normal',
      challengeRating: 0.5,
      parameters: { ...profile.parameters },
    });
    expect(record.rawResult).toEqual(raw);
  });

  it('maps adaptive sessions with their tuned parameter record intact', () => {
    const stats = statsWith(24, 0, 4, 4, 1);
    const raw = buildVigilanceRawResult({
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: SCORING_VERSION,
      difficulty: 'adaptive',
      params: ADAPTIVE_PARAMS,
      finalResponseWindowMs: 600,
      challengeRating: 1,
      seed: 'adapt',
      stopDigit: 2,
      stats,
      forced: false,
      startedAtMs: 0,
      activeDurationMs: 30_000,
      pausedDurationMs: 0,
    });
    const record = buildSessionRecord({
      sessionId: 'adapt-rec',
      rawResult: raw,
      difficulty: resolveVigilanceDifficulty('adaptive'),
      normalized: normalizeVigilanceResult(raw, { ...CONTEXT, difficulty: 'adaptive' }),
      xp: 0,
      startedAtMs: 0,
      completedAtMs: 30_000,
      activeDurationMs: 30_000,
    });
    const persisted = record as unknown as GameSessionRecord;
    expect((persisted.difficulty as { level: string }).level).toBe('adaptive');
    expect(
      (persisted.rawResult as { finalResponseWindowMs: number }).finalResponseWindowMs,
    ).toBe(600);
  });
});

describe('overallAccuracyOf (catalog-standard analytics field)', () => {
  it('counts hits plus correct holds over played trials with a zero guard', () => {
    expect(overallAccuracyOf(20, 3, 28)).toBeCloseTo(23 / 28, 12);
    expect(overallAccuracyOf(0, 0, 0)).toBe(0);
    expect(overallAccuracyOf(0, 5, 5)).toBe(1); // pure correct withholding
    expect(overallAccuracyOf(5, 0, 5)).toBe(1);
    expect(overallAccuracyOf(0, 0, 10)).toBe(0); // played but nothing correct
  });
});

describe('seedToNumber (canonical seed → integer db column)', () => {
  /** Independent FNV-1a 32-bit reference implementation per the module spec. */
  function fnv1a(input: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
  }

  it('keeps safe numeric seeds verbatim', () => {
    expect(seedToNumber('42')).toBe(42);
    expect(seedToNumber('0')).toBe(0);
    expect(seedToNumber(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('hashes non-numeric and unsafe-numeric seeds with FNV-1a (spec vectors)', () => {
    expect(seedToNumber('')).toBe(0x811c9dc5);
    for (const text of ['abc', 'Signal Watch', 'qa-seed-7', '数字', '9'.repeat(25)]) {
      expect(seedToNumber(text)).toBe(fnv1a(text));
      expect(seedToNumber(text)).toBeGreaterThanOrEqual(0);
      expect(seedToNumber(text)).toBeLessThan(2 ** 32);
    }
    // Unsafe numerics fall into the hash instead of losing precision silently.
    const huge = '9'.repeat(25);
    expect(Number.isSafeInteger(Number(huge))).toBe(false);
    expect(seedToNumber(huge)).not.toBe(Number(huge));
    expect(seedToNumber(huge)).toBe(seedToNumber(huge)); // deterministic
  });

  it('is stable across call sites for the same input', () => {
    expect(seedToNumber('replay-me')).toBe(seedToNumber('replay-me'));
  });
});

describe('versionToNumber (integer version columns)', () => {
  it('maps semantic versions onto major*1e6 + minor*1e3 + patch', () => {
    expect(versionToNumber('1.0.0')).toBe(1_000_000);
    expect(versionToNumber('10.20.30')).toBe(10_020_030);
    expect(versionToNumber('7')).toBe(7_000_000);
    expect(versionToNumber('0.0.9')).toBe(9);
  });

  it('tolerates prerelease/build suffixes instead of poisoning the column with NaN', () => {
    // Regression (campaign 011 finding #4): `Number('0-beta')` used to yield
    // NaN, which would have been bound straight into the integer column.
    expect(versionToNumber('1.0.0-beta')).toBe(1_000_000);
    expect(versionToNumber('2.1.0-rc.1')).toBe(2_001_000);
  });

  it('rejects inputs with no numeric major component', () => {
    expect(() => versionToNumber(null)).toThrow(/no numeric major component/);
    expect(() => versionToNumber('')).toThrow(/no numeric major component/);
    expect(() => versionToNumber('abc')).toThrow(/no numeric major component/);
  });
});

describe('persistVigilanceSession failure isolation', () => {
  it('returns the persister result on success', async () => {
    const raw = buildRaw(statsWith(10, 2, 2, 0));
    const record = buildSessionRecord({
      sessionId: 'persist-ok',
      rawResult: raw,
      difficulty: resolveVigilanceDifficulty('normal'),
      normalized: normalizeVigilanceResult(raw, CONTEXT),
      xp: 5,
      startedAtMs: 0,
      completedAtMs: 1,
      activeDurationMs: 1,
    });
    const resultStub = {
      session: record,
      ledgerEntry: null,
      balance: 0,
      rating: [],
      completionOutcome: undefined,
    } as unknown as CompleteSessionResult;
    const persister = { completeSession: jest.fn(async () => resultStub) };
    const outcome = await persistVigilanceSession(record, persister);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result).toBe(resultStub);
    }
    expect(persister.completeSession).toHaveBeenCalledWith({ session: record });
  });

  it('never crashes the game on persistence failure; reports and logs instead', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const raw = buildRaw({ ...INITIAL_STATS });
      const record = buildSessionRecord({
        sessionId: 'persist-fail',
        rawResult: raw,
        difficulty: resolveVigilanceDifficulty('normal'),
        normalized: { value: 0, scale: '0..1' },
        xp: 0,
        startedAtMs: 0,
        completedAtMs: 1,
        activeDurationMs: 1,
      });
      const boom = new Error('disk full');
      const persister = { completeSession: async () => {
        throw boom;
      } };
      const outcome = await persistVigilanceSession(record, persister);
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.error).toBe(boom);
      }
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(String(errorSpy.mock.calls[0]?.[0])).toContain(GAME_ID);
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe('difficulty profile integrity (stored-profile attacks)', () => {
  const LEVELS = ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const;

  it('round-trips every shipped level losslessly through the numeric record', () => {
    for (const level of LEVELS) {
      const params = vigilanceParamsForLevel(level);
      const profile = resolveVigilanceDifficulty(level);
      expect(profile.parameters).toEqual(vigilanceParamsToRecord(params));
      expect(vigilanceParamsFromProfile(profile)).toEqual(params);
      // The frozen defaults are never handed out by reference.
      expect(profile.parameters).not.toBe(vigilanceParamsToRecord(params));
    }
  });

  function corrupted(mutate: (parameters: Record<string, number>) => void): ReturnType<typeof resolveVigilanceDifficulty> {
    const profile = resolveVigilanceDifficulty('normal');
    const parameters: Record<string, number> = { ...profile.parameters };
    mutate(parameters);
    return { ...profile, parameters };
  }

  it('rejects malformed stored profiles with actionable errors', () => {
    expect(() =>
      vigilanceParamsFromProfile(corrupted((p) => {
        delete p.trials;
      })),
    ).toThrow(/missing numeric parameter "trials"/);

    expect(() =>
      vigilanceParamsFromProfile(corrupted((p) => {
        p.trials = Number.NaN;
      })),
    ).toThrow(/missing numeric parameter|trials/);

    expect(() =>
      vigilanceParamsFromProfile(corrupted((p) => {
        p.trials = 30.5;
      })),
    ).toThrow(/trials must be a positive integer/);

    expect(() =>
      vigilanceParamsFromProfile(corrupted((p) => {
        p.trials = 0;
      })),
    ).toThrow(/trials must be a positive integer/);

    expect(() =>
      vigilanceParamsFromProfile(corrupted((p) => {
        p.stimulusOnMs = 0;
      })),
    ).toThrow(/degenerate timing/);

    expect(() =>
      vigilanceParamsFromProfile(corrupted((p) => {
        p.isiMs = -1;
      })),
    ).toThrow(/degenerate timing/);

    expect(() =>
      vigilanceParamsFromProfile(corrupted((p) => {
        p.responseWindowMs = 0;
      })),
    ).toThrow(/responseWindowMs must be positive/);

    expect(() =>
      vigilanceParamsFromProfile(corrupted((p) => {
        p.targetRarityPct = 0;
      })),
    ).toThrow(/targetRarityPct/);

    expect(() =>
      vigilanceParamsFromProfile(corrupted((p) => {
        p.targetRarityPct = 100.5;
      })),
    ).toThrow(/targetRarityPct/);

    expect(() =>
      vigilanceParamsFromProfile(corrupted((p) => {
        p.rtFailMs = p.rtTargetMs;
      })),
    ).toThrow(/rtFailMs .* must exceed rtTargetMs/);

    expect(() =>
      vigilanceParamsFromProfile(corrupted((p) => {
        delete p.rtTargetMs;
      })),
    ).toThrow(/missing numeric parameter "rtTargetMs"/);
  });

  it('accepts profiles whose optional adaptive bounds are absent (fixed levels)', () => {
    const decoded = vigilanceParamsFromProfile(resolveVigilanceDifficulty('expert'));
    expect(decoded.minResponseWindowMs).toBeUndefined();
    expect(decoded.maxResponseWindowMs).toBeUndefined();
    expect(decoded.stepResponseWindowMs).toBeUndefined();
  });
});
