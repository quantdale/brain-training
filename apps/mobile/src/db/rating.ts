import type { SQLiteAdapter } from './adapter';
import { MAX_READ_LIMIT, clampLimit, joinAnd, normalizeOffset, requireFiniteNumber } from './query';
import type { SQLiteValue , AppliedRatingDelta, RatingDelta } from './types';

/**
 * Per-domain ratings and the append-only rating history (constitution §15).
 *
 * Ratings live in `domain_ratings` (one row per cognitive domain, current
 * value + session count + last-update time) and every movement is recorded in
 * `rating_history` (append-only; the schema rejects UPDATE/DELETE, mirroring
 * the currency ledger). Staleness is never decayed into the stored rating —
 * consumers compute it from `updated_at` (see `isRatingStale`).
 */

/** Starting rating for a domain that has never been played (rating scale floor is 0). */
export const INITIAL_RATING = 1000;

/** Hard floor for a domain rating — ratings must never go negative. */
export const MIN_RATING = 0;

export interface DomainRating {
  domain: string;
  rating: number;
  /** Number of completed sessions that contributed to this rating. */
  sessions: number;
  /** Unix epoch milliseconds of the last contributing session. */
  updatedAt: number;
}

export interface RatingHistoryEntry {
  id: number;
  sessionId: string;
  domain: string;
  /** Signed rating movement applied by the session. */
  delta: number;
  /** Domain rating after applying this delta. */
  ratingAfter: number;
  /** Unix epoch milliseconds (the session's own completion time). */
  createdAt: number;
}

/** Filter/pagination shape for `getHistoryWindowed`. */
export interface RatingHistoryQuery {
  /** One domain, or all domains when omitted. */
  domain?: string;
  /** Inclusive lower bound on created_at (epoch ms). */
  fromMs?: number;
  /** Inclusive upper bound on created_at (epoch ms). */
  toMs?: number;
  /** Page size; clamped to [1, 10000], default 100. */
  limit?: number;
  /** Offset into the ordered result set; negative/undefined = 0. */
  offset?: number;
}

interface DomainRatingRow {
  domain: string;
  rating: number;
  sessions: number;
  updated_at: number;
}

interface RatingHistoryRow {
  id: number;
  session_id: string;
  domain: string;
  delta: number;
  rating_after: number;
  created_at: number;
}

const SELECT_ALL = 'SELECT domain, rating, sessions, updated_at FROM domain_ratings ORDER BY domain';
const SELECT_ONE = 'SELECT domain, rating, sessions, updated_at FROM domain_ratings WHERE domain = ?';
/**
 * Shared projection for history reads. Columns stay raw snake_case on purpose:
 * `mapHistoryRow` is the single snake_case -> camelCase translation point for
 * every history read. (Aliasing here while the mapper still read snake_case
 * keys silently yielded `undefined` sessionId/ratingAfter/createdAt — pinned
 * by the full-projection regression test in rating.test.ts.)
 */
const HISTORY_COLUMNS =
  'SELECT id, session_id, domain, delta, rating_after, created_at FROM rating_history';

function requireHistoryThroughMs(value: number | undefined): number | undefined {
  if (value !== undefined && !Number.isSafeInteger(value)) {
    throw new Error('rating history upper bound must be a safe integer');
  }
  return value;
}

function mapRatingRow(row: DomainRatingRow): DomainRating {
  return { domain: row.domain, rating: row.rating, sessions: row.sessions, updatedAt: row.updated_at };
}

function mapHistoryRow(row: RatingHistoryRow): RatingHistoryEntry {
  return {
    id: row.id,
    sessionId: row.session_id,
    domain: row.domain,
    delta: row.delta,
    ratingAfter: row.rating_after,
    createdAt: row.created_at,
  };
}

