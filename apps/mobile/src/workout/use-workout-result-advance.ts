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
    if (advancingRef.current || !session || !reconciled) {
      return;
    }
    if (advancedForSessionRef.current === session.id) {
      return;
    }
    if (!shouldAdvanceWorkout(session, reconciled)) {
      return;
    }

    advancingRef.current = true;
    getDb()
      .workouts.advanceForSession(session)
      .then(({ advanced, instance: updated }) => {
        if (!updated) {
          return;
        }
        advancedForSessionRef.current = session.id;
        const nextGameId = updated.gameIds[updated.currentIndex] ?? null;
        setAdvancedInstance(updated);
        setNext({
          id: nextGameId,
          completed: updated.status === "completed",
          provenance: nextGameId
            ? {
                instanceKey: updated.date,
                legIndex: updated.currentIndex,
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
  }, [session, reconciled]);

  return {
    instance: reconciled,
    nextGameId: next?.id ?? null,
    completed: reconciled?.status === "completed" || next?.completed === true,
    nextProvenance: next?.provenance ?? null,
  };
}
