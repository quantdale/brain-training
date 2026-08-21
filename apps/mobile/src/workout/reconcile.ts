/**
 * Workout-instance reconciliation (Queue A: catalog changes / invalid game
 * IDs / registry drift / cross-day recovery).
 *
 * A persisted `WorkoutInstance` stores an ordered list of game ids. Those ids
 * were valid when the instance was created, but the registered catalog can
 * change between sessions (games added or retired by other workers, the
 * `language-word-match` freeze, etc.). If a stored id is no longer in the
 * eligible catalog, the workout pipeline must not crash, must not try to
 * launch a dead game, and must not silently mis-report progress.
 *
 * `reconcileWorkout` is a PURE repair: given the persisted instance and the
 * set of currently-eligible game ids, it returns a repaired instance (and
 * whether anything changed) by:
 *  - dropping game ids that are no longer eligible,
 *  - advancing `currentIndex` past any invalidated game so the resume point
 *    always lands on a playable game (or the end),
 *  - recomputing `status` from the repaired index,
 *  - returning `null` when every stored game is ineligible (caller regenerates).
 *
 * It never mutates its inputs and is fully deterministic — the same inputs
 * always yield the same repaired instance, so re-running it is idempotent.
 */
import { getAllGameDefinitions } from "@/registry/registry";
import type { GameDefinition } from "@/sdk";
import type { WorkoutInstance } from "@/db";

/**
 * Games frozen out of workout selection. Currently `language-word-match`
 * (kept out of the daily selection until its semantics are corrected). Central
 * here so the selection, reroll and reconciliation paths share one source of
 * truth instead of each re-listing the exclusion.
 */
export const EXCLUDED_FROM_WORKOUT = new Set<string>(["language-word-match"]);

/** Currently-eligible game ids (registered and not frozen). */
export function eligibleGameIds(): string[] {
 return getAllGameDefinitions()
  .filter((game) => !EXCLUDED_FROM_WORKOUT.has(game.id))
  .map((game) => game.id);
}

/** Currently-eligible game definitions (registered and not frozen). */
export function eligibleGames(): GameDefinition[] {
 return getAllGameDefinitions().filter(
  (game) => !EXCLUDED_FROM_WORKOUT.has(game.id),
 );
}

export interface ReconcileResult {
 /** Repaired instance, or null when no stored game remains eligible. */
 instance: WorkoutInstance | null;
 /** True when the returned instance differs from the input. */
 changed: boolean;
}

/**
 * Repair a persisted workout instance against the current eligible catalog.
 *
 * `eligibleIds` may be a `Set` or array of game ids that are currently
 * registered and allowed in a workout.
 */
export function reconcileWorkout(
 instance: WorkoutInstance | null,
 eligibleIds: ReadonlySet<string> | readonly string[],
): ReconcileResult {
 if (!instance) {
  return { instance: null, changed: false };
 }
 const eligible =
  eligibleIds instanceof Set ? eligibleIds : new Set(eligibleIds);

 const validIds = instance.gameIds.filter((id) => eligible.has(id));
 if (validIds.length === 0) {
  // Every stored game was retired / is ineligible: signal regeneration.
  return { instance: null, changed: true };
 }

 // Clamp a corrupted persisted index into [0, length] before using it: a
 // negative index would otherwise feed `slice(0, oldIndex)` its negative-
 // from-the-end semantics and mis-place the resume point (Queue A: no crash /
 // no silent mis-repair on drifted rows).
 const oldIndex = Math.min(
  Math.max(Math.trunc(instance.currentIndex), 0),
  instance.gameIds.length,
 );
 const oldCurrentId = instance.gameIds[oldIndex];

 let newIndex: number;
 if (oldCurrentId !== undefined && eligible.has(oldCurrentId)) {
  // The current game survived: its new position is wherever it now sits in
  // the filtered (order-preserving) list.
  newIndex = validIds.indexOf(oldCurrentId);
 } else {
  // The current game was invalidated (retired): advance to the next still-
  // valid game. Count the valid games that were before the old index; the
  // resume point is that many valid games deeper, clamped to the end.
  const validBeforeOld = instance.gameIds
   .slice(0, oldIndex)
   .filter((id) => eligible.has(id)).length;
  newIndex = Math.min(validBeforeOld, validIds.length);
 }

 const status = newIndex >= validIds.length ? "completed" : instance.status;

 const changed =
  validIds.length !== instance.gameIds.length ||
  validIds.some((id, i) => id !== instance.gameIds[i]) ||
  newIndex !== instance.currentIndex ||
  status !== instance.status;

 if (!changed) {
  return { instance, changed: false };
 }

 return {
  instance: {
   ...instance,
   gameIds: validIds,
   currentIndex: newIndex,
   status,
  },
  changed: true,
 };
}
