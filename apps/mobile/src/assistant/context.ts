/**
 * Advisory context builder for the assistant seam (campaign 010, W19).
 *
 * Pure aggregation of ALREADY-PERSISTED data shapes into the immutable
 * {@link AssistantContextSummary} a future assistant provider would consume
 * as grounding input. No db access, no network, no inference — callers pass
 * repository results (e.g. `db.ratings.getRatings()`,
 * `db.sessions.getAggregates()`, `db.sessions.listRecent(...)`), the
 * reconstructed streak, and an injected clock. Malformed inputs are tolerated
 * defensively (non-finite numbers dropped, normalized results clamped to
 * [0, 1]) so one corrupt row cannot poison a whole summary.
 *
 * Determinism: identical inputs with the same injected `nowMs` always build a
 * deep-equal summary; ordering is fully specified (weakest domain first,
 * deterministic tiebreaks) and lists are capped. Omitting `nowMs` yields
 * `generatedAtMs: null` and disables staleness verdicts.
 */

import { levelForXp } from '@/rating';

import type {
  AssistantContextSummary,
  AssistantDomainSnapshot,
  AssistantGameSnapshot,
  DomainRatingView,
  GameAggregateView,
  RecentSessionView,
  StreakStateView,
} from './types';
import {
  ASSISTANT_CONTEXT_VERSION,
  RECENT_SESSION_LIMIT,
  STALE_DOMAIN_DAYS,
  TOP_GAME_LIMIT,
} from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Arguments for {@link buildAssistantContextSummary}; every field optional. */
export interface AssistantContextArgs {
  /** Current domain-rating rows (`db.ratings.getRatings()`). */
  ratings?: readonly DomainRatingView[];
  /** Lifetime per-game aggregates (`db.sessions.getAggregates()`). */
  aggregates?: readonly GameAggregateView[];
  /**
   * Recent sessions across all games, NEWEST FIRST (`db.sessions.listRecent`
   * convention); order is preserved, only length is capped.
   */
  recentSessions?: readonly RecentSessionView[];
  /** Cumulative XP total for level derivation (sanitized defensively). */
  totalXp?: number;
  /** Currency balance when available; omitted → `coinBalance: null`. */
  coinBalance?: number;
  /** Reconstructed streak state; omitted → `streak: null`. */
  streak?: StreakStateView | null;
  /**
   * Injected clock (Unix epoch ms) enabling staleness verdicts and the
   * `generatedAtMs` stamp. Pure functions never read the wall clock.
   */
  nowMs?: number;
  /** Staleness horizon override in days (default {@link STALE_DOMAIN_DAYS}). */
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
 * normalized result into [0, 1] (the canonical scale). Order is preserved
 * (newest first) and the list is capped at {@link RECENT_SESSION_LIMIT}.
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
    if (out.length >= RECENT_SESSION_LIMIT) {
      break;
    }
  }
  return out;
}

/** Sanitize cumulative XP the same way the level curve treats it. */
function sanitizeXp(xp: number | undefined): number {
  if (!isFiniteNumber(xp)) {
    return 0;
  }
  return Math.max(0, Math.floor(xp));
}

/**
 * Build the immutable advisory summary. Weakest domains come first (rating
 * ascending, name-ascending tiebreak so equal ratings never reorder between
 * runs); top games are the most-played aggregates (count descending,
 * lastCompletedAt descending, gameId-ascending tiebreaks).
 */
export function buildAssistantContextSummary(
  args: AssistantContextArgs = {},
): AssistantContextSummary {
  const nowMs = isFiniteNumber(args.nowMs) ? args.nowMs : null;
  const staleDays = isFiniteNumber(args.staleDays)
    ? Math.max(0, args.staleDays)
    : STALE_DOMAIN_DAYS;

  const domains: AssistantDomainSnapshot[] = sanitizeRatings(args.ratings)
    .map((row) => {
      const sessions = isFiniteNumber(row.sessions) ? row.sessions : null;
      let stale: boolean | null = null;
      if (nowMs !== null && isFiniteNumber(row.updatedAt)) {
        stale = nowMs - row.updatedAt > staleDays * DAY_MS;
      }
      return {
        domain: row.domain,
        rating: Math.max(0, row.rating),
        sessions,
        stale,
      };
    })
    .sort((a, b) => a.rating - b.rating || (a.domain < b.domain ? -1 : 1));

  const topGames: AssistantGameSnapshot[] = sanitizeAggregates(args.aggregates)
    .slice()
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.lastCompletedAt - a.lastCompletedAt ||
        (a.gameId < b.gameId ? -1 : 1),
    )
    .slice(0, TOP_GAME_LIMIT);

  const rawStreak = args.streak ?? null;
  const streak: StreakStateView | null =
    rawStreak &&
    isFiniteNumber(rawStreak.current) &&
    isFiniteNumber(rawStreak.longest)
      ? {
          current: Math.max(0, Math.floor(rawStreak.current)),
          longest: Math.max(0, Math.floor(rawStreak.longest)),
          lastActiveDate:
            typeof rawStreak.lastActiveDate === 'string'
              ? rawStreak.lastActiveDate
              : null,
          atRisk: Boolean(rawStreak.atRisk),
        }
      : null;

  const totalXp = sanitizeXp(args.totalXp);
  const coinBalance = isFiniteNumber(args.coinBalance) ? args.coinBalance : null;

  return Object.freeze({
    contextVersion: ASSISTANT_CONTEXT_VERSION,
    generatedAtMs: nowMs,
    profile: Object.freeze({
      totalXp,
      level: levelForXp(totalXp),
      coinBalance,
    }),
    domains: Object.freeze(domains),
    topGames: Object.freeze(topGames),
    recentSessions: Object.freeze(sanitizeRecentSessions(args.recentSessions)),
    streak: streak ? Object.freeze({ ...streak }) : null,
    advisoryOnly: true as const,
  });
}
