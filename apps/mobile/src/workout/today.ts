/**
 * Today's Workout — deterministic daily selection (constitution §14).
 *
 * Every local calendar date deterministically selects up to WORKOUT_SIZE
 * distinct games from the registered catalog. The pick soft-avoids
 * same-game consecutive days (at most MAX_OVERLAP_WITH_YESTERDAY games may
 * repeat from yesterday) BY CONSTRUCTION, and additionally maximizes
 * cognitive-domain diversity (constitution §14: "balancing weaker/declining/
 * undertrained domains, recency avoidance, randomness") so a single workout
 * does not collapse onto one or two categories even when the catalog is
 * small. A reroll passes an `exclude` list (already-played games) so the new
 * tail never reintroduces a game the player has already completed.
 *
 * Seeding: `workout::<date>::<attempt>` through the SDK RNG, so the same date
 * always yields the same workout and a reroll (`attempt`) is a deterministic
 * alternative. No persistence needed.
 */

import { createRng } from "@/sdk";
import type { GameDefinition, Rng } from "@/sdk";

/** Constitution §14: normally four games. */
export const WORKOUT_SIZE = 4;

/** Soft cap on same-game consecutive days (1 = at most one repeat). */
export const MAX_OVERLAP_WITH_YESTERDAY = 1;

/**
 * Stratified, deterministic pick that maximizes cognitive-domain coverage.
 *
 * Given a candidate pool, it round-robins across categories (in an
 * rng-shuffled category order, picking one rng-shuffled game per category per
 * round) so the result spans as many distinct `primaryCategory` values as the
 * pool allows before any category is repeated. This is what keeps a daily
 * workout from collapsing onto, say, three Memory games, and it scales to any
 * catalog size without hardcoding counts. The input arrays are never mutated.
 *
 * If `count` exceeds the number of distinct categories, the remaining slots
 * are filled deterministically from whatever games are left (so a 3-category
 * catalog still yields a full 4-game set). When the pool is smaller than
 * `count`, the whole pool is returned.
 */
export function pickDiverse(
 pool: readonly GameDefinition[],
 count: number,
 rng: Rng,
): GameDefinition[] {
 if (pool.length <= count) {
  return pool.slice();
 }
 if (count <= 0) {
  return [];
 }

 // Group by primary category; each category's games are shuffled once.
 const byCategory = new Map<string, GameDefinition[]>();
 for (const game of pool) {
  const list = byCategory.get(game.primaryCategory);
  if (list) {
   list.push(game);
  } else {
   byCategory.set(game.primaryCategory, [game]);
  }
 }
 for (const list of byCategory.values()) {
  const shuffled = rng.shuffle(list);
  byCategory.set(
   shuffled[0]?.primaryCategory ?? list[0].primaryCategory,
   shuffled,
  );
 }

 const categoryOrder = rng.shuffle([...byCategory.keys()]);
 const result: GameDefinition[] = [];
 // Round-robin until we have `count` games or every category is exhausted.
 for (let round = 0; result.length < count; round += 1) {
  let advanced = false;
  for (const category of categoryOrder) {
   const list = byCategory.get(category);
   if (list && list.length > 0) {
    result.push(list.shift() as GameDefinition);
    advanced = true;
    if (result.length >= count) {
     break;
    }
   }
  }
  if (!advanced) {
   break; // no categories have games left
  }
  void round;
 }

 // More slots than distinct categories: top up from the remaining pool.
 if (result.length < count) {
  const taken = new Set(result);
  const rest = rng.shuffle(pool.filter((game) => !taken.has(game)));
  for (const game of rest) {
   if (result.length >= count) {
    break;
   }
   result.push(game);
  }
 }

 return result;
}

