/**
 * Read-only data loaders for the Progress screens. These return plain typed
 * shapes; all aggregation happens in the pure functions exported from the
 * analytics index.
 *
 * Query architecture (campaign 010 W09 rewrite of the 009 performance debt):
 *
 * | Query                      | Before (009)                     | After (010) |
 * | -------------------------- | -------------------------------- | ----------- |
 * | session rows (snapshot)    | `listRecent(ALL)`: full rows incl. both JSON blobs + 2×`JSON.parse` per row — ≈108 ms @20k | JSON1 projection (`./projections`): narrow scalar scan + in-SQL metric extraction, shimmed records — same class as `listLightweight` (≈15 ms @20k); legacy full-row fallback when JSON1 is unavailable |
 * | session rows (per game)    | `listByGame(ALL)` full rows      | same projection with `WHERE game_id = ?` (uses `idx_game_sessions_game_id`) |
 * | rating history             | `getHistory(ALL)`                | unchanged: rows are already slim (6 scalar columns), and consumers need unbounded evidence (all-time personal bests, all-time trend fallback), so bounding would change visible data. Remaining pushdown candidate, see NEEDS_PARENT in the packet |
 * | aggregates / totalXp / balance / ratings | SQL-side already   | unchanged |
 *
 * Statement count stays constant regardless of history size (guarded by
 * `src/__tests__/perf-db-query-patterns.test.ts`). The projection runs through
 * the public `db.transaction()` seam; see `./projections` for the parity and
 * fallback contract.
 */

import type {
  AppDatabase,
  DomainRating,
  GameAggregate,
  GameSessionRecord,
  RatingHistoryEntry,
} from '@/db';

import { sessionRecordFromProjection, tryLoadProjectedSessionRows } from './projections';

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
  const [ratings, ratingHistory, projectedSessions, aggregates, totalXp, balance] =
    await Promise.all([
      db.ratings.getRatings(),
      db.ratings.getHistory(ALL_SESSIONS_LIMIT),
      tryLoadProjectedSessionRows(db, null, ALL_SESSIONS_LIMIT),
      db.sessions.getAggregates(),
      db.sessions.getTotalXp(),
      db.ledger.getBalance(),
    ]);
  // Fast path: projected rows rebuilt as blob-shimmed records. Fallback:
  // legacy full-row read when the projection is unavailable (no JSON1, nested
  // transaction, SQL error) — identical output, original cost profile.
  const sessions =
    projectedSessions !== null
      ? projectedSessions.map(sessionRecordFromProjection)
      : await db.sessions.listRecent(ALL_SESSIONS_LIMIT);
  return { ratings, ratingHistory, sessions, aggregates, totalXp, balance };
}

/** All sessions for one game, newest first (projection fast path, large limit). */
export async function loadGameSessions(
  db: AppDatabase,
  gameId: string,
): Promise<GameSessionRecord[]> {
  const projected = await tryLoadProjectedSessionRows(db, gameId, ALL_SESSIONS_LIMIT);
  if (projected !== null) {
    return projected.map(sessionRecordFromProjection);
  }
  return db.sessions.listByGame(gameId, ALL_SESSIONS_LIMIT);
}
