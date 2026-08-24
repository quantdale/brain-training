/**
 * Session result building + persistence for the Sequence Memory game.
 *
 * A completed session flows through the SDK scoring pipeline (raw → normalized
 * → XP hook) and is then persisted atomically via the db layer's
 * `completeSession`. Persistence failures are logged and surfaced in the UI;
 * they never crash the game.
 *
 * Reproducibility envelope: the raw result records (seed, versions,
 * difficulty, generator info, `timeUp`). The generator is deterministic per
 * (seed, round ordinal, length, previous sequence); the number of rounds is a
 * property of play, not of the seed, because the score attack is bounded by
 * the monotonic time budget rather than a fixed round count.
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

import { accuracyOf } from './scoring';
import { GAME_ID } from './types';
import type {
  SequenceMemoryDifficultyParams,
  SequenceMemoryRawResult,
  SequenceMemoryStats,
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
  /** Null only for non-procedural games; Sequence Memory always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  readonly difficulty: DifficultyLevel;
  readonly params: SequenceMemoryDifficultyParams;
  readonly challengeRating: number;
  readonly seed: string;
  readonly stats: SequenceMemoryStats;
  readonly timeUp: boolean;
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
export function buildSequenceMemoryRawResult(
  input: BuildRawResultInput,
): SequenceMemoryRawResult {
  const generatorInfo = {
    tileCount: input.params.tileCount,
    baseLength: input.params.baseLength,
    maxLength: input.params.maxLength,
    revealMs: input.params.revealMs,
    sessionSeconds: input.params.sessionSeconds,
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
    roundsPlayed: input.stats.roundsPlayed,
    roundsPassed: input.stats.roundsPassed,
    accuracy: accuracyOf(input.stats.roundsPassed, input.stats.roundsPlayed),
    longestSequence: input.stats.longestSequence,
    bestStreak: input.stats.bestStreak,
    baseLength: input.params.baseLength,
    maxLength: input.params.maxLength,
    tileCount: input.params.tileCount,
    revealMs: input.params.revealMs,
    sessionSeconds: input.params.sessionSeconds,
    timeUp: input.timeUp,
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
 *
 * (Same contract as the Phase-2 memory module; a shared SDK helper would be a
 * natural convergence candidate — see packet report.)
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
  readonly rawResult: SequenceMemoryRawResult;
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
 * Persist a completed session through `completeSession` (atomic: session row
 * + profile touch; no ledger entry is requested in Phase 1 — currency/XP
 * economy lands with the Phase-2 rating pipeline). A failure is logged and
 * reported to the caller; it must never crash the game.
 */
export async function persistSequenceMemorySession(
  record: GameSessionRecord,
  persister: SessionPersistence = dbSessionPersister,
): Promise<PersistOutcome> {
  try {
    const result = await persister.completeSession({ session: record });
    return { ok: true, result };
  } catch (error) {
    console.error(
      `[memory-sequence-memory] failed to persist completed session ${record.id}`,
      error,
    );
    return { ok: false, error };
  }
}
