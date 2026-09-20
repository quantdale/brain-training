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
 *  - keeping the played prefix `gameIds[0, currentIndex)` byte-identical
 *    (played history is immutable, even when a played game is retired),
 *  - filtering only unplayed positions to eligible games (first-occurrence
 *    order, duplicates collapsed),
 *  - deterministically substituting retired future legs from the eligible
 *    pool (pool order, excluding present ids) so the instance length is
 *    preserved and no credit is granted for unplayed legs (056),
 *  - leaving a `completed` instance's game list byte-identical (historical
 *    record — only a corrupted index is clamped, never resurrected and never
 *    rewritten),
 *  - returning `null` when no played leg exists to protect and no unplayed
 *    leg survives (fully-stale instance or corrupt empty row: the caller
 *    regenerates through the real seeded selection).
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
  const pool: readonly string[] = Array.isArray(eligibleIds)
   ? eligibleIds
   : [...eligibleIds];

  // Clamp a corrupted persisted index into [0, length] before using it: a
  // negative index would otherwise feed `slice(0, oldIndex)` its negative-
  // from-the-end semantics and mis-place the resume point (Queue A: no crash /
  // no silent mis-repair on drifted rows).
  const rawIndex = Number.isFinite(instance.currentIndex)
   ? Math.trunc(instance.currentIndex)
   : 0;
  const oldIndex = Math.min(
   Math.max(rawIndex, 0),
   instance.gameIds.length,
  );

  // Played history is immutable: positions below the resume point are kept
  // verbatim even when a played game has since been retired. Only unplayed
  // positions are filtered to eligible games (first occurrence wins, so a
  // drifted row storing the same game twice cannot double-count).
  const played = instance.gameIds.slice(0, oldIndex);
  const seenFuture = new Set<string>();
  const future = instance.gameIds.slice(oldIndex).filter((id) => {
   if (!eligible.has(id) || seenFuture.has(id)) {
    return false;
   }
   seenFuture.add(id);
   return true;
  });

  // Substitute retired future legs deterministically from the eligible pool
  // (pool order, excluding every id already present) so the instance keeps
  // its length and the resume point keeps pointing at a playable game. The
  // user must still play the substitute — no credit is granted for the
  // retired leg (056). When the pool is exhausted the list truncates and the
  // end-of-list rule below applies (degenerate only: the live catalog always
  // carries dozens of eligible games).
  if (played.length === 0 && future.length === 0) {
   // No played leg to protect and no unplayed leg survives (fully-stale
   // instance or corrupt empty row): signal regeneration so the caller runs
   // the real seeded selection instead of an unseeded pool-order fill.
   return { instance: null, changed: true };
  }

  // A completed instance is a historical record: its game list is verbatim
  // and only a corrupted index is clamped. Future legs are NOT substituted
  // here — rewriting a finished workout's history would mis-report what was
  // actually played (056 F3).
  if (instance.status === "completed") {
   const newIndex = Math.min(oldIndex, instance.gameIds.length);
   if (newIndex === instance.currentIndex) {
    return { instance, changed: false };
   }
   return {
    instance: { ...instance, currentIndex: newIndex },
    changed: true,
   };
  }

  const present = new Set<string>([...played, ...future]);
  const substitutes = pool
   .filter((id) => !present.has(id))
   .slice(0, instance.gameIds.length - played.length - future.length);
  const gameIds = [...played, ...future, ...substitutes];

  // An active instance completes only when the resume point reaches the end
  // of the repaired list, i.e. every remaining playable leg was played (or
  // no playable leg remains in the degenerate pool-exhausted case).
  let newIndex: number;
  let status: WorkoutInstance["status"];
  newIndex = oldIndex;
  status = newIndex >= gameIds.length ? "completed" : "active";

  const changed =
   gameIds.length !== instance.gameIds.length ||
   gameIds.some((id, i) => id !== instance.gameIds[i]) ||
   newIndex !== instance.currentIndex ||
   status !== instance.status;

  if (!changed) {
   return { instance, changed: false };
  }

  return {
   instance: {
    ...instance,
    gameIds,
    currentIndex: newIndex,
    status,
   },
   changed: true,
  };
}
