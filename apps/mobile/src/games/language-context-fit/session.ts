import { createDiagnosticMetadata, RNG_ALGORITHM_VERSION } from '@/sdk';
import type { DiagnosticMetadata, DifficultyLevel, DifficultyProfile, NormalizedPerformance } from '@/sdk';
import { getDb } from '@/db';
import type { CompleteSessionInput, CompleteSessionResult, GameSessionRecord } from '@/db';

import { loadContentPack } from './content-validation';
import type { Tier } from './content-validation';
import { accuracyOf } from './scoring';
import { GAME_ID } from './types';
import type { ContextFitDifficultyParams, ContextFitRawResult, ContextFitStats, RoundOutcome } from './types';
import { versionToNumber } from './versions';

export interface SessionPersistence {
  completeSession(input: CompleteSessionInput): Promise<CompleteSessionResult>;
}

export const dbSessionPersister: SessionPersistence = {
  completeSession: (input) => getDb().sessions.completeSession(input),
};

export interface BuildRawResultInput {
  readonly gameVersion: string;
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  readonly difficulty: DifficultyLevel;
  readonly params: ContextFitDifficultyParams;
  readonly challengeRating: number;
  readonly seed: string;
  readonly stats: ContextFitStats;
  readonly outcomes: readonly RoundOutcome[];
  readonly finalTier: Tier | null;
  readonly forced: boolean;
  readonly startedAtMs: number;
  readonly activeDurationMs: number;
  readonly pausedDurationMs: number;
}

export function buildContextFitRawResult(input: BuildRawResultInput): ContextFitRawResult {
  const pack = loadContentPack();
  const generatorInfo = {
    packId: pack.packId,
    packVersion: pack.packVersion,
    rounds: input.params.rounds,
    tierMask: input.params.tierMask,
    timePerRoundMs: input.params.timePerRoundMs,
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
    roundsCorrect: input.stats.roundsCorrect,
    accuracy: accuracyOf(input.stats.roundsCorrect, input.stats.roundsPlayed),
    bestStreak: input.stats.bestStreak,
    totalAnswerMs: input.stats.totalAnswerMs,
    sumAnswerRatio: input.stats.sumAnswerRatio,
    roundOutcomes: [...input.outcomes],
    contentPackId: pack.packId,
    contentPackVersion: pack.packVersion,
    challengeRating: input.challengeRating,
    finalTier: input.finalTier,
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

export function seedToNumber(seed: string): number {
  if (/^[0-9]+$/.test(seed)) {
    const numeric = Number(seed);
    if (Number.isSafeInteger(numeric)) return numeric;
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
  readonly rawResult: ContextFitRawResult;
  readonly difficulty: DifficultyProfile;
  readonly normalized: NormalizedPerformance;
  readonly xp: number;
  readonly startedAtMs: number;
  readonly completedAtMs: number;
  readonly activeDurationMs: number;
}

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

export type PersistOutcome = { ok: true; result: CompleteSessionResult } | { ok: false; error: unknown };

export async function persistContextFitSession(
  record: GameSessionRecord,
  persister: SessionPersistence = dbSessionPersister,
): Promise<PersistOutcome> {
  try {
    const result = await persister.completeSession({ session: record });
    return { ok: true, result };
  } catch (error) {
    console.error(`[language-context-fit] failed to persist completed session ${record.id}`, error);
    return { ok: false, error };
  }
}
