/**
 * Per-domain rating insights for Progress (rating freshness, movement and
 * recent direction). Pure: it only reads the persisted `DomainRating` rows and
 * the append-only `rating_history` entries, never mutates anything.
 *
 * Staleness uses the canonical `isRatingStale` rule (no decay — an inactive
 * domain is *marked* stale, not reduced). "Unseen" domains (never played) carry
 * no rating and are represented explicitly so the UI can show a neutral state
 * rather than a fake zero.
 */

import { isRatingStale } from '@/db/rating';
import type { DomainRating, RatingHistoryEntry } from '@/db';

import { filterHistoryByWindow } from './windows';
import type { Direction, DomainStatus, TimeWindowKey } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** One domain's analytics summary for a chosen time window. */
export interface DomainInsight {
  domain: string;
  /** Freshness status relative to `nowMs`. */
  status: DomainStatus;
  /** Current domain rating, or `null` for an unseen domain. */
  rating: number | null;
  /** Completed sessions that contributed to this rating (0 if unseen). */
  sessions: number;
  /** Last update timestamp, or `null` for an unseen domain. */
  updatedAt: number | null;
  /** Whole days since the last update (`null` for unseen). */
  daysSinceUpdate: number | null;
  /**
   * Net rating change across the selected window: the latest `ratingAfter`
   * minus the earliest `ratingAfter` within the window (oldest first). For the
   * `all` window this is the full lifetime change. `0` when there is no
   * in-window history.
   */
  windowMovement: number;
  /** Signed direction of `windowMovement` (`flat` when zero/no data). */
  direction: Direction;
  /** Number of rating-history entries that landed inside the window. */
  windowEntries: number;
}

function directionOf(delta: number): Direction {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

/**
 * Build domain insights for every known domain (so unseen domains are always
 * represented), ordered by the supplied `knownDomains` then any extras.
 */
export function buildDomainInsights(
  ratings: readonly DomainRating[],
  knownDomains: readonly string[],
  ratingHistory: readonly RatingHistoryEntry[],
  nowMs: number,
  windowKey: TimeWindowKey,
): DomainInsight[] {
  const byDomain = new Map<string, DomainRating>();
  for (const rating of ratings) {
    byDomain.set(rating.domain, rating);
  }

  const historyByDomain = new Map<string, RatingHistoryEntry[]>();
  for (const entry of ratingHistory) {
    const list = historyByDomain.get(entry.domain);
    if (list) {
      list.push(entry);
    } else {
      historyByDomain.set(entry.domain, [entry]);
    }
  }

  const domains = [...knownDomains];
  for (const domain of historyByDomain.keys()) {
    if (!domains.includes(domain)) {
      domains.push(domain);
    }
  }

  return domains.map((domain) => {
    const rating = byDomain.get(domain);
    const history = (historyByDomain.get(domain) ?? []).slice().sort(
      (a, b) => a.createdAt - b.createdAt,
    );
    const windowHistory = filterHistoryByWindow(history, nowMs, windowKey);

    if (!rating) {
      // Unseen domain: never played, no rating to show.
      return {
        domain,
        status: 'unseen',
        rating: null,
        sessions: 0,
        updatedAt: null,
        daysSinceUpdate: null,
        windowMovement: 0,
        direction: 'flat',
        windowEntries: windowHistory.length,
      } satisfies DomainInsight;
    }

    const stale = isRatingStale(rating.updatedAt, nowMs);
    const windowMovement =
      windowHistory.length >= 1
        ? windowHistory[windowHistory.length - 1].ratingAfter - windowHistory[0].ratingAfter
        : 0;

    return {
      domain,
      status: stale ? 'stale' : 'fresh',
      rating: rating.rating,
      sessions: rating.sessions,
      updatedAt: rating.updatedAt,
      daysSinceUpdate: Math.floor((nowMs - rating.updatedAt) / DAY_MS),
      windowMovement,
      direction: directionOf(windowMovement),
      windowEntries: windowHistory.length,
    } satisfies DomainInsight;
  });
}
