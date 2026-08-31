/**
 * SQL projection layer for the Progress analytics loaders (`./queries`).
 *
 * Campaign 009 measured `loadProgressSnapshot` at ≈101 ms @20k sessions
 * (`scripts/perf/baselines/`, finding F3): the cost is dominated by
 * `sessions.listRecent(ALL)` materializing every heavy row — two JSON blobs
 * per row plus two `JSON.parse` calls on the JS thread. The screens and their
 * pure aggregators only ever read scalar columns plus a handful of well-known
 * metric fields *inside* those blobs (via `metrics-map`), so this module
 * pushes that extraction into SQLite:
 *
 * - one narrow SELECT returns all scalar session columns plus per-row derived
 *   metrics extracted with `json_extract` (C speed, no blob strings cross into
 *   JS, no `JSON.parse`);
 * - `sessionRecordFromProjection` rebuilds `GameSessionRecord`-shaped rows
 *   whose `rawResult` / `difficulty` are minimal shim objects carrying exactly
 *   the fields `metrics-map` recognizes, so every pure analytics function
 *   observes byte-identical numbers to the full-row path.
 *
 * Expected complexity change (campaign 010 W09 backlog): the snapshot's
 * dominant term drops from "13 columns incl. 2 JSON strings + 2 parses per
 * row" (~108 ms @20k measured) to a narrow scalar+derived scan — the same
 * class as the existing `listLightweight` projection (~15 ms @20k measured).
 * Statement count stays constant (no N+1); ordering still uses
 * `idx_game_sessions_completed_at` / `idx_game_sessions_game_id`.
 *
 * JSON1 dependency: expo-sqlite and better-sqlite3 both ship JSON1, but the
 * loaders treat it as a runtime capability (`supportsJsonFunctions`) and fall
 * back to the legacy full-row repository reads when absent or on any SQL
 * error — this module can never make Progress less available than before.
 *
 * db-layer note (campaign 010 W22): the projection SQL's canonical home is
 * now `db/sessions.ts`, and the preferred execution path is the dedicated
 * plain-read repository primitive (`SessionRepository.listProgressProjection`
 * / `listProgressProjectionByGame` — resolving W09's NEEDS_PARENT request, no
 * exclusive-lock transaction detour). The former public-`db.transaction()`
 * seam path is kept below as a fallback for degraded/partial database
 * handles, ahead of the legacy full-row reads.
 */

import type { AppDatabase, GameSessionRecord, SQLiteAdapter, SQLiteValue } from '@/db';
import {
  DIFFICULTY_LEVEL_PARAMS,
  PROJECTED_SESSIONS_ALL_SQL,
  PROJECTED_SESSIONS_BY_GAME_SQL,
  type SessionProgressRow,
} from '@/db/sessions';
import { trackProgressSnapshotLoad } from '@/sdk/perf';

// Backward-compatible re-exports (campaign 010 W22): the projection SQL, the
// difficulty-level bindings and the row shape moved to their canonical home
// in `db/sessions.ts` (so the repository primitives and this module share one
// implementation); they stay exported here under their historical names so
// existing consumers and the parity tests are unaffected.
export { DIFFICULTY_LEVEL_PARAMS, PROJECTED_SESSIONS_ALL_SQL, PROJECTED_SESSIONS_BY_GAME_SQL };
/** Row shape of the Progress projection (canonical definition: `db/sessions.ts`). */
export type ProjectedSessionRow = SessionProgressRow;

/** JSON1 capability probe result; static per SQLite build, so memoized. */
let jsonFunctionsSupported: boolean | null = null;

async function supportsJsonFunctions(txn: SQLiteAdapter): Promise<boolean> {
  if (jsonFunctionsSupported !== null) {
    return jsonFunctionsSupported;
  }
  try {
    await txn.get("SELECT json_valid('{}') AS ok");
    jsonFunctionsSupported = true;
  } catch {
    jsonFunctionsSupported = false;
  }
  return jsonFunctionsSupported;
}

/**
 * Load projected session rows newest-first, or `null` when every projection
 * path is unavailable so callers can fall back to the legacy full-row
 * repository reads. Never throws. Path order (campaign 010 W22): repository
 * primitives → `db.transaction()` seam → `null`.
 *
 * `gameId === null` loads across all games; otherwise only that game's rows.
 */
