/**
 * Category (domain) comparison for Progress V2: one comparable row per
 * cognitive domain combining what the rating system stored with what the
 * session history shows inside a window.
 *
 * Ratings/movement come straight from `DomainInsight` (already derived from the
 * append-only rating history); session counts, average/best normalized results
 * and last-played come from in-window sessions mapped to their game's primary
 * category — the same single-domain attribution rule as `training-balance`, so
 * the two views always agree. Rows are sorted by in-window sessions desc, then
 * canonical domain order.
 */

import type { GameSessionRecord } from '@/db';

import type { DomainInsight } from './domain-insights';
import { filterByWindow } from './windows';
import type { Direction, DomainStatus, TimeWindowKey } from './types';

/** One domain's comparable row. */
export interface CategoryComparisonRow {
  domain: string;
  /** Current rating (`null` for an unseen domain). */
  rating: number | null;
  status: DomainStatus;
  /** Net in-window rating movement (0 when none). */
  movement: number;
  direction: Direction;
  /** In-window sessions attributed to this domain via its primary category. */
  sessions: number;
  /** Mean in-window normalized result (`null` when no sessions). */
  avgNormalized: number | null;
  /** Best in-window normalized result (`null` when no sessions). */
  bestNormalized: number | null;
  /** Most recent in-window completion (`null` when no sessions). */
  lastCompletedAt: number | null;
}

export interface CategoryComparison {
  rows: CategoryComparisonRow[];
  /** Total in-window sessions that could be attributed to any known domain. */
  mappedSessions: number;
}

/**
 * Build the comparison. `resolveDomain(gameId)` returns the game's primary
 * category or `null` when unknown (registry lookup at the call site).
 */
export function buildCategoryComparison(args: {
  insights: readonly DomainInsight[];
  sessions: readonly GameSessionRecord[];
  resolveDomain: (gameId: string) => string | null;
  nowMs: number;
  windowKey: TimeWindowKey;
}): CategoryComparison {
  const { insights, sessions, resolveDomain, nowMs, windowKey } = args;
  const inWindow = filterByWindow(sessions, nowMs, windowKey);

  // Per-domain session stats from primary-category attribution only.
  const counts = new Map<string, number>();
  const sums = new Map<string, number>();
  const bests = new Map<string, number>();
  const lasts = new Map<string, number>();
  let mappedSessions = 0;

  for (const session of inWindow) {
    const domain = resolveDomain(session.gameId);
    if (domain === null) {
      continue;
    }
    mappedSessions += 1;
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
    sums.set(domain, (sums.get(domain) ?? 0) + session.normalizedResult);
    const best = bests.get(domain);
    if (best === undefined || session.normalizedResult > best) {
      bests.set(domain, session.normalizedResult);
    }
    const last = lasts.get(domain);
    if (last === undefined || session.completedAt > last) {
      lasts.set(domain, session.completedAt);
    }
  }

  const rankOf = (domain: string): number => insights.findIndex((i) => i.domain === domain);

  const rows: CategoryComparisonRow[] = insights.map((insight) => {
    const count = counts.get(insight.domain) ?? 0;
    const sum = sums.get(insight.domain);
    return {
      domain: insight.domain,
      rating: insight.rating,
      status: insight.status,
      movement: insight.windowMovement,
      direction: insight.direction,
      sessions: count,
      avgNormalized: count > 0 && sum !== undefined ? sum / count : null,
      bestNormalized: count > 0 ? (bests.get(insight.domain) ?? null) : null,
      lastCompletedAt: count > 0 ? (lasts.get(insight.domain) ?? null) : null,
    };
  });

  rows.sort(
    (a, b) =>
      b.sessions - a.sessions ||
      (b.avgNormalized ?? -1) - (a.avgNormalized ?? -1) ||
      rankOf(a.domain) - rankOf(b.domain),
  );

  return { rows, mappedSessions };
}
