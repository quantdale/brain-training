/**
 * Overall cognitive/performance composite (006R task 9.5).
 *
 * Computes a transparent overall score from domain ratings with documented
 * handling of unseen/stale domains. The composite is:
 * - Weighted average of all domain ratings
 * - Unseen domains (never played) are treated as at INITIAL_RATING (1000)
 * - Stale domains (not played recently) are weighted less (0.5 vs 1.0)
 *
 * This provides a single number that represents overall cognitive performance
 * across all domains, separate from engagement level/XP.
 *
 * Robustness: a corrupt row (non-finite rating or timestamp) must not poison
 * the whole average — a non-finite rating contributes INITIAL_RATING like an
 * unseen domain, and a non-finite timestamp is treated as stale (the more
 * conservative weight).
 */

import { INITIAL_RATING } from '@/db/rating';

/** Domain rating with staleness info */
export interface DomainRatingWithStaleness {
  domain: string;
  rating: number;
  sessions: number;
  updatedAt: number; // Unix epoch ms
}

/** Result of composite calculation */
export interface CompositeResult {
  /** Overall composite score (average of domain ratings) */
  composite: number;
  /** Number of domains contributing to the composite */
  domainCount: number;
  /** Number of stale domains (weighted less) */
  staleDomainCount: number;
  /** List of domains included in the composite */
  domains: string[];
}

/** Staleness weight applied to a stale (or corrupt-timestamp) domain. */
const STALE_WEIGHT = 0.5;

/**
 * Compute overall cognitive/performance composite from domain ratings.
 *
 * @param domainRatings Array of domain ratings with staleness info
 * @param knownDomains List of all known cognitive domains (from game categories)
 * @param nowMs Current time in milliseconds
 * @param staleThresholdDays Days after which a domain is considered stale (default: 30)
 * @returns Composite result with score and metadata
 */
export function computeComposite(
  domainRatings: readonly DomainRatingWithStaleness[],
  knownDomains: readonly string[],
  nowMs: number,
  staleThresholdDays: number = 30,
): CompositeResult {
  const staleThresholdMs = staleThresholdDays * 24 * 60 * 60 * 1000;

  // Build a map of domain -> rating
  const ratingMap = new Map<string, DomainRatingWithStaleness>();
  for (const rating of domainRatings) {
    ratingMap.set(rating.domain, rating);
  }

  // Membership set so the "ratings absent from knownDomains" fallback below
  // stays O(1) per entry instead of O(n) `includes` (quadratic worst case).
  const knownSet = new Set<string>(knownDomains);

  let totalRating = 0;
  let domainCount = 0;
  let staleDomainCount = 0;
  const domains: string[] = [];

  // Include all known domains
  for (const domain of knownDomains) {
    const rating = ratingMap.get(domain);

    if (rating && Number.isFinite(rating.rating)) {
      // Domain has been played
      // A non-finite updatedAt cannot be compared meaningfully; treat it as
      // stale so corrupt timestamps get the conservative weight.
      const isStale =
        !Number.isFinite(rating.updatedAt) ||
        nowMs - rating.updatedAt > staleThresholdMs;

      // Weight stale domains less (0.5 weight)
      const weight = isStale ? STALE_WEIGHT : 1;
      totalRating += rating.rating * weight;
      domainCount += weight;

      if (isStale) {
        staleDomainCount++;
      }
    } else {
      // Domain never played (or corrupt rating) - treat as INITIAL_RATING with full weight
      totalRating += INITIAL_RATING;
      domainCount += 1;
    }

    domains.push(domain);
  }

  // Also include any domains not in knownDomains but present in ratings
  for (const [domain, rating] of ratingMap) {
    if (!knownSet.has(domain)) {
      const isStale =
        !Number.isFinite(rating.updatedAt) ||
        nowMs - rating.updatedAt > staleThresholdMs;
      const weight = isStale ? STALE_WEIGHT : 1;
      if (Number.isFinite(rating.rating)) {
        totalRating += rating.rating * weight;
        domainCount += weight;
      } else {
        totalRating += INITIAL_RATING;
        domainCount += 1;
      }

      if (isStale) {
        staleDomainCount++;
      }

      domains.push(domain);
    }
  }

  const composite = domainCount > 0 ? Math.round(totalRating / domainCount) : INITIAL_RATING;

  return {
    composite,
    domainCount: Math.round(domainCount),
    staleDomainCount,
    domains,
  };
}