export class RatingRepository {
  /**
   * @param now Injectable clock (Unix epoch ms) so tests are deterministic.
   */
  constructor(
    private readonly adapter: SQLiteAdapter,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Current ratings for all domains, sorted by domain name. */
  async getRatings(): Promise<DomainRating[]> {
    const rows = await this.adapter.all<DomainRatingRow>(SELECT_ALL);
    return rows.map(mapRatingRow);
  }

  /** Current rating for one domain, or null when the domain was never played. */
  async getRating(domain: string): Promise<DomainRating | null> {
    const row = await this.adapter.get<DomainRatingRow>(SELECT_ONE, [domain]);
    return row ? mapRatingRow(row) : null;
  }

  /**
   * Apply one session's deltas and append the history rows. Must run on the
   * caller's transaction adapter so it is atomic with the session insert.
   * `eventAtMs` is the session's own completion time (historical timestamps
   * stay consistent with the ledger convention).
   *
   * Returns the applied deltas with resulting ratings for each domain.
   */
  async applyDeltas(
    txn: SQLiteAdapter,
    sessionId: string,
    deltas: readonly RatingDelta[],
    eventAtMs: number,
  ): Promise<AppliedRatingDelta[]> {
    const domains = new Set<string>();
    for (const delta of deltas) {
      if (typeof delta.domain !== 'string' || delta.domain.length === 0) {
        throw new Error('rating delta domain must be a non-empty string');
      }
      if (domains.has(delta.domain)) {
        throw new Error(
          `rating deltas must contain at most one entry per domain (${delta.domain})`,
        );
      }
      domains.add(delta.domain);
    }
    const applied: AppliedRatingDelta[] = [];

    for (const delta of deltas) {
      const current = await txn.get<DomainRatingRow>(SELECT_ONE, [delta.domain]);
      const previousRating = current?.rating ?? INITIAL_RATING;
      const ratingAfter = Math.max(MIN_RATING, previousRating + delta.delta);
      // Task 9.1: Store actual applied delta, not requested delta
      const appliedDelta = ratingAfter - previousRating;
      const sessions = (current?.sessions ?? 0) + 1;

      // Task 9.2: Use session event time for freshness, not processing time
      // This ensures old evidence doesn't look fresh when processed later
      await txn.run(
        `INSERT INTO domain_ratings (domain, rating, sessions, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (domain) DO UPDATE SET
           rating = excluded.rating,
           sessions = excluded.sessions,
           updated_at = excluded.updated_at`,
        [delta.domain, ratingAfter, sessions, eventAtMs],
      );

      await txn.run(
        `INSERT INTO rating_history (session_id, domain, delta, rating_after, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [sessionId, delta.domain, appliedDelta, ratingAfter, eventAtMs],
      );

      applied.push({
        domain: delta.domain,
        delta: appliedDelta,
        ratingAfter,
      });
    }

    return applied;
  }

  /** Most recent rating movements, newest first. */
  async getHistory(limit = 100, throughMs?: number): Promise<RatingHistoryEntry[]> {
    const bound = requireHistoryThroughMs(throughMs);
    const rows = await this.adapter.all<RatingHistoryRow>(
      `${HISTORY_COLUMNS}${bound === undefined ? '' : ' WHERE created_at <= ?'} ORDER BY id DESC LIMIT ?`,
      bound === undefined ? [limit] : [bound, limit],
    );
    return rows.map(mapHistoryRow);
  }

  /**
   * Windowed rating movements with filter + offset pagination (campaign 010
   * W11; bounds the unbounded `getHistory(ALL)` pattern the 009 audit flagged).
   * Reads the same columns as `getHistory` — no session JSON is involved.
   *
   * Index-awareness: a `domain` filter walks
   * `idx_rating_history_domain (domain, created_at)`; an unfiltered window
   * walks `idx_rating_history_created_at (created_at)` (schema v9, added for
   * exactly this read). Ordering tie-breaks on `id DESC` so equal timestamps
   * paginate deterministically.
   */
  async getHistoryWindowed(query: RatingHistoryQuery = {}): Promise<RatingHistoryEntry[]> {
    requireFiniteNumber(query.fromMs, 'query.fromMs');
    requireFiniteNumber(query.toMs, 'query.toMs');
    if (query.domain !== undefined && (typeof query.domain !== 'string' || query.domain === '')) {
      throw new Error('query.domain: must be a non-empty string when provided');
    }
    const conditions: string[] = [];
    const params: SQLiteValue[] = [];
    if (query.domain !== undefined) {
      conditions.push('domain = ?');
      params.push(query.domain);
    }
    if (query.fromMs !== undefined) {
      conditions.push('created_at >= ?');
      params.push(query.fromMs);
    }
    if (query.toMs !== undefined) {
      conditions.push('created_at <= ?');
      params.push(query.toMs);
    }
    const limit = clampLimit(query.limit, 100, MAX_READ_LIMIT);
    const offset = normalizeOffset(query.offset);
    const rows = await this.adapter.all<RatingHistoryRow>(
      `${HISTORY_COLUMNS} ${joinAnd(conditions)} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return rows.map(mapHistoryRow);
  }

  /** One session's rating movements, in application order (oldest first). */
  async getHistoryForSession(
    sessionId: string,
    throughMs?: number,
  ): Promise<RatingHistoryEntry[]> {
    const bound = requireHistoryThroughMs(throughMs);
    const rows = await this.adapter.all<RatingHistoryRow>(
      `${HISTORY_COLUMNS} WHERE session_id = ?${bound === undefined ? '' : ' AND created_at <= ?'} ORDER BY id ASC`,
      bound === undefined ? [sessionId] : [sessionId, bound],
    );
    return rows.map(mapHistoryRow);
  }
}

/**
 * Staleness check (constitution §15: inactivity reduces confidence/marks a
 * rating stale instead of decaying it). Pure so it is trivially testable.
 */
export function isRatingStale(updatedAtMs: number, nowMs: number, maxAgeDays = 30): boolean {
  if (maxAgeDays <= 0) {
    throw new Error('isRatingStale: maxAgeDays must be > 0');
  }
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  return nowMs - updatedAtMs > maxAgeMs;
}
