/**
 * Daily-workout advance guard (006R hardening: closes the cross-feature gap
 * where `WorkoutRepository.advance` was implemented and unit-tested but never
 * invoked by any screen, so `current_index` stayed at 0 on-device).
 *
 * The result screen calls this to decide whether a freshly-completed session
 * should advance the durable workout. We advance only when the completed game
 * is exactly the workout's current (resume) position and the workout is still
 * `active`. The `completedAt > instance.updatedAt` check makes the trigger
 * idempotent across re-views and relaunch: the session must have finished AFTER
 * the instance was last advanced (or first created). That prevents false
 * advances when a user browses a historical result whose game id coincidentally
 * equals the current workout game.
 */
import type { WorkoutInstance } from '@/db';

export interface CompletedGameSignal {
  /** Persisted game id of the completed session. */
  gameId: string;
  /** Session completion timestamp (Unix epoch ms). */
  completedAt: number;
}

// A freshly-started instance is created with `updatedAt ≈ now`; the very first
// game can be force-completed (or simply finished) at an instant at/before that
// creation timestamp, which would make `completedAt > updatedAt` FALSE and block
// the FIRST advance. Once blocked, currentIndex never moves and every later leg
// fails the `gameIds[currentIndex] === gameId` match, so a template workout
// (unlike the long-lived daily instance, whose updatedAt is old) stays 0/N
// "In progress" forever. A small slack absorbs that creation-vs-first-completion
// skew without re-opening the historical-result hole the guard exists to close
// (those are days old, far beyond this window).
const ADVANCE_TIMESTAMP_SLACK_MS = 10_000;

/**
 * Whether a completed session should advance the durable daily workout.
 * Returns false unless every gate below holds:
 *  - the instance exists and is still `active`,
 *  - the completed game is the instance's current (resume) position,
 *  - the session finished after the instance was last advanced/created.
 */
export function shouldAdvanceWorkout(
  signal: CompletedGameSignal,
  instance: WorkoutInstance | null,
): boolean {
  if (!instance || instance.status !== 'active') {
    return false;
  }
  const currentGameId = instance.gameIds[instance.currentIndex];
  if (!currentGameId || currentGameId !== signal.gameId) {
    return false;
  }
  // Historical guard: session must not be older than the workout itself.
  // This closes the hole where a 10s grace would otherwise accept a
  // yesterday-session whose game coincidentally matches today's current game
  // (the test uses 500 vs 1000) — those are far beyond a legitimate
  // creation-vs-completion skew and must not advance.
  if (signal.completedAt < instance.createdAt) {
    return false;
  }
  // Idempotency gate: only advance for a session newer than the last advance.
  // A small slack is allowed ONLY for the very first game of a never-advanced
  // instance (createdAt === updatedAt, currentIndex 0) to absorb the
  // creation-vs-first-completion skew (updatedAt ≈ now, completedAt ≤ now).
  // After the first advance, or for any other leg, strict ordering is required
  // so historical re-views (days old) cannot slip through a blanket window.
  const slack =
    instance.currentIndex === 0 && instance.createdAt === instance.updatedAt
      ? ADVANCE_TIMESTAMP_SLACK_MS
      : 0;
  return signal.completedAt > instance.updatedAt - slack;
}

/** Game id at the current resume position, or null when the list is exhausted. */
export function nextWorkoutGameId(instance: WorkoutInstance | null): string | null {
  if (!instance) {
    return null;
  }
  return instance.gameIds[instance.currentIndex] ?? null;
}
