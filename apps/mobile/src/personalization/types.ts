/**
 * Shared contracts for Advanced Personalization V2 (campaign 010, W07).
 *
 * The personalization layer derives transparent, explainable recommendations
 * from ALREADY-STORED local evidence (domain ratings, per-game aggregates,
 * recent sessions). No cloud calls, no AI APIs, no invented second scores:
 * every number traces back to stored rows through one of the documented
 * signals in `signals.ts`, weighted by the published table in `weights.ts`.
 *
 * Data shapes are STRUCTURAL VIEWS (mirroring `src/db` rows) so callers can
 * pass repository results directly without casts — the same zero-db-import
 * policy as `src/workout/personalize.ts`. Nothing in this module performs I/O.
 */

/**
 * Stable keys for every recommendation signal. This union is the UI/i18n
 * contract: screens key off these values (never off prose), while the
 * human-readable sentences live in `explain.ts`.
 *
 * - `weak-domain`: the game's primary domain rating actively declined below
 *   the never-played starting rating (constitution §14 "weaker domains").
 * - `undertrained-domain`: the domain has little stored evidence so far.
 * - `stale-domain`: the domain rating is fresh-marked stale by inactivity
 *   (constitution §15 — marked stale, never decayed).
 * - `novelty`: discovery boost for rarely/never played games (§21).
 * - `performance-trend`: recent form is improving over the lifetime average.
 * - `personal-best-proximity`: a personal record is within reach.
 * - `difficulty-fit`: recent results sit in the productive middle band —
 *   neither crushing nor trivial.
 * - `overexposure`: the game dominated recent history (game fatigue) and is
 *   softly demoted so workouts keep variety.
 * - `composition-fit`: selection-time penalty that spreads a chosen set
 *   across domains (applied by `selectRecommendations`, not by static scoring).
 */
export type SignalKey =
  | 'weak-domain'
  | 'undertrained-domain'
  | 'stale-domain'
  | 'novelty'
  | 'performance-trend'
  | 'personal-best-proximity'
  | 'difficulty-fit'
  | 'overexposure'
  | 'composition-fit';

/** Structural view of a `DomainRating` row (src/db/rating.ts). */
export interface DomainRatingView {
  domain: string;
  rating: number;
  /** Completed sessions that contributed to this rating. */
  sessions?: number;
  /** Unix epoch ms of the last contributing session. */
  updatedAt?: number;
}

/** Structural view of a `GameAggregate` row (src/db/sessions.ts). */
export interface GameAggregateView {
  gameId: string;
  count: number;
  /** Mean normalized performance (0..1) across the game's sessions. */
  avgNormalized: number;
  /** Best normalized performance (0..1). */
  bestNormalized: number;
  /** Unix epoch ms of the most recent session. */
  lastCompletedAt: number;
}

/** Structural view of the lightweight session projection (newest first). */
export interface RecentSessionView {
  gameId: string;
  /** Normalized performance (0..1) of the completed session. */
  normalizedResult: number;
  /** Unix epoch ms of the completion. */
  completedAt: number;
}

/**
 * Options for signal computation. Everything is optional; omitting `nowMs`
 * disables every clock-dependent signal (staleness), mirroring the opt-in
 * policy of `PersonalizeOptions` in `src/workout/personalize.ts`.
 */
export interface PersonalizationOptions {
  /**
   * Current time (Unix epoch ms) enabling clock-dependent signals. Pure
   * functions never read the wall clock themselves — callers inject it so
   * output stays deterministic and testable.
   */
  nowMs?: number;
  /** Staleness horizon in days (default {@link STALE_DOMAIN_DAYS}). */
  staleDays?: number;
}

/**
 * Immutable evidence snapshot consumed by the signal/scoring pipeline. Built
 * once per evaluation via `buildPersonalizationContext` from repository rows.
 */
export interface PersonalizationContext {
  /** Injected clock, or `null` when the caller omitted `nowMs`. */
  readonly nowMs: number | null;
  readonly staleDays: number;
  /** Current domain ratings keyed by domain name. */
  readonly ratingByDomain: ReadonlyMap<string, DomainRatingView>;
  /** Lifetime per-game aggregates keyed by game id. */
  readonly aggregateByGame: ReadonlyMap<string, GameAggregateView>;
  /**
   * Recent sessions across all games, NEWEST FIRST (the db `listRecent`
   * convention). Signals slice what they need; nothing here re-orders them.
   */
  readonly recentSessions: readonly RecentSessionView[];
}
