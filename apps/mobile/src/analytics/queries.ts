/**
 * Read-only data loaders for the Progress screens. These call only existing
 * `AppDatabase` query methods (no schema or migration changes) and return plain
 * typed shapes; all aggregation happens in the pure functions exported from the
 * analytics index. A large limit is used to pull the full session/history set so
 * the pure functions can slice by any time window deterministically.
 *
 * Scaling note (campaign 009 audit, reported to the db owner): at thousands of
 * sessions `listRecent(ALL_SESSIONS_LIMIT)` materializes every heavy row
 * (including the `difficulty` / `rawResult` JSON blobs) on each screen focus,
 * and `ratings.getHistory(ALL_SESSIONS_LIMIT)` reads the whole append-only
 * `rating_history`. Both are correct today but unbounded; the screens only need
 * projected columns (`id, game_id, completed_at, normalized_result, duration_ms`)
 * for the overview, and a windowed history query would bound the rest. See the
 * worker report for the proposed db-layer additions.
 */

import type { AppDatabase, DomainRating, GameAggregate, GameSessionRecord, RatingHistoryEntry } from '@/db';

/** Effectively "fetch everything" limit for the existing list queries. */
export const ALL_SESSIONS_LIMIT = 1_000_000;

/** Snapshot used by the Progress overview. */
export interface ProgressSnapshot {
  ratings: DomainRating[];
  ratingHistory: RatingHistoryEntry[];
  sessions: GameSessionRecord[];
  aggregates: GameAggregate[];
  totalXp: number;
  balance: number;
}

export async function loadProgressSnapshot(db: AppDatabase): Promise<ProgressSnapshot> {
  const [ratings, ratingHistory, sessions, aggregates, totalXp, balance] = await Promise.all([
    db.ratings.getRatings(),
    db.ratings.getHistory(ALL_SESSIONS_LIMIT),
    db.sessions.listRecent(ALL_SESSIONS_LIMIT),
    db.sessions.getAggregates(),
    db.sessions.getTotalXp(),
    db.ledger.getBalance(),
  ]);
  return { ratings, ratingHistory, sessions, aggregates, totalXp, balance };
}

/** All sessions for one game, newest first (existing query, large limit). */
export async function loadGameSessions(
  db: AppDatabase,
  gameId: string,
): Promise<GameSessionRecord[]> {
  return db.sessions.listByGame(gameId, ALL_SESSIONS_LIMIT);
}
