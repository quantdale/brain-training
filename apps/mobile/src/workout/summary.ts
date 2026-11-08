/**
 * Workout Engine V2 — per-workout completion summaries.
 *
 * A summary is the aggregate a result/history UI needs for ONE workout
 * instance: which positions were played, the session behind each played
 * position, XP/performance/duration totals, and completion state. Building it
 * is PURE: the caller supplies the persisted instance and the candidate
 * session records; this module never touches the db or the clock.
 *
 * Session matching rule: position `i` counts as played when `i < currentIndex`
 * (the durable resume point only advances after a session durably completed).
 * A summary records what happened, so replaying a game later must never
 * rewrite it:
 *
 * 1. A session with workout provenance belongs to exactly one leg. Its
 *    `(instanceKey, legIndex, gameId)` tuple decides the match, and among
 *    duplicates the EARLIEST wins: only the first session could advance the
 *    leg, and a later replay of the same launch cannot.
 * 2. A session without valid provenance (older history, or free play) can
 *    fill a leg that has no owned session. It matches the MOST RECENT record
 *    with the same game id finished within the instance's window: from its
 *    creation until the end of its local calendar date. In that fallback, if
 *    two instances (daily + a focus template) contain the same game, both
 *    summaries may reference the same physical session; each workout's
 *    PROGRESS remains independent.
 */

import type { WorkoutInstance, WorkoutStatus } from "@/db";
import { parseInstanceKey } from "./metadata";
import type { WorkoutMetadata } from "./metadata";
import type { WorkoutSelectionReason } from "./personalize";
import {
  isWorkoutSessionProvenance,
  type WorkoutSessionProvenance,
} from "./session-provenance";

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
  /** Exact workout leg that launched this session, when known. */
  workoutProvenance?: WorkoutSessionProvenance;
}

/** Per-position outcome inside one workout. */
export interface WorkoutGameOutcome {
  gameId: string;
  /** 0-based slot in the workout. */
  position: number;
  /** True when the durable resume point moved past this position AND the leg was not skipped. */
  played: boolean;
  /** True when the player deliberately skipped this leg (073). */
  skipped: boolean;
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
  /** PLAYED legs past the resume point; skipped legs are excluded (073 §3). */
  completedGames: number;
  /** Legs the player deliberately skipped. */
  skippedGames: number;
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
 * The session's ownership tuple, or null when it has none it can stand behind:
 * invalid or game-mismatched provenance degrades to standalone, the same rule
 * the advance path applies.
 */
function ownedProvenance(
  session: WorkoutSessionRef,
): WorkoutSessionProvenance | null {
  const provenance = session.workoutProvenance;
  return isWorkoutSessionProvenance(provenance) &&
    provenance.gameId === session.gameId
    ? provenance
    : null;
}

/**
 * First instant after the local calendar date `date` (`YYYY-MM-DD`), bounding
 * the sessions without provenance. An unparseable date applies no bound.
 */
function endOfLocalDate(date: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return Number.POSITIVE_INFINITY;
  }
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day) + 1).getTime();
}

/**
 * Build a completion summary from an instance and its candidate sessions.
 * Deterministic: the same inputs always yield the same summary.
 */
export function buildWorkoutSummary(
  instance: WorkoutInstance,
  // Defaults to [] so a direct caller omitting the candidate list gets an
  // unplayed summary instead of a TypeError from the match loop below.
  sessions: readonly WorkoutSessionRef[] = [],
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
  // 073 §3: the resume index advances for a SKIP as well as a session, so
  // "position < currentIndex" alone over-reports: a skipped leg would read as
  // played/completed with no session behind it. The skip record is the only
  // evidence that distinguishes the two.
  const skipped = new Set(instance.skippedIndices ?? []);

  // Per played position: the owned session, else the fallback (module comment).
  const owned = new Map<number, WorkoutSessionRef>();
  const fallback = new Map<number, WorkoutSessionRef>();
  const windowEnd = endOfLocalDate(parsed.date);
  for (const session of sessions) {
    const provenance = ownedProvenance(session);
    if (provenance) {
      const position = provenance.legIndex;
      if (
        provenance.instanceKey === instance.date &&
        position < completedGames &&
        !skipped.has(position) &&
        instance.gameIds[position] === session.gameId
      ) {
        const current = owned.get(position);
        if (!current || session.completedAt < current.completedAt) {
          owned.set(position, session);
        }
      }
      continue;
    }
    if (session.completedAt < instance.createdAt || session.completedAt >= windowEnd) {
      continue;
    }
    for (let position = 0; position < completedGames; position += 1) {
      if (skipped.has(position) || instance.gameIds[position] !== session.gameId) {
        continue;
      }
      const current = fallback.get(position);
      if (!current || session.completedAt > current.completedAt) {
        fallback.set(position, session);
      }
    }
  }
  const byPosition = new Map<number, WorkoutSessionRef>([...fallback, ...owned]);

  const outcomes: WorkoutGameOutcome[] = instance.gameIds.map(
    (gameId, position) => ({
      gameId,
      position,
      skipped: skipped.has(position),
      played: position < completedGames && !skipped.has(position),
      session: byPosition.get(position) ?? null,
    }),
  );

  const matched = [...byPosition.values()];
  // A settled leg is "completed" only when it was PLAYED: a skipped leg is
  // past the resume point but has no session and no reward, and must never
  // inflate the completed count or the completion ratio (073 §3 contract:
  // "skipped must never read as completed").
  const playedGames = outcomes.filter((outcome) => outcome.played).length;
  const skippedGames = skipped.size;
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
    completedGames: playedGames,
    skippedGames,
    completionRatio: totalGames === 0 ? 0 : playedGames / totalGames,
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
