/**
 * Analytics for the Progress / Insights feature.
 *
 * Every function here is a pure aggregation over already-persisted evidence
 * (game sessions and domain ratings / rating history). None of these functions
 * invent new scores: the overall composite reuses the canonical calculation in
 * `@/rating/composite` (`computeComposite`) so the number shown to players is
 * exactly the one the rest of the product trusts.
 *
 * The module is dependency-free (only `react-native` types and the rating
 * engine) so it can be unit-tested in isolation with deterministic fixtures and
 * an injectable clock.
 */

/** Selectable time windows for Progress views. `all` ignores the window. */
export type TimeWindowKey = '7d' | '30d' | '90d' | 'all';

/** A point in a trend series (time + value), always ordered ascending by `t`. */
export interface Point {
  /** Unix epoch milliseconds of the session completion. */
  t: number;
  value: number;
}

/** Direction of recent movement, used for compact arrows/colors. */
export type Direction = 'up' | 'down' | 'flat';

/** Freshness status of a domain rating. */
export type DomainStatus = 'unseen' | 'stale' | 'fresh';
