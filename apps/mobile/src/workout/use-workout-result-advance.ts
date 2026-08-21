/**
 * `useWorkoutResultAdvance` — cross-feature wiring that closes the 006R
 * hardening gap: the durable daily workout was implemented and unit-tested but
 * no screen ever advanced it, so `current_index` stayed at 0 on-device.
 *
 * Given the session shown on the result screen, this hook loads today's
 * workout instance and, when the session finished the current (resume) game,
 * advances the instance exactly once via `WorkoutRepository.advance`. It returns
 * the next game id to surface a "Next Game" CTA, or a `completed` flag for the
 * "Workout complete" state.
 *
 * Idempotency (Queue A — completion idempotency / rapid navigation races): the
 * `shouldAdvanceWorkout` guard alone is not enough, because `useDbData` does
 * NOT refresh the instance after we advance it, so a re-render can hand us a
 * STALE instance object (currentIndex still 0) and the guard would pass again,
 * advancing twice. To prevent that we (1) remember the advanced instance in
 * local state (updated only inside the async callback, never synchronously in an
 * effect) so the guard always sees the post-advance instance, (2) remember the
 * session id we already advanced for so the exact same session can never advance
 * twice, and (3) reconcile the loaded instance against the current eligible
 * catalog so a stored instance that references a retired/renamed game id
 * advances past the dead slot instead of stalling on it.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameSessionRecord, WorkoutInstance } from "@/db";
import { getDb } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
import { shouldAdvanceWorkout } from "./advance";
import { eligibleGameIds, reconcileWorkout } from "./reconcile";
import { localDateString } from "./today";

export interface WorkoutResultAdvance {
  /** Today's persisted (reconciled) workout instance (null until loaded). */
  instance: WorkoutInstance | null;
  /** Game id to play next after this session advanced the workout, or null. */
  nextGameId: string | null;
  /** True when the workout is finished (already, or just completed by this session). */
  completed: boolean;
}

export function useWorkoutResultAdvance(
  session: GameSessionRecord | null,
): WorkoutResultAdvance {
  const today = localDateString();
  const { data: loadedInstance } = useDbData(
    (db) => db.workouts.getByDate(today),
    [today],
    null as WorkoutInstance | null,
  );

  // `useDbData` does not refresh the instance after we advance it, so a re-render
  // can hand us a stale instance (currentIndex still 0). We keep the advanced
  // instance in local state (set only inside the async callback below, never
  // synchronously in an effect) so the idempotency guard always sees the
  // post-advance instance (fixes the double-advance on result re-view, Queue A).
  const [advancedInstance, setAdvancedInstance] =
    useState<WorkoutInstance | null>(null);
  const effective = advancedInstance ?? loadedInstance;

  // Reconcile against the current eligible catalog in-memory so a stored
  // instance referencing a retired/renamed game id (registry drift between
  // sessions) advances past the dead slot instead of stalling on it (Queue A).
  const reconciled = useMemo(
    () => reconcileWorkout(effective, eligibleGameIds()).instance,
    [effective],
  );

  const advancingRef = useRef(false);
  // Remember the session id we already advanced for, so the exact same session
  // can never advance the workout twice (belt-and-suspenders with the local
  // instance mirror + the completedAt/updatedAt guard in shouldAdvanceWorkout).
  const advancedForSessionRef = useRef<string | null>(null);
  const [next, setNext] = useState<{
    id: string | null;
    completed: boolean;
  } | null>(null);

  useEffect(() => {
    if (advancingRef.current || !session || !reconciled) {
      return;
    }
    // Already advanced for this exact session — never advance it twice.
    if (advancedForSessionRef.current === session.id) {
      return;
    }
    if (!shouldAdvanceWorkout(session, reconciled)) {
      return;
    }
    advancingRef.current = true;
    getDb()
      .workouts.advance(today)
      .then((updated) => {
        advancedForSessionRef.current = session.id;
        setAdvancedInstance(updated); // keep the guard honest for any re-run
        setNext({
          id: updated.gameIds[updated.currentIndex] ?? null,
          completed: updated.status === "completed",
        });
      })
      .catch((e: unknown) => {
        console.error("[results] workout advance failed", e);
      })
      .finally(() => {
        advancingRef.current = false;
      });
  }, [session, reconciled, today]);

  return {
    instance: reconciled,
    nextGameId: next?.id ?? null,
    completed: reconciled?.status === "completed" || next?.completed === true,
  };
}
