/**
 * Workout Engine V2 — per-workout completion summaries.
 *
 * A summary is the aggregate a result/history UI needs for ONE workout
 * instance: which positions were played, the session behind each played
 * position, XP/performance/duration totals, and completion state. Building it
 * is PURE: the caller supplies the persisted instance and the candidate
 * session records; this module never touches the db or the clock.
 *
 * Session matching rule (documented ambiguity): position `i` counts as played
 * when `i < currentIndex` (the durable resume point only advances after a
 * session durably completed). Its session is the MOST RECENT record with the
 * same game id finished at/after the instance's creation — sessions from
 * before the instance existed (yesterday's play of the same game) never leak
 * in. If two instances (daily + a focus template) both contain the same game,
 * both summaries may legitimately reference the same physical session; that
 * is accepted because each workout's PROGRESS remains independent.
 */

import type { WorkoutInstance, WorkoutStatus } from "@/db";
import { parseInstanceKey } from "./metadata";
import type { WorkoutMetadata } from "./metadata";
import type { WorkoutSelectionReason } from "./personalize";

/**
 * Structural view of one completed session, limited to what summaries
 * consume. A superset of nothing: db `GameSessionRecord`s satisfy it
 * directly, and the repository can project lean SQL rows onto it without
 * fabricating unused fields.
 */
export interface WorkoutSessionRef {
  gameId: string;
  /** Shared 0..1 normalized performance. */
  normalizedResult: number;
  xp: number;
  durationMs: number;
  completedAt: number;
}

/** Per-position outcome inside one workout. */
export interface WorkoutGameOutcome {
  gameId: string;
  /** 0-based slot in the workout. */
  position: number;
  /** True when the durable resume point moved past this position. */
  played: boolean;
  /** The matched completion record, or null when unplayed/unmatched. */
  session: WorkoutSessionRef | null;
}

/** Aggregate view of one workout instance for results/history UIs. */
export interface WorkoutCompletionSummary {
  /** Instance key (the persisted primary key; see `metadata.ts`). */
  key: string;
  /** Local calendar date the workout belongs to. */
  date: string;
  status: WorkoutStatus;
  /** Versioned metadata when known (absent on legacy rows). */
  metadata: WorkoutMetadata | null;
  totalGames: number;
  completedGames: number;
  /** completedGames / totalGames in [0, 1] (0 when the workout is empty). */
  completionRatio: number;
  /** XP summed over matched sessions. */
  totalXp: number;
  /** Mean normalized performance over matched sessions (null when none). */
  avgNormalized: number | null;
  /** Total play time over matched sessions. */
  totalDurationMs: number;
  /** Completion timestamp of the last matched session (null when none). */
  finishedAt: number | null;
  outcomes: WorkoutGameOutcome[];
  /**
   * Personalization reasons in selection order, when the caller supplied the
   * inputs to compute them (see `reasons.ts`). Never fabricated for history
   * rows whose generation inputs were not persisted.
   */
  reasons: WorkoutSelectionReason[] | null;
}

/**
 * Build a completion summary from an instance and its candidate sessions.
 * Deterministic: the same inputs always yield the same summary.
 */
export function buildWorkoutSummary(
  instance: WorkoutInstance,
  sessions: readonly WorkoutSessionRef[],
  reasons: readonly WorkoutSelectionReason[] | null = null,
): WorkoutCompletionSummary {
  const parsed = parseInstanceKey(instance.date);
  const totalGames = instance.gameIds.length;
  // Clamp a drifted index so a corrupted row can never report negative or
  // overflowing progress (mirrors reconcile.ts's clamping policy).
  const completedGames = Math.min(
    Math.max(Math.trunc(instance.currentIndex), 0),
    totalGames,
  );

  // Latest matching session per played position (see module comment).
  const byPosition = new Map<number, WorkoutSessionRef>();
  for (const session of sessions) {
    if (session.completedAt < instance.createdAt) {
      continue;
    }
    for (let position = 0; position < completedGames; position += 1) {
      if (instance.gameIds[position] !== session.gameId) {
        continue;
      }
      const current = byPosition.get(position);
      if (!current || session.completedAt > current.completedAt) {
        byPosition.set(position, session);
      }
    }
  }

  const outcomes: WorkoutGameOutcome[] = instance.gameIds.map(
    (gameId, position) => ({
      gameId,
      position,
      played: position < completedGames,
      session: byPosition.get(position) ?? null,
    }),
  );

  const matched = [...byPosition.values()];
  const totalXp = matched.reduce((sum, session) => sum + session.xp, 0);
  const totalDurationMs = matched.reduce(
    (sum, session) => sum + session.durationMs,
    0,
  );
  let finishedAt: number | null = null;
  for (const session of matched) {
    if (finishedAt === null || session.completedAt > finishedAt) {
      finishedAt = session.completedAt;
    }
  }

  return {
    key: instance.date,
    date: parsed.date,
    status: instance.status,
    metadata: instance.metadata ?? null,
    totalGames,
    completedGames,
    completionRatio: totalGames === 0 ? 0 : completedGames / totalGames,
    totalXp,
    avgNormalized:
      matched.length === 0
        ? null
        : matched.reduce((sum, s) => sum + s.normalizedResult, 0) /
          matched.length,
    totalDurationMs,
    finishedAt,
    outcomes,
    reasons: reasons ? [...reasons] : null,
  };
}
