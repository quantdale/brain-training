/**
 * Shared durable workout advance (frontier audit `in-game-workout-next-leg`).
 *
 * Both the in-game results chrome and the `/results` route call this so a
 * workout-launched session advances exactly once at the persistence boundary.
 * `WorkoutRepository.advanceForSession` re-checks ownership inside its
 * conditional transaction, so duplicate calls, process relaunch and concurrent
 * result surfaces cannot skip or double-advance a leg. A call that is not the
 * owning leg (already advanced elsewhere, completed, or standalone) resolves
 * the current durable state without writing.
 */
import type { WorkoutInstance } from "@/db";
import { getDb } from "@/db";
import { shouldAdvanceWorkout } from "./advance";
import { eligibleGameIds, reconcileWorkout } from "./reconcile";
import type { WorkoutSessionProvenance } from "./session-provenance";

/** Minimal session signal: the persisted game id + workout ownership tuple. */
export interface WorkoutSessionSignal {
  gameId: string;
  workoutProvenance?: WorkoutSessionProvenance;
}

export interface WorkoutSessionAdvanceResult {
  /** True when THIS call committed the leg transition. */
  advanced: boolean;
  /** The instance after the call (reconciled for catalog drift), or null. */
  instance: WorkoutInstance | null;
  /** Game id to launch next, or null at completion (and for standalone). */
  nextGameId: string | null;
  /** Exact ownership tuple for the next leg, when one is available. */
  nextProvenance: WorkoutSessionProvenance | null;
  /** True when the workout is completed (just now, or earlier). */
  completed: boolean;
}

function withNavigation(
  instance: WorkoutInstance | null,
  advanced: boolean,
): WorkoutSessionAdvanceResult {
  if (!instance) {
    return {
      advanced,
      instance: null,
      nextGameId: null,
      nextProvenance: null,
      completed: false,
    };
  }
  const nextGameId =
    instance.status === "active"
      ? (instance.gameIds[instance.currentIndex] ?? null)
      : null;
  return {
    advanced,
    instance,
    nextGameId,
    nextProvenance: nextGameId
      ? {
          instanceKey: instance.date,
          legIndex: instance.currentIndex,
          gameId: nextGameId,
        }
      : null,
    completed: instance.status === "completed",
  };
}

/** Current durable instance for the launch tuple; null when unavailable. */
async function readCurrentInstance(
  signal: WorkoutSessionSignal,
): Promise<WorkoutInstance | null> {
  const provenance = signal.workoutProvenance;
  if (!provenance) {
    return null;
  }
  try {
    return await getDb().workouts.getByDate(provenance.instanceKey);
  } catch (error) {
    console.error("[workout] current-instance read failed", error);
    return null;
  }
}

/**
 * Advance the owned leg for a persisted session (or resolve the current leg
 * when there is nothing left to advance). Rejections from the durable write
 * propagate so each caller can surface the failure honestly.
 */
export async function advanceWorkoutForSession(
  signal: WorkoutSessionSignal,
): Promise<WorkoutSessionAdvanceResult> {
  const db = getDb();
  const loaded = await db.workouts.findActiveInstanceForSession(signal);

  // Not the owning current leg: already advanced/completed/standalone. Repair
  // the durable row before navigating: since 056 the pure repair can
  // substitute a retired leg, and navigation computed from an unrepaired row
  // would point Next at a game the durable row does not own (standalone
  // save, no advance). `reconcile` persists only when the repair changed
  // anything, so this stays a read in the common no-drift case.
  if (!shouldAdvanceWorkout(signal, loaded)) {
    const current = await readCurrentInstance(signal);
    if (current) {
      try {
        const repaired =
          (await db.workouts.reconcile(current.date, eligibleGameIds())) ??
          current;
        return withNavigation(repaired, false);
      } catch (error) {
        console.error("[workout] navigation reconciliation failed", error);
      }
    }
    // Persist-repair unavailable (failing store): navigate from the repaired
    // shape anyway. A Next launch from it degrades to a standalone save by
    // design (ownership fails safely) rather than crashing or pointing at a
    // retired game — no false credit is possible on this path (056 F5).
    return withNavigation(
      reconcileWorkout(current, eligibleGameIds()).instance,
      false,
    );
  }

  const { advanced, instance } = await db.workouts.advanceForSession(signal);

  // Repair any retired future legs before exposing the next provenance to the
  // UI, otherwise a Next Game launch could point at an index the durable row
  // no longer considers playable. Advancement is already durable; a transient
  // reconciliation failure must not turn it into a visible error.
  let display = instance;
  if (instance && instance.status === "active") {
    try {
      display =
        (await db.workouts.reconcile(instance.date, eligibleGameIds())) ??
        instance;
    } catch (error) {
      console.error("[workout] advance reconciliation failed", error);
    }
  }
  // `display` is already repaired+persisted above, so this pure call is a
  // no-op convergence check, not a second repair.
  return withNavigation(
    reconcileWorkout(display, eligibleGameIds()).instance,
    advanced,
  );
}
