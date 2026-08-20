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
  // Idempotency gate: only advance for a session newer than the last advance.
  return signal.completedAt > instance.updatedAt;
}

/** Game id at the current resume position, or null when the list is exhausted. */
export function nextWorkoutGameId(instance: WorkoutInstance | null): string | null {
  if (!instance) {
    return null;
  }
  return instance.gameIds[instance.currentIndex] ?? null;
}
