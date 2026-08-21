/**
 * Reroll economics for Today's Workout (constitution §14: "One free reroll;
 * additional rerolls may cost normal in-game currency").
 *
 * Economics:
 * - The first reroll per day is free (`REROLL_FIRST_FREE`).
 * - From the second reroll on, the cost is `REROLL_COST_COINS` coins per
 *   reroll already used that day — escalating (25, 50, 75, ...), so repeated
 *   rerolls get progressively more expensive.
 * - At most `MAX_REROLLS_PER_DAY` rerolls per day.
 *
 * `attemptsUsed` is the number of rerolls already consumed today (the base
 * workout is attempt 0 and corresponds to `attemptsUsed === 0`). All
 * functions here are pure; callers own the ledger debit and the persistence
 * of `attemptsUsed`.
 */

import type { GameDefinition } from "@/sdk";
import { personalizedWorkout } from "./personalize";
import type { DomainRating } from "./personalize";

/** Constitution §14: the first reroll each day is free. */
export const REROLL_FIRST_FREE = true;

/** Coin cost of the second (first paid) reroll; later rerolls escalate × attemptsUsed. */
export const REROLL_COST_COINS = 25;

/** Hard cap on rerolls per day (free + paid). */
export const MAX_REROLLS_PER_DAY = 5;

/**
 * Cost of the NEXT reroll given the number of rerolls already used today.
 * Zero when `attemptsUsed === 0` (first-free); otherwise
 * `REROLL_COST_COINS × attemptsUsed` — escalating, so the 2nd reroll costs
 * 25 coins, the 3rd 50, and so on.
 */
export function rerollCost(attemptsUsed: number): number {
 if (attemptsUsed <= 0) {
  return 0;
 }
 return REROLL_COST_COINS * attemptsUsed;
}

/**
 * Whether a reroll may be taken now: the daily cap must not be exhausted and
 * the coin balance must cover `rerollCost(attemptsUsed)`. Pure — callers
 * debit the ledger themselves when this returns true.
 */
export function canAffordReroll(
 balance: number,
 attemptsUsed: number,
): boolean {
 if (attemptsUsed >= MAX_REROLLS_PER_DAY) {
  return false;
 }
 return balance >= rerollCost(attemptsUsed);
}

/**
 * The selection a reroll would produce: the `attemptsUsed + 1`-th seeded
 * variant of `personalizedWorkout` (attempt 0 is the base workout, so the
 * first reroll is attempt 1). `exclude` lists game ids that must not appear
 * in the new selection (typically the already-completed prefix of the current
 * instance) so a reroll after partial completion never reintroduces a game
 * the player has already finished. Pure — callers must check
 * `canAffordReroll` and debit the ledger before applying it.
 */
export function nextWorkoutAfterReroll(
 games: readonly GameDefinition[],
 date: string,
 domainRatings: readonly DomainRating[],
 recentGameIds: readonly string[],
 attemptsUsed: number,
 exclude: readonly string[] = [],
): GameDefinition[] {
 return personalizedWorkout(
  games,
  date,
  domainRatings,
  recentGameIds,
  attemptsUsed + 1,
  exclude,
 );
}
