/**
 * Personalization layer over the deterministic daily-workout core (today.ts).
 *
 * `today.ts` stays the deterministic selection core (constitution §14: daily
 * workout, chain-based soft avoidance, seeded rerolls). This module layers
 * two PURE reorderings on top of its output:
 *
 * - `rankByRecency` — games played recently (per the last sessions, in the
 *   newest-first order the db history queries return) move to the tail of the
 *   selection, so fresh games lead the workout.
 * - `reorderByWeakDomains` — games whose `primaryCategory` domain rating is
 *   below `WEAK_DOMAIN_RATING_THRESHOLD` surface before the rest, so the
 *   workout leans on the domains the player is currently weakest in
 *   (constitution §14 balancing inputs).
 *
 * Seed scheme: the personalized composition derives its own RNG stream from
 * `workout::<date>::<attempt>::personalized` — the `::personalized` suffix
 * keeps this layer's stream independent of the base pick's
 * `workout::<date>::<attempt>` stream (mirroring the `Rng.fork` philosophy),
 * so reordering changes never reshuffle the base selection. The same date,
 * attempt and inputs always yield the same workout.
 *
 * Everything here is pure: no db access and no imports from `@/db/**`.
 * `DomainRating` is a structural view so callers can pass db rows directly.
 */

import { createRng } from "@/sdk";
import type { GameDefinition, Rng } from "@/sdk";
import { dailyWorkout } from "./today";

/**
 * Structural view of a domain rating (shape-compatible with `DomainRating`
 * in src/db/rating.ts; kept local so this module has zero db imports).
 * Only `domain`/`rating` are consumed here; the optional fields mirror the
 * db row so callers can pass full rows without casts.
 */
export interface DomainRating {
 domain: string;
 rating: number;
 sessions?: number;
 updatedAt?: number;
}

/**
 * A domain is treated as "weak" when its rating is below this threshold.
 * Matches `INITIAL_RATING` (1000) in src/db/rating.ts: a domain that was
 * never played sits exactly at the initial rating, so only domains that have
 * ACTIVELY declined are favored (a test pins the two constants together).
 * Domain-to-category matching compares `game.primaryCategory` against
 * `DomainRating.domain` — the rating pipeline stores the primary category
 * string itself (see `getDomains` in src/app/_layout.tsx), so the comparison
 * is exact by construction.
 */
export const WEAK_DOMAIN_RATING_THRESHOLD = 1000;

/**
 * Reorder `games` (a copy) so games whose `primaryCategory` domain rating is
 * below `WEAK_DOMAIN_RATING_THRESHOLD` come first, then the rest — weakest
 * domain first within each group, so the workout surfaces the domains the
 * player is currently weakest in. Domains absent from `domainRatings` are
 * treated as at the threshold (never played ⇒ initial rating), so they are
 * never labeled weak.
 *
 * The sort is STABLE: games with equal ratings keep their input relative
 * order, so when this runs after `rankByRecency` the recency ordering
 * survives as the tie-break (fresh games stay ahead of recently played ones
 * within equal ratings). Deterministic by construction — the same inputs
 * always yield the same result. `rng` is accepted for API uniformity with
 * the seeded composition (`personalizedWorkout`); the ordering itself is
 * rating-determined, so any seed yields the same order and a future
 * seed-varied tie-break can be added without breaking callers. The input
 * array is never mutated.
 */
export function reorderByWeakDomains(
 games: readonly GameDefinition[],
 domainRatings: readonly DomainRating[],
 rng: Rng,
): GameDefinition[] {
 if (games.length === 0) {
  return [];
 }

 const ratingByDomain = new Map<string, number>();
 for (const { domain, rating } of domainRatings) {
  ratingByDomain.set(domain, rating);
 }

 const rated = games.map((game, index) => ({
  game,
  rating:
   ratingByDomain.get(game.primaryCategory) ?? WEAK_DOMAIN_RATING_THRESHOLD,
  index,
 }));

 return rated
  .sort((a, b) => {
   const weakA = a.rating < WEAK_DOMAIN_RATING_THRESHOLD ? 0 : 1;
   const weakB = b.rating < WEAK_DOMAIN_RATING_THRESHOLD ? 0 : 1;
   return weakA - weakB || a.rating - b.rating || a.index - b.index;
  })
  .map(({ game }) => game);
}

