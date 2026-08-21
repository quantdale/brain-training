/**
 * Session result building + persistence for the Sustained Vigilance game.
 *
 * A completed session flows through the SDK scoring pipeline (raw → normalized
 * → XP hook) and is then persisted atomically via the db layer's
 * `completeSession`. Persistence failures are logged and surfaced in the UI;
 * they never crash the game.
 */
import { createDiagnosticMetadata, RNG_ALGORITHM_VERSION } from '@/sdk';
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  NormalizedPerformance,
} from '@/sdk';
import { getDb } from '@/db';
import type { CompleteSessionInput, CompleteSessionResult, GameSessionRecord } from '@/db';

import { GAME_ID } from './types';
import type {
  VigilanceDifficultyParams,
  VigilanceRawResult,
  VigilanceStats,
} from './types';
import { versionToNumber } from './versions';
import {
  goAccuracyOf,
  holdAccuracyOf,
  meanOf,
  meanSpeedOf,
  overallAccuracyOf,
} from './scoring';

/** Persistence seam so tests can substitute the db layer. */
export interface SessionPersistence {
  completeSession(input: CompleteSessionInput): Promise<CompleteSessionResult>;
}

/** Default persister backed by the app database (requires `initDatabase()`). */
export const dbSessionPersister: SessionPersistence = {
  completeSession: (input) => getDb().sessions.completeSession(input),
};

export interface BuildRawResultInput {
  readonly gameVersion: string;
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  readonly difficulty: DifficultyLevel;
  readonly params: VigilanceDifficultyParams;
  readonly finalResponseWindowMs: number;
  readonly challengeRating: number;
  readonly seed: string;
  readonly stopDigit: number;
  readonly stats: VigilanceStats;
  readonly forced: boolean;
  readonly startedAtMs: number;
  readonly activeDurationMs: number;
  readonly pausedDurationMs: number;
}

/**
 * Build the persisted raw result. It carries the score statistics plus the
 * full reproducibility envelope (seed, versions, difficulty, generator info).
 */
export function buildVigilanceRawResult(input: BuildRawResultInput): VigilanceRawResult {
  const generatorInfo = {
    trials: input.params.trials,
    stimulusOnMs: input.params.stimulusOnMs,
    isiMs: input.params.isiMs,
    responseWindowMs: input.params.responseWindowMs,
    targetRarityPct: input.params.targetRarityPct,
    minTargetGap: input.params.minTargetGap,
    rtTargetMs: input.params.rtTargetMs,
    rtFailMs: input.params.rtFailMs,
    stopDigit: input.stopDigit,
    rngAlgorithm: RNG_ALGORITHM_VERSION,
  };
  const diagnosticMetadata: DiagnosticMetadata = createDiagnosticMetadata({
    gameId: GAME_ID,
    gameVersion: input.gameVersion,
    generatorVersion: input.generatorVersion,
    seed: input.seed,
    difficulty: input.difficulty,
    startedAtMs: input.startedAtMs,
    activeDurationMs: input.activeDurationMs,
    pausedDurationMs: input.pausedDurationMs,
    generatorInfo,
  });

  return {
    score: input.stats.score,
    trialsTotal: input.params.trials,
    trialsPlayed: input.stats.trialsPlayed,
    hits: input.stats.hits,
    commissions: input.stats.commissions,
    omissions: input.stats.omissions,
    correctHolds: input.stats.correctHolds,
    bestStreak: input.stats.bestStreak,
    meanReactionMs: meanOf(input.stats.reactions),
    bestReactionMs: input.stats.bestReactionMs,
    reactions: input.stats.reactions,
    goAccuracy: goAccuracyOf(input.stats.hits, input.stats.omissions),
    holdAccuracy: holdAccuracyOf(input.stats.correctHolds, input.stats.commissions),
    // Catalog-standard analytics field (see types.ts): correct trials / played.
    accuracy: overallAccuracyOf(
      input.stats.hits,
      input.stats.correctHolds,
      input.stats.trialsPlayed,
    ),
    meanSpeed: meanSpeedOf(input.stats.totalSpeed, input.stats.hits),
    finalResponseWindowMs: input.finalResponseWindowMs,
    stopDigit: input.stopDigit,
    challengeRating: input.challengeRating,
    difficulty: input.difficulty,
    seed: input.seed,
    gameVersion: input.gameVersion,
    generatorVersion: input.generatorVersion,
    scoringVersion: input.scoringVersion,
    forced: input.forced,
    generatorInfo,
    diagnosticMetadata,
  };
}

/**
 * Deterministic mapping of a canonical seed string to the db's integer seed
 * column. Pure-numeric seeds are kept verbatim; any other string is hashed
 * with FNV-1a (32-bit, ECMA-safe integer math).
 */
export function seedToNumber(seed: string): number {
  if (/^[0-9]+$/.test(seed)) {
    const numeric = Number(seed);
    if (Number.isSafeInteger(numeric)) {
      return numeric;
    }
  }
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export interface BuildSessionRecordInput {
  readonly sessionId: string;
  readonly rawResult: VigilanceRawResult;
  readonly difficulty: DifficultyProfile;
  readonly normalized: NormalizedPerformance;
  readonly xp: number;
  readonly startedAtMs: number;
  readonly completedAtMs: number;
  readonly activeDurationMs: number;
}

/** Map the session outcome onto the persistence layer's record shape. */
export function buildSessionRecord(input: BuildSessionRecordInput): GameSessionRecord {
  const raw = input.rawResult;
  return {
    id: input.sessionId,
    gameId: GAME_ID,
    gameVersion: versionToNumber(raw.gameVersion),
    generatorVersion: versionToNumber(raw.generatorVersion),
    scoringVersion: versionToNumber(raw.scoringVersion),
    seed: seedToNumber(raw.seed),
    difficulty: {
      level: input.difficulty.level,
      challengeRating: input.difficulty.challengeRating,
      parameters: { ...input.difficulty.parameters },
    },
    rawResult: raw,
    normalizedResult: input.normalized.value,
    xp: input.xp,
    startedAt: input.startedAtMs,
    completedAt: input.completedAtMs,
    durationMs: input.activeDurationMs,
  };
}

export type PersistOutcome =
  | { ok: true; result: CompleteSessionResult }
  | { ok: false; error: unknown };

/**
 * Persist a completed session through `completeSession`. A failure is logged
 * and reported to the caller; it must never crash the game.
 */
export async function persistVigilanceSession(
  record: GameSessionRecord,
  persister: SessionPersistence = dbSessionPersister,
): Promise<PersistOutcome> {
  try {
    const result = await persister.completeSession({ session: record });
    return { ok: true, result };
  } catch (error) {
    console.error(
      `[attention-sustained-vigilance] failed to persist completed session ${record.id}`,
      error,
    );
    return { ok: false, error };
  }
}
