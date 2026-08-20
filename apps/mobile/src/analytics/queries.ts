/**
 * Read-only data loaders for the Progress screens. These call only existing
 * `AppDatabase` query methods (no schema or migration changes) and return plain
 * typed shapes; all aggregation happens in the pure functions exported from the
 * analytics index. A large limit is used to pull the full session/history set so
 * the pure functions can slice by any time window deterministically.
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
