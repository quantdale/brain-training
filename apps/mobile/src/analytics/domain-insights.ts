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
import type { Direction, DomainStatus, Point, TimeWindowKey } from './types';

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
  /**
   * Chronological rating points inside the window (oldest first) — the source
   * for a sparkline of the in-window trend.
   */
  windowSeries: Point[];
  /**
   * Highest rating ever recorded for this domain (history ∪ current row), or
   * `null` for an unseen domain. A personal best derived only from stored
   * evidence.
   */
  bestRating: number | null;
  /**
   * When the best rating was first reached (epoch ms; earliest on ties), or
   * `null` for an unseen domain.
   */
  bestRatingAt: number | null;
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
    const windowSeries: Point[] = windowHistory.map((entry) => ({
      t: entry.createdAt,
      value: entry.ratingAfter,
    }));

    // Personal best from stored evidence only: the highest ratingAfter in the
    // append-only history, plus the current row; earliest timestamp wins ties.
    let bestRating: number | null = null;
    let bestRatingAt: number | null = null;
    const considerBest = (value: number, at: number) => {
      if (bestRating === null || value > bestRating || (value === bestRating && at < bestRatingAt!)) {
        bestRating = value;
        bestRatingAt = at;
      }
    };
    for (const entry of history) {
      considerBest(entry.ratingAfter, entry.createdAt);
    }
    if (rating) {
      considerBest(rating.rating, rating.updatedAt);
    }

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
        windowSeries,
        bestRating,
        bestRatingAt,
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
      windowSeries,
      bestRating,
      bestRatingAt,
    } satisfies DomainInsight;
  });
}
