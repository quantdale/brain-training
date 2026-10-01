/**
 * Skip policy for Daily Workout legs (Change 073, design D4).
 *
 * WHY SKIP EXISTS
 * ---------------
 * Before 073 a player who did not want the current leg had exactly one exit:
 * rerolls, which are capped per day and escalate in coin cost. A content
 * preference was turned into a paid action, and there was no way to end a
 * workout at all. A free, explicit skip serves both needs — leave one leg, or
 * walk away from the whole plan — and is recorded as `skipped`, which is a
 * different leg outcome from `completed`: no session, no XP, no coins.
 *
 * WHY THE ALLOWANCE IS `length - 1`
 * --------------------------------
 * The bound is not about currency (a skipped leg awards nothing at all); it is
 * about the one thing a completed workout still confers: the
 * `workout-completions` achievements ("Complete 10 daily workouts"). If a
 * workout could be completed with zero play, those would be farmable without
 * touching a game. So a completed workout must always contain at least one
 * PLAYED leg, which means the final leg can never be consumed by a skip.
 *
 * The rule is stated on the control (task 3.4) rather than discovered: the
 * skip affordance shows how many skips remain, and when none remain it says
 * why — "play the last game to finish" — instead of silently disappearing.
 */

import type { WorkoutInstance } from "@/db";

/**
 * How many legs of this workout may still be skipped.
 *
 * The final leg is never skippable, so this is `length - 1` minus the legs
 * already skipped. It is zero for a one-leg workout (nothing to skip) and
 * never negative.
 */
export function skipsRemaining(instance: WorkoutInstance): number {
  const allowance = Math.max(0, instance.gameIds.length - 1);
  // Tolerant reader: the v13 column is nullable and legacy rows (and older
  // persisted shapes) read as "no skipped legs", exactly like `rowToInstance`
  // and `parseSkippedIndices` degrade to an empty list.
  const skipped = instance.skippedIndices?.length ?? 0;
  return Math.max(0, allowance - skipped);
}

/** True when the current leg can be skipped (allowance left and a leg remains). */
export function canSkipLeg(instance: WorkoutInstance): boolean {
  return (
    instance.status === "active" &&
    instance.currentIndex < instance.gameIds.length - 1 &&
    skipsRemaining(instance) > 0
  );
}

/**
 * Player-facing reason the skip affordance is unavailable, or null when it is
 * available. The UI shows this instead of hiding the control (task 3.4: the
 * behavior at the boundary is defined AND communicated).
 */
export function skipUnavailableReason(instance: WorkoutInstance): string | null {
  if (instance.status !== "active") {
    return "This workout is already finished";
  }
  if (instance.currentIndex >= instance.gameIds.length - 1) {
    return "Play the last game to finish this workout";
  }
  if (skipsRemaining(instance) <= 0) {
    return "No skips left in this workout";
  }
  return null;
}