/**
 * Reorder `games` (a copy) so games appearing in `recentGameIds` move to the
 * tail, keeping the rest in input order. `recentGameIds` follows the db
 * session-history convention (most recent first, as returned by the
 * `ORDER BY completed_at DESC` queries): the tail is laid out oldest-first so
 * the MOST recently played game lands last. Ids not present in `games` are
 * ignored; duplicates are dropped. Deterministic — no randomness involved.
 */
export function rankByRecency(
 games: readonly GameDefinition[],
 recentGameIds: readonly string[],
): GameDefinition[] {
 if (games.length === 0) {
  return [];
 }

 const recentSet = new Set(recentGameIds);
 const fresh = games.filter((game) => !recentSet.has(game.id));

 const gameById = new Map<string, GameDefinition>();
 for (const game of games) {
  gameById.set(game.id, game);
 }

 // Reverse the newest-first input so the tail runs oldest → newest; the
 // most recently played game therefore ends up last.
 const tail: GameDefinition[] = [];
 const seen = new Set<string>();
 for (let i = recentGameIds.length - 1; i >= 0; i -= 1) {
  const id = recentGameIds[i];
  const game = gameById.get(id);
  if (game !== undefined && !seen.has(id)) {
   seen.add(id);
   tail.push(game);
  }
 }

 return [...fresh, ...tail];
}

/**
 * Personalized workout for a local calendar date: the deterministic base
 * selection (`dailyWorkout`, `attempt`-seeded reroll) reordered by recency
 * (recently played games to the tail) and then by weak domains (weakest
 * domains first). The reordering stream is seeded from
 * `workout::<date>::<attempt>::personalized` (see module comment). Pure and
 * deterministic: the same inputs always return the same selection.
 */
export function personalizedWorkout(
 games: readonly GameDefinition[],
 date: string,
 domainRatings: readonly DomainRating[],
 recentGameIds: readonly string[],
 attempt = 0,
 exclude: readonly string[] = [],
): GameDefinition[] {
 if (games.length === 0) {
  return [];
 }

 const base = dailyWorkout(games, date, attempt, exclude);
 const rng = createRng(`workout::${date}::${attempt}::personalized`);
 return reorderByWeakDomains(
  rankByRecency(base, recentGameIds),
  domainRatings,
  rng,
 );
}

/** One line of human-readable rationale for why a game sits where it does. */
export interface WorkoutSelectionReason {
 gameId: string;
 /** 'weak-domain' | 'recency-avoided' | 'selected' | 'excluded' */
 kind: "weak-domain" | "recency-avoided" | "selected" | "excluded";
 detail: string;
}

/**
 * Explainable companion to `personalizedWorkout` (constitution §14 + Queue B:
 * "explainable"). Returns, in selection order, a short reason per game so the
 * UI or diagnostics can show *why* each game was chosen. Pure and
 * deterministic — same inputs yield the same reasons. Intended for telemetry/
 * diagnostics and optional player-facing hints; it never changes the actual
 * selection.
 */
export function explainPersonalizedWorkout(
 games: readonly GameDefinition[],
 date: string,
 domainRatings: readonly DomainRating[],
 recentGameIds: readonly string[],
 attempt = 0,
 exclude: readonly string[] = [],
): WorkoutSelectionReason[] {
 const selection = personalizedWorkout(
  games,
  date,
  domainRatings,
  recentGameIds,
  attempt,
  exclude,
 );
 const ratingByDomain = new Map<string, number>();
 for (const { domain, rating } of domainRatings) {
  ratingByDomain.set(domain, rating);
 }
 const recentSet = new Set(recentGameIds);
 const excludeSet = new Set(exclude);

 return selection.map((game) => {
  if (excludeSet.has(game.id)) {
   return {
    gameId: game.id,
    kind: "excluded",
    detail: "excluded (already played)",
   };
  }
  const rating =
   ratingByDomain.get(game.primaryCategory) ?? WEAK_DOMAIN_RATING_THRESHOLD;
  if (rating < WEAK_DOMAIN_RATING_THRESHOLD) {
   return {
    gameId: game.id,
    kind: "weak-domain",
    detail: `weak ${game.primaryCategory} domain (rating ${rating})`,
   };
  }
  if (recentSet.has(game.id)) {
   return {
    gameId: game.id,
    kind: "recency-avoided",
    detail: "recently played, lower priority",
   };
  }
  return { gameId: game.id, kind: "selected", detail: "balanced selection" };
 });
}
