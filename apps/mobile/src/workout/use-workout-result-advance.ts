/**
 * `useWorkoutResultAdvance` — cross-feature wiring that closes the 006R
 * hardening gap: the durable daily workout was implemented and unit-tested but
 * no screen ever advanced it, so `current_index` stayed at 0 on-device.
 *
 * Given the session shown on the result screen, this hook finds the workout
 * instance the session belongs to and advances it exactly once via
 * `WorkoutRepository.advance`. Workout Engine V2 extends routing beyond the
 * default daily mix: the candidate is ANY active instance whose CURRENT
 * (resume) position equals the session's game — the daily mix or a template
 * workout (`focus-*`, short/standard/extended). When several qualify, the
 * repository picks the most recently updated one (the player's latest
 * intent). Sessions that belong to no active workout advance nothing.
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
import { emitWorkoutChanged } from "./events";
import { eligibleGameIds, reconcileWorkout } from "./reconcile";

export interface WorkoutResultAdvance {
  /** The matched (reconciled) workout instance (null until loaded/matched). */
  instance: WorkoutInstance | null;
  /** Game id to play next after this session advanced the workout, or null. */
  nextGameId: string | null;
  /** True when the matched workout is finished (already, or just completed). */
  completed: boolean;
}

export function useWorkoutResultAdvance(
  session: GameSessionRecord | null,
): WorkoutResultAdvance {
  const sessionId = session?.id ?? null;

  // Route the session to its owning workout across ALL template types: any
  // active instance whose current resume game matches, touched before the
  // session finished. Null when the session belongs to no workout.
  const { data: loadedInstance } = useDbData(
    async (db) =>
      session
        ? db.workouts.findActiveInstanceForGame(
            session.gameId,
            session.completedAt,
          )
        : null,
    [sessionId],
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
    // `instance.date` is the instance KEY (daily date or namespaced template
    // key), so one advance call serves every workout kind.
    getDb()
      .workouts.advance(reconciled.date)
      .then((updated) => {
        advancedForSessionRef.current = session.id;
        setAdvancedInstance(updated); // keep the guard honest for any re-run
        setNext({
          id: updated.gameIds[updated.currentIndex] ?? null,
          completed: updated.status === "completed",
        });
        // Notify Home (and any other subscriber) so template chips, resume
        // state, history rows and the completion card re-read the persisted
        // row immediately. Without this, Home kept showing the pre-advance
        // snapshot ("0/2 · In progress", no completion card) even though the
        // results page itself said the workout was complete — device-verified
        // defect (campaign 012 closeout QA).
        emitWorkoutChanged();
      })
      .catch((e: unknown) => {
        console.error("[results] workout advance failed", e);
      })
      .finally(() => {
        advancingRef.current = false;
      });
  }, [session, reconciled]);

  return {
    instance: reconciled,
    nextGameId: next?.id ?? null,
    completed: reconciled?.status === "completed" || next?.completed === true,
  };
}