/**
 * Deterministically pick up to WORKOUT_SIZE games for a date, with at most
 * MAX_OVERLAP_WITH_YESTERDAY overlap with `previousGames` when the catalog
 * allows it. The same `(date, attempt, games, exclude)` always returns the
 * same selection; `attempt` > 0 is a seeded reroll (free first reroll per
 * constitution §14; costs are Phase-3 economics). `exclude` is a hard filter
 * of game ids that must never appear (e.g. games the player already completed
 * this instance) — used by rerolls so a fresh tail never reintroduces an
 * already-played game.
 */
export function pickWorkoutGames(
 games: readonly GameDefinition[],
 date: string,
 previousGames: readonly GameDefinition[] = [],
 attempt = 0,
 exclude: readonly string[] = [],
): GameDefinition[] {
 if (games.length === 0) {
  return [];
 }
 if (games.length <= WORKOUT_SIZE) {
  return games.slice();
 }

 const excludeSet = new Set(exclude);
 // Hard exclusions (already-played games for a reroll). If excluding them
 // would leave too few candidates, relax the exclusion rather than produce a
 // degenerate (empty or oversized) workout — robustness for tiny catalogs.
 const eligible =
  excludeSet.size > 0 && games.length - excludeSet.size < WORKOUT_SIZE
   ? games
   : games.filter((game) => !excludeSet.has(game.id));
 if (eligible.length <= WORKOUT_SIZE) {
  return eligible.slice();
 }

 const size = WORKOUT_SIZE;
 const previousSet = new Set(previousGames);
 const fresh = eligible.filter((game) => !previousSet.has(game));
 const rng = createRng(`workout::${date}::${attempt}`);

 // Leave `cap` slots for yesterday's games (variety + soft avoidance by
 // construction). When the fresh pool is smaller, take all of it.
 const fromFreshCount = Math.min(
  fresh.length,
  size - MAX_OVERLAP_WITH_YESTERDAY,
 );
 const fromFresh = pickDiverse(fresh, fromFreshCount, rng);

 const fromFreshSet = new Set(fromFresh);
 const fillPool = eligible.filter((game) => !fromFreshSet.has(game));
 const fill = pickDiverse(fillPool, size - fromFresh.length, rng);

 return [...fromFresh, ...fill];
}

/** Previous local calendar date (YYYY-MM-DD), leap-year aware. */
export function previousDate(date: string): string {
 const [year, month, day] = date.split("-").map(Number);
 const dt = new Date(Date.UTC(year, month - 1, day));
 dt.setUTCDate(dt.getUTCDate() - 1);
 return dt.toISOString().slice(0, 10);
}

/** Next local calendar date (YYYY-MM-DD), leap-year aware. */
export function nextDate(date: string): string {
 const [year, month, day] = date.split("-").map(Number);
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
export const WORKOUT_CHAIN_BASE = "2026-01-01";

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
 exclude: readonly string[] = [],
): GameDefinition[] {
 if (games.length === 0) {
  return [];
 }
 if (games.length <= WORKOUT_SIZE) {
  return games.slice();
 }
 if (date < WORKOUT_CHAIN_BASE) {
  return pickWorkoutGames(games, date, [], attempt, exclude);
 }

 let cursor = WORKOUT_CHAIN_BASE;
 let previous: GameDefinition[] = pickWorkoutGames(games, WORKOUT_CHAIN_BASE);
 while (cursor < date) {
  cursor = nextDate(cursor);
  previous = pickWorkoutGames(games, cursor, previous);
 }
 // `previous` is now the actual workout for `date` (it avoided the day
 // before). A reroll re-picks today against the same reference, excluding any
 // already-played games so the new tail never reintroduces them.
 return attempt > 0
  ? pickWorkoutGames(games, date, previous, attempt, exclude)
  : previous;
}

/** Current local calendar date as YYYY-MM-DD (constitution §14: local date). */
export function localDateString(now: Date = new Date()): string {
 const year = now.getFullYear();
 const month = String(now.getMonth() + 1).padStart(2, "0");
 const day = String(now.getDate()).padStart(2, "0");
 return `${year}-${month}-${day}`;
}
