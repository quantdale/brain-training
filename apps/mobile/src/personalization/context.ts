/**
 * Context builder for Advanced Personalization V2.
 *
 * Pure aggregation of ALREADY-PERSISTED rows into the immutable
 * {@link PersonalizationContext} the signal/scoring pipeline consumes. No db
 * access here either — callers pass repository results (e.g.
 * `db.ratings.getRatings()`, `db.sessions.getAggregates()`,
 * `db.sessions.listRecent(...)`) and an injected clock. Malformed inputs are
 * tolerated defensively (non-finite numbers are ignored) so one corrupt row
 * cannot poison a whole recommendation pass.
 */

import type {
  DomainRatingView,
  GameAggregateView,
  PersonalizationContext,
  PersonalizationOptions,
  RecentSessionView,
} from './types';
import { STALE_DOMAIN_DAYS } from './signals';

/** Arguments for {@link buildPersonalizationContext}; every field optional. */
export interface PersonalizationContextArgs {
  /** Current domain-rating rows (`db.ratings.getRatings()`). */
  ratings?: readonly DomainRatingView[];
  /** Lifetime per-game aggregates (`db.sessions.getAggregates()`). */
  aggregates?: readonly GameAggregateView[];
  /**
   * Recent sessions across all games, NEWEST FIRST
   * (`db.sessions.listRecent(...)` convention).
   */
  recentSessions?: readonly RecentSessionView[];
  /** Injected clock enabling clock-dependent signals (staleness). */
  nowMs?: number;
  /** Staleness horizon override in days. */
  staleDays?: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Defensive row filter: keeps only well-formed rating rows. */
function sanitizeRatings(
  ratings: readonly DomainRatingView[] | undefined,
): DomainRatingView[] {
  if (!ratings) {
    return [];
  }
  return ratings.filter(
    (row): row is DomainRatingView =>
      typeof row?.domain === 'string' &&
      row.domain.length > 0 &&
      isFiniteNumber(row.rating),
  );
}

/** Defensive row filter: keeps only well-formed aggregate rows. */
function sanitizeAggregates(
  aggregates: readonly GameAggregateView[] | undefined,
): GameAggregateView[] {
  if (!aggregates) {
    return [];
  }
  return aggregates.filter(
    (row): row is GameAggregateView =>
      typeof row?.gameId === 'string' &&
      row.gameId.length > 0 &&
      isFiniteNumber(row.count) &&
      isFiniteNumber(row.avgNormalized) &&
      isFiniteNumber(row.bestNormalized),
  );
}

/**
 * Defensive session filter: keeps only well-formed sessions and clamps their
 * normalized result into [0, 1] (the canonical scale) so a corrupt payload
 * cannot distort form/trend/fit signals. Order is preserved (newest first).
 */
function sanitizeRecentSessions(
  sessions: readonly RecentSessionView[] | undefined,
): RecentSessionView[] {
  if (!sessions) {
    return [];
  }
  const out: RecentSessionView[] = [];
  for (const session of sessions) {
    if (
      typeof session?.gameId !== 'string' ||
      session.gameId.length === 0 ||
      !isFiniteNumber(session.normalizedResult) ||
      !isFiniteNumber(session.completedAt)
    ) {
      continue;
    }
    out.push({
      gameId: session.gameId,
      normalizedResult: Math.min(1, Math.max(0, session.normalizedResult)),
      completedAt: session.completedAt,
    });
  }
  return out;
}

/**
 * Build the immutable evidence snapshot. Deterministic: the same inputs (with
 * the same injected `nowMs`) always build an equal context; omitting `nowMs`
 * yields `nowMs: null` and disables staleness downstream.
 */
export function buildPersonalizationContext(
  args: PersonalizationContextArgs = {},
): PersonalizationContext {
  const ratingByDomain = new Map<string, DomainRatingView>();
  for (const row of sanitizeRatings(args.ratings)) {
    ratingByDomain.set(row.domain, row);
  }

  const aggregateByGame = new Map<string, GameAggregateView>();
  for (const row of sanitizeAggregates(args.aggregates)) {
    aggregateByGame.set(row.gameId, row);
  }

  return {
    nowMs: args.nowMs ?? null,
    staleDays: args.staleDays ?? STALE_DOMAIN_DAYS,
    ratingByDomain,
    aggregateByGame,
    recentSessions: Object.freeze(sanitizeRecentSessions(args.recentSessions)),
  };
}
