/**
 * Session result building + persistence for the Symbol Tracker game.
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
import type {
  CompleteSessionInput,
  CompleteSessionResult,
  GameSessionRecord,
} from '@/db';

import { accuracyOf } from './scoring';
import { GAME_ID } from './types';
import type {
  SymbolTrackerDifficultyParams,
  SymbolTrackerRawResult,
  SymbolTrackerStats,
} from './types';
import { versionToNumber } from './versions';

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
  /** Null only for non-procedural games; Symbol Tracker always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  readonly difficulty: DifficultyLevel;
  readonly params: SymbolTrackerDifficultyParams;
  readonly challengeRating: number;
  readonly seed: string;
  readonly stats: SymbolTrackerStats;
  readonly forced: boolean;
  readonly startedAtMs: number;
  readonly activeDurationMs: number;
  readonly pausedDurationMs: number;
}

/**
 * Build the persisted raw result. It carries the score statistics plus the
 * full reproducibility envelope (seed, versions, difficulty, generator info)
 * per the SDK generator rule and constitution §21.
 */
export function buildSymbolTrackerRawResult(
  input: BuildRawResultInput,
): SymbolTrackerRawResult {
  const generatorInfo = {
    gridSize: input.params.gridSize,
    tokenCount: input.params.tokenCount,
    observeMs: input.params.observeMs,
    rounds: input.params.rounds,
    initialTrackCount: input.params.initialTrackCount,
    distractors: input.params.distractors,
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
    totalRounds: input.params.rounds,
    roundsPlayed: input.stats.roundsPlayed,
    roundsPassed: input.stats.roundsPassed,
    accuracy: accuracyOf(input.stats.roundsPassed, input.stats.roundsPlayed),
    bestRecall: input.stats.bestRecall,
    bestStreak: input.stats.bestStreak,
    initialTrackCount: input.params.initialTrackCount,
    tokenCount: input.params.tokenCount,
    gridSize: input.params.gridSize,
    observeMs: input.params.observeMs,
    distractors: input.params.distractors,
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
 * column. Pure-numeric seeds are kept verbatim (up to Number.MAX_SAFE_INTEGER);
 * any other string is hashed with FNV-1a (32-bit, ECMA-safe integer math) so
 * the stored value is stable and reproducible.
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
  readonly rawResult: SymbolTrackerRawResult;
  readonly difficulty: DifficultyProfile;
  readonly normalized: NormalizedPerformance;
  readonly xp: number;
  readonly startedAtMs: number;
  readonly completedAtMs: number;
  readonly activeDurationMs: number;
}

/** Map the session outcome onto the persistence layer's record shape. */
export function buildSessionRecord(
  input: BuildSessionRecordInput,
): GameSessionRecord {
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
 * Persist a completed session through `completeSession` (atomic: session row
 * + profile touch; no ledger entry is requested in Phase 1 — currency/XP
 * economy lands with the Phase-2 rating pipeline). A failure is logged and
 * reported to the caller; it must never crash the game.
 */
export async function persistSymbolTrackerSession(
  record: GameSessionRecord,
  persister: SessionPersistence = dbSessionPersister,
): Promise<PersistOutcome> {
  try {
    const result = await persister.completeSession({ session: record });
    return { ok: true, result };
  } catch (error) {
    console.error(
      `[attention-symbol-tracker] failed to persist completed session ${record.id}`,
      error,
    );
    return { ok: false, error };
  }
}
