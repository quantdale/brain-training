import type { SQLiteAdapter } from './adapter';
import type { RatingDelta } from './types';

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
const SELECT_HISTORY =
  'SELECT id, session_id, domain, delta, rating_after, created_at FROM rating_history ORDER BY id DESC LIMIT ?';

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
   */
  async applyDeltas(
    txn: SQLiteAdapter,
    sessionId: string,
    deltas: readonly RatingDelta[],
    eventAtMs: number,
  ): Promise<RatingHistoryEntry[]> {
    const appliedAt = this.now();
    const entries: RatingHistoryEntry[] = [];

    for (const delta of deltas) {
      const current = await txn.get<DomainRatingRow>(SELECT_ONE, [delta.domain]);
      const ratingAfter = Math.max(MIN_RATING, (current?.rating ?? INITIAL_RATING) + delta.delta);
      const sessions = (current?.sessions ?? 0) + 1;

      await txn.run(
        `INSERT INTO domain_ratings (domain, rating, sessions, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (domain) DO UPDATE SET
           rating = excluded.rating,
           sessions = excluded.sessions,
           updated_at = excluded.updated_at`,
        [delta.domain, ratingAfter, sessions, appliedAt],
      );

      const result = await txn.run(
        `INSERT INTO rating_history (session_id, domain, delta, rating_after, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [sessionId, delta.domain, delta.delta, ratingAfter, eventAtMs],
      );

      entries.push({
        id: result.lastInsertRowId,
        sessionId,
        domain: delta.domain,
        delta: delta.delta,
        ratingAfter,
        createdAt: eventAtMs,
      });
    }

    return entries;
  }

  /** Most recent rating movements, newest first. */
  async getHistory(limit = 100): Promise<RatingHistoryEntry[]> {
    const rows = await this.adapter.all<RatingHistoryRow>(SELECT_HISTORY, [limit]);
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
