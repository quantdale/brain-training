/**
 * Transparent explanation of the overall performance composite.
 *
 * This feature deliberately does NOT invent a second score. It reuses the
 * canonical calculation in `@/rating/composite` (`computeComposite`) — the same
 * number the rest of the product trusts — and explains how it was derived from
 * the stored domain ratings so players can see exactly why they have the score
 * they have.
 *
 * Canonical rules (kept in sync with `computeComposite`):
 *  - every known domain is included;
 *  - an unseen domain (never played) contributes `INITIAL_RATING` at full weight;
 *  - a stale domain (not trained within `staleThresholdDays`) is weighted 0.5;
 *  - a fresh domain is weighted 1.0.
 * The composite is the weighted average of those contributions, rounded.
 */

import { INITIAL_RATING, isRatingStale } from '@/db/rating';
import type { DomainRating } from '@/db';
import { computeComposite, type DomainRatingWithStaleness } from '@/rating';

/** One domain's contribution to the composite explanation. */
export interface CompositeDomain {
  domain: string;
  /** Current rating, or `INITIAL_RATING` for an unseen domain. */
  rating: number;
  status: 'unseen' | 'stale' | 'fresh';
  /** Weight applied to this domain (0.5 for stale, 1.0 otherwise). */
  weight: number;
  /** Included in the average with this weight (always true here). */
  included: boolean;
}

/** Full explanation of the canonical composite for a snapshot in time. */
export interface CompositeExplanation {
  /** The composite value (authoritative, from `computeComposite`). */
  composite: number;
  /** Number of domains that have a real rating. */
  seenDomains: number;
  /** Number of domains never played (counted at `INITIAL_RATING`). */
  unseenDomains: number;
  /** Number of seen domains currently stale. */
  staleDomains: number;
  /** Per-domain breakdown, in display order. */
  domains: CompositeDomain[];
  /** The rating an unseen domain is treated as (floor reference). */
  initialRating: number;
  /** Staleness window used, in days. */
  staleThresholdDays: number;
}

/**
 * Build the explanation. `ratings` are the current `domain_ratings` rows;
 * `knownDomains` is the full set of cognitive domains (e.g. `GAME_CATEGORIES`).
 */
export function explainComposite(
  ratings: readonly DomainRating[],
  knownDomains: readonly string[],
  nowMs: number,
  staleThresholdDays = 30,
): CompositeExplanation {
  // Authoritative composite, reused verbatim — no second score is invented.
  const result = computeComposite(
    ratings as DomainRatingWithStaleness[],
    knownDomains,
    nowMs,
    staleThresholdDays,
  );

  const ratingMap = new Map<string, DomainRating>();
  for (const rating of ratings) {
    ratingMap.set(rating.domain, rating);
  }

  const domains: CompositeDomain[] = [];
  let seenDomains = 0;
  let unseenDomains = 0;
  let staleDomains = 0;

  // Known domains first, in canonical order, then any extras from the ratings.
  const ordered = [...knownDomains];
  for (const domain of ratingMap.keys()) {
    if (!ordered.includes(domain)) {
      ordered.push(domain);
    }
  }

  for (const domain of ordered) {
    const rating = ratingMap.get(domain);
    if (!rating) {
      unseenDomains += 1;
      domains.push({ domain, rating: INITIAL_RATING, status: 'unseen', weight: 1, included: true });
      continue;
    }
    seenDomains += 1;
    const stale = isRatingStale(rating.updatedAt, nowMs, staleThresholdDays);
    if (stale) {
      staleDomains += 1;
    }
    domains.push({
      domain,
      rating: rating.rating,
      status: stale ? 'stale' : 'fresh',
      weight: stale ? 0.5 : 1,
      included: true,
    });
  }

  return {
    composite: result.composite,
    seenDomains,
    unseenDomains,
    staleDomains,
    domains,
    initialRating: INITIAL_RATING,
    staleThresholdDays,
  };
}
