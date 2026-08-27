/**
 * Workout advance ownership guard (campaign 015 task 8A).
 *
 * A result can advance a workout only when the session carries the exact
 * instance key and leg index that launched it, and that leg is still current.
 * Timestamps, recency and game-id-only matching are intentionally absent:
 * wall clocks can skew and an old/standalone session must never claim a
 * coincidentally matching game. The repository repeats this predicate inside
 * its conditional transaction for durable race safety.
 */
import type { WorkoutInstance } from "@/db";
import {
  isWorkoutSessionProvenance,
  type WorkoutSessionProvenance,
} from "./session-provenance";

export interface CompletedGameSignal {
  /** Persisted game id of the completed session. */
  gameId: string;
  /** Exact workout ownership persisted with the session, when applicable. */
  workoutProvenance?: WorkoutSessionProvenance;
}

/**
 * Whether a completed session owns the instance's current leg.
 *
 * This is a pure fast-path check for the result UI. `advanceForSession` is the
 * authoritative one-shot write boundary and checks the same tuple again in a
 * transaction, so a stale render can never skip or double-advance a workout.
 */
export function shouldAdvanceWorkout(
  signal: CompletedGameSignal,
  instance: WorkoutInstance | null,
): boolean {
  if (!instance || instance.status !== "active") {
    return false;
  }
  const provenance = signal.workoutProvenance;
  return (
    isWorkoutSessionProvenance(provenance) &&
    provenance.gameId === signal.gameId &&
    provenance.instanceKey === instance.date &&
    provenance.legIndex === instance.currentIndex &&
    instance.gameIds[provenance.legIndex] === signal.gameId
  );
}

/** Game id at the current resume position, or null when the list is exhausted. */
export function nextWorkoutGameId(instance: WorkoutInstance | null): string | null {
  if (!instance) {
    return null;
  }
  return instance.gameIds[instance.currentIndex] ?? null;
}
