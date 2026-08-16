/**
 * Today's Workout — deterministic daily selection (constitution §14).
 *
 * Basic Phase-2 implementation (full personalization/reroll economics land in
 * Phase 3): every local calendar date deterministically selects up to
 * WORKOUT_SIZE distinct games from the registered catalog, soft-avoiding
 * same-game consecutive days: at most MAX_OVERLAP_WITH_YESTERDAY games may
 * repeat from yesterday, satisfied BY CONSTRUCTION — the pick takes
 * `size - cap` games from the non-yesterday pool and fills the remainder
 * from yesterday's games (so with an 8-game catalog today's set is 3 fresh +
 * 1 repeat, never a full repeat and never a full complement alternation).
 *
 * Seeding: `workout::<date>::<attempt>` through the SDK RNG, so the same date
 * always yields the same workout and a reroll (`attempt`) is a deterministic
 * alternative. No persistence needed.
 */

import { createRng } from '@/sdk';
import type { GameDefinition } from '@/sdk';

/** Constitution §14: normally four games. */
export const WORKOUT_SIZE = 4;

/** Soft cap on same-game consecutive days (1 = at most one repeat). */
export const MAX_OVERLAP_WITH_YESTERDAY = 1;

/**
 * Deterministically pick up to WORKOUT_SIZE games for a date, with at most
 * MAX_OVERLAP_WITH_YESTERDAY overlap with `previousGames` when the catalog
 * allows it. The same `(date, attempt, games)` always returns the same
 * selection; `attempt` > 0 is a seeded reroll (free first reroll per
 * constitution §14; costs are Phase-3 economics).
 */
export function pickWorkoutGames(
  games: readonly GameDefinition[],
  date: string,
  previousGames: readonly GameDefinition[] = [],
  attempt = 0,
): GameDefinition[] {
  if (games.length === 0) {
    return [];
  }
  if (games.length <= WORKOUT_SIZE) {
    return games.slice();
  }

  const size = WORKOUT_SIZE;
  const previousSet = new Set(previousGames);
  const fresh = games.filter((game) => !previousSet.has(game));
  const rng = createRng(`workout::${date}::${attempt}`);

  // Leave `cap` slots for yesterday's games (variety + soft avoidance by
  // construction). When the fresh pool is smaller, take all of it.
  const fromFreshCount = Math.min(fresh.length, size - MAX_OVERLAP_WITH_YESTERDAY);
  const fromFresh = rng.shuffle(fresh).slice(0, fromFreshCount);

  const fromFreshSet = new Set(fromFresh);
  const fillPool = games.filter((game) => !fromFreshSet.has(game));
  const fill = rng.shuffle(fillPool).slice(0, size - fromFresh.length);

  return [...fromFresh, ...fill];
}

/** Previous local calendar date (YYYY-MM-DD), leap-year aware. */
export function previousDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/** Next local calendar date (YYYY-MM-DD), leap-year aware. */
export function nextDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

/**
 * Deterministic chain anchor: the workout for this date is computed by
 * walking forward from a fixed base date, applying the avoidance rule day by
 * day, so consecutive days never share more than MAX_OVERLAP_WITH_YESTERDAY
 * games regardless of when the chain is first computed.
 */
export const WORKOUT_CHAIN_BASE = '2026-01-01';

/**
 * Today's workout for a local calendar date: each day's set soft-avoids the
 * ACTUAL previous day's workout (3 fresh + 1 repeat with an 8-game catalog).
 * `attempt` > 0 yields a deterministic reroll of today only (the first reroll
 * is free per constitution §14; costs are Phase-3 economics).
 */
export function dailyWorkout(
  games: readonly GameDefinition[],
  date: string,
  attempt = 0,
): GameDefinition[] {
  if (games.length === 0) {
    return [];
  }
  if (games.length <= WORKOUT_SIZE) {
    return games.slice();
  }
  if (date < WORKOUT_CHAIN_BASE) {
    return pickWorkoutGames(games, date, [], attempt);
  }

  let cursor = WORKOUT_CHAIN_BASE;
  let previous: GameDefinition[] = pickWorkoutGames(games, WORKOUT_CHAIN_BASE);
  while (cursor < date) {
    cursor = nextDate(cursor);
    previous = pickWorkoutGames(games, cursor, previous);
  }
  // `previous` is now the actual workout for `date` (it avoided the day
  // before). A reroll re-picks today against the same reference.
  return attempt > 0 ? pickWorkoutGames(games, date, previous, attempt) : previous;
}

/** Current local calendar date as YYYY-MM-DD (constitution §14: local date). */
export function localDateString(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