export async function tryLoadProjectedSessionRows(
  db: AppDatabase,
  gameId: string | null,
  limit: number,
  throughMs?: number,
): Promise<ProjectedSessionRow[] | null> {
  if (throughMs !== undefined && !Number.isSafeInteger(throughMs)) {
    throw new Error('projection upper bound must be a safe integer');
  }
  // Dev-only perf mark (campaign 010 W21, debt D4): duration of the whole
  // projection load path, with the resolved tier so QA artifacts can tell
  // fast-path repository reads from the transaction-seam fallback. Pure
  // observation — the returned values and fallback order are unchanged.
  const measure = trackProgressSnapshotLoad();
  // Fast path (campaign 010 W22): the dedicated repository primitives run the
  // same canonical SQL as a plain read on the shared connection — no
  // exclusive-lock transaction seam, and they keep working when called inside
  // an outer transaction (where db.transaction() would refuse to nest).
  try {
    const rows =
      gameId === null
        ? await db.sessions.listProgressProjection(limit, throughMs)
        : await db.sessions.listProgressProjectionByGame(gameId, limit, throughMs);
    measure.end({ outcome: 'rows', path: 'repository', rowCount: rows.length });
    return rows;
  } catch {
    // Fall through: JSON1-less SQLite build, degraded/partial db handle, or
    // any unexpected error — the seams below preserve the old behavior.
  }
  try {
    const rows = await db.transaction(async (txn) => {
      if (!(await supportsJsonFunctions(txn))) {
        return null;
      }
      // Binding order follows placeholder textual order: the select list's
      // two difficulty-level IN-groups first, then the optional game filter,
      // then the limit.
      const params: SQLiteValue[] = [
        ...DIFFICULTY_LEVEL_PARAMS,
        ...DIFFICULTY_LEVEL_PARAMS,
        ...(gameId === null ? [] : [gameId]),
        ...(throughMs === undefined ? [] : [throughMs]),
        limit,
      ];
      let sql = gameId === null ? PROJECTED_SESSIONS_ALL_SQL : PROJECTED_SESSIONS_BY_GAME_SQL;
      if (throughMs !== undefined) {
        sql = sql.replace(
          "  ORDER BY",
          gameId === null
            ? "  WHERE completed_at <= ?\n  ORDER BY"
            : "  AND completed_at <= ?\n  ORDER BY",
        );
      }
      return txn.all<ProjectedSessionRow>(sql, params);
    });
    measure.end({
      outcome: rows === null ? 'fallback' : 'rows',
      path: 'transaction',
      rowCount: rows === null ? 0 : rows.length,
    });
    return rows;
  } catch {
    measure.end({ outcome: 'error', path: 'none' });
    // Read-path resilience: any unexpected failure falls back to the legacy
    // loader rather than taking the Progress screens down (same policy as the
    // corrupt-JSON handling in db/sessions.ts `fromJson`).
    return null;
  }
}

/**
 * Rebuild a `GameSessionRecord` from a projected row. `rawResult` /
 * `difficulty` become minimal shims carrying exactly the fields the shared
 * `metrics-map` extractors recognize, which makes every downstream analytics
 * number identical to the full-blob path:
 *
 * - `extractScore` checks score → points → totalScore in order; the SQL
 *   COALESCE already resolved that priority to one number exposed as
 *   `shim.score`, so the extractor returns the same value.
 * - `extractAccuracy` finds `shim.accuracy` (same single resolved value) and
 *   applies its own [0,1] clamp, preserved by storing the unclamped value.
 * - `extractReactionMs` prefers mean fields over best fields; the SQL
 *   COALESCE encodes that same priority and exposes the winner as
 *   `shim.avgResponseMs` (a mean-field name, checked first).
 * - `extractDifficultyRating` tries numeric `challengeRating` before named
 *   `level`; the shim carries whichever one was present, unclamped/unmapped,
 *   so the extractor performs the same clamp/mapping as with the real blob.
 */
export function sessionRecordFromProjection(row: ProjectedSessionRow): GameSessionRecord {
  let rawResult: Record<string, number> | null = null;
  if (row.mScore !== null || row.mAccuracy !== null || row.mReactionMs !== null) {
    rawResult = {};
    if (row.mScore !== null) {
      rawResult.score = row.mScore;
    }
    if (row.mAccuracy !== null) {
      rawResult.accuracy = row.mAccuracy;
    }
    if (row.mReactionMs !== null) {
      rawResult.avgResponseMs = row.mReactionMs;
    }
  }

  let difficulty: Record<string, unknown> | null = null;
  if (row.mDifficultyRating !== null) {
    difficulty = { challengeRating: row.mDifficultyRating };
  } else if (row.mDifficultyLevel !== null) {
    difficulty = { level: row.mDifficultyLevel };
  }

  return {
    id: row.id,
    gameId: row.gameId,
    gameVersion: row.gameVersion,
    generatorVersion: row.generatorVersion,
    scoringVersion: row.scoringVersion,
    seed: row.seed,
    difficulty,
    rawResult,
    normalizedResult: row.normalizedResult,
    xp: row.xp,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    durationMs: row.durationMs,
  };
}
