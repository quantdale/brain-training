/**
 * `useWorkoutResultAdvance` — result-screen wiring for the durable workout.
 *
 * A completed session is routed by its persisted launch tuple, not by a game
 * id/timestamp heuristic. The repository repeats the ownership check inside a
 * conditional transaction, so duplicate result effects, process relaunch and
 * concurrent workout screens cannot skip or double-advance a leg.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameSessionRecord, WorkoutInstance } from "@/db";
import { getDb } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
import { shouldAdvanceWorkout } from "./advance";
import { emitWorkoutChanged } from "./events";
import { eligibleGameIds, reconcileWorkout } from "./reconcile";
import type { WorkoutSessionProvenance } from "./session-provenance";

export interface WorkoutResultAdvance {
  /** The matched (reconciled) workout instance (null until loaded/matched). */
  instance: WorkoutInstance | null;
  /** Game id to play next after this session advanced the workout, or null. */
  nextGameId: string | null;
  /** True when the matched workout is finished (already, or just completed). */
  completed: boolean;
  /** Exact ownership tuple for the next leg, when one was advanced. */
  nextProvenance: WorkoutSessionProvenance | null;
}
export function useWorkoutResultAdvance(
  session: GameSessionRecord | null,
): WorkoutResultAdvance {
  const sessionId = session?.id ?? null;

  // Missing provenance intentionally yields null: legacy/standalone sessions
  // are displayable in Results but can never claim a current workout leg.
  const { data: loadedInstance } = useDbData(
    async (db) =>
      session ? db.workouts.findActiveInstanceForSession(session) : null,
    [sessionId],
    null as WorkoutInstance | null,
  );

  const [advancedInstance, setAdvancedInstance] =
    useState<WorkoutInstance | null>(null);
  const effective = advancedInstance ?? loadedInstance;

  // Reconcile the loaded row in memory so catalog drift cannot leave the
  // result surface pointed at a retired current game. The durable transition
  // still rechecks the original exact tuple before writing.
  const reconciled = useMemo(
    () => reconcileWorkout(effective, eligibleGameIds()).instance,
    [effective],
  );

  const advancingRef = useRef(false);
  const advancedForSessionRef = useRef<string | null>(null);
  const [next, setNext] = useState<{
    id: string | null;
    completed: boolean;
    provenance: WorkoutSessionProvenance | null;
  } | null>(null);

  useEffect(() => {
    // Ownership must be checked against the exact persisted row returned by
    // `findActiveInstanceForSession`. Reconciliation can remove a retired
    // game or shift the index; using that repaired in-memory shape for the
    // guard strands a legitimately launched result after catalog drift.
    if (advancingRef.current || !session || !loadedInstance) {
      return;
    }
    if (advancedForSessionRef.current === session.id) {
      return;
    }
    if (!shouldAdvanceWorkout(session, loadedInstance)) {
      return;
    }

    advancingRef.current = true;
    getDb().workouts
      .advanceForSession(session)
      .then(async ({ advanced, instance: updated }) => {
        if (!updated) {
          return;
        }
        // The current leg has now been consumed under its original ownership
        // tuple. Repair any retired future legs before exposing the next
        // provenance to the UI, otherwise the next launch could point at an
        // index that the durable row no longer considers playable.
        let displayUpdated = updated;
        if (updated.status === "active") {
          try {
            displayUpdated =
              (await getDb().workouts.reconcile(updated.date, eligibleGameIds())) ??
              updated;
          } catch (error) {
            // Advancement is already durable; a transient reconciliation read
            // failure must not hide the result or make the completion retry.
            console.error("[results] workout reconciliation failed", error);
          }
        }
        advancedForSessionRef.current = session.id;
        const nextGameId = displayUpdated.gameIds[displayUpdated.currentIndex] ?? null;
        setAdvancedInstance(displayUpdated);
        setNext({
          id: nextGameId,
          completed: displayUpdated.status === "completed",
          provenance: nextGameId
            ? {
                instanceKey: displayUpdated.date,
                legIndex: displayUpdated.currentIndex,
                gameId: nextGameId,
              }
            : null,
        });
        if (advanced) {
          emitWorkoutChanged();
        }
      })
      .catch((e: unknown) => {
        console.error("[results] workout advance failed", e);
      })
      .finally(() => {
        advancingRef.current = false;
      });
  }, [session, loadedInstance]);

  return {
    instance: reconciled,
    nextGameId: next?.id ?? null,
    completed: reconciled?.status === "completed" || next?.completed === true,
    nextProvenance: next?.provenance ?? null,
  };
}
