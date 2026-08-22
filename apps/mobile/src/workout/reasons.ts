/**
 * Workout Engine V2 — surfacing personalization reasons.
 *
 * The daily path's reasons come straight from the EXISTING personalize seam
 * (`explainPersonalizedWorkout` in `@/workout/personalize`, consumed
 * read-only — that file is owned by W07 and its API is frozen). Template
 * selections are classified locally but reuse the same reason vocabulary and
 * the same weak-domain threshold constant, so UI copy is uniform across both
 * workout kinds and a W07 threshold change flows through automatically.
 *
 * Pure and deterministic: same inputs → same reasons. Reasons never change a
 * selection; they only explain it (constitution §14 "explainable" queue).
 */

import type { GameDefinition } from "@/sdk";
import {
  explainPersonalizedWorkout,
  STALE_DOMAIN_DAYS,
  WEAK_DOMAIN_RATING_THRESHOLD,
  type DomainRating,
  type PersonalizeOptions,
  type WorkoutSelectionReason,
} from "./personalize";
import type { WorkoutMetadata } from "./metadata";

/**
 * Reasons for the default daily workout, in selection order. Thin documented
 * passthrough over the frozen personalize API so consumers have one import
 * site for "why does my workout look like this".
 */
export function explainDailyWorkout(
  games: readonly GameDefinition[],
  date: string,
  domainRatings: readonly DomainRating[],
  recentGameIds: readonly string[],
  attempt = 0,
  exclude: readonly string[] = [],
  options: PersonalizeOptions = {},
): WorkoutSelectionReason[] {
  return explainPersonalizedWorkout(
    games,
    date,
    domainRatings,
    recentGameIds,
    attempt,
    exclude,
    options,
  );
}

/** Indexes for fast classification inside {@link explainTemplateWorkout}. */
function buildRatingIndex(domainRatings: readonly DomainRating[]): {
  ratingByDomain: Map<string, number>;
  updatedAtByDomain: Map<string, number>;
} {
  const ratingByDomain = new Map<string, number>();
  const updatedAtByDomain = new Map<string, number>();
  for (const { domain, rating, updatedAt } of domainRatings) {
    ratingByDomain.set(domain, rating);
    if (typeof updatedAt === "number") {
      updatedAtByDomain.set(domain, updatedAt);
    }
  }
  return { ratingByDomain, updatedAtByDomain };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a domain rating is stale under `options`. Mirrors the private rule
 * in personalize.ts (`now - updatedAt > maxAgeDays`, strict inequality) so
 * both paths label identical ratings identically; keep the two aligned when
 * either changes.
 */
function isStale(
  updatedAt: number | undefined,
  options: PersonalizeOptions,
): boolean {
  if (options.nowMs === undefined || typeof updatedAt !== "number") {
    return false;
  }
  const maxAgeDays = options.staleDays ?? STALE_DOMAIN_DAYS;
  return options.nowMs - updatedAt > maxAgeDays * DAY_MS;
}

/**
 * Reasons for a TEMPLATE selection, in selection order, using the same
 * vocabulary as the daily explainer: excluded → weak-domain → stale-domain →
 * recency-avoided → selected. The focus template itself guarantees the
 * domain targeting, so reasons describe the PERSONALIZATION layer only.
 */
export function explainTemplateWorkout(
  selection: readonly GameDefinition[],
  domainRatings: readonly DomainRating[],
  recentGameIds: readonly string[],
  exclude: readonly string[] = [],
  options: PersonalizeOptions = {},
): WorkoutSelectionReason[] {
  const { ratingByDomain, updatedAtByDomain } = buildRatingIndex(domainRatings);
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
    if (isStale(updatedAtByDomain.get(game.primaryCategory), options)) {
      const ageDays = Math.floor(
        ((options.nowMs ?? 0) -
          (updatedAtByDomain.get(game.primaryCategory) ?? 0)) /
          DAY_MS,
      );
      return {
        gameId: game.id,
        kind: "stale-domain",
        detail: `rusty ${game.primaryCategory} domain (rating ${rating}, not played for ~${ageDays}d)`,
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

/**
 * Recorded creation-time reasons for a persisted instance, surfaced ONLY when
 * they still describe the instance's CURRENT selection: the recorded gameId
 * sequence must match `gameIds` one-for-one. Rerolls (which replace the
 * unplayed tail) and catalog reconciliation (which drops retired ids) change
 * `gameIds` after creation, so their rows degrade to null instead of showing
 * provenance that no longer matches what the player actually sees. Pure and
 * cheap — no db, no clock, no catalog access.
 */
export function alignedRecordedReasons(
  gameIds: readonly string[],
  metadata: WorkoutMetadata | undefined,
): WorkoutSelectionReason[] | null {
  const recorded = metadata?.reasons;
  if (!recorded || recorded.length !== gameIds.length) {
    return null;
  }
  for (let i = 0; i < gameIds.length; i += 1) {
    if (recorded[i].gameId !== gameIds[i]) {
      return null;
    }
  }
  return recorded.map((reason) => ({ ...reason }));
}
