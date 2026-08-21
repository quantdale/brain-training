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
 * db-layer note: `AppDatabase` exposes no public raw-read API, so the
 * projection runs through the existing public `db.transaction()` seam (the
 * same pattern feature modules like cosmetics/rewards already use). A
 * dedicated read-only repository method would remove the exclusive-lock
 * detour; see the NEEDS_PARENT note in `.agent/_tasks/campaign010/W09.md`.
 */

import type { AppDatabase, GameSessionRecord, SQLiteAdapter, SQLiteValue } from '@/db';
import { DIFFICULTY_LEVELS } from '@/sdk';

/**
 * Field-name mirrors of the private candidate lists in `metrics-map.ts`
 * (W08-owned). The SQL extraction below must recognize exactly the same names
 * in the same priority order so shim-based extraction stays behaviorally
 * identical to parsing the full blob. If `metrics-map` gains a field name,
 * mirror it here in the same position.
 */
const SCORE_FIELDS = ['score', 'points', 'totalScore'] as const;
const ACCURACY_FIELDS = ['accuracy', 'hitRate', 'precision'] as const;
const REACTION_MEAN_FIELDS = [
  'avgResponseMs',
  'meanReactionMs',
  'avgReactionMs',
  'averageAnswerMs',
  'avgReactionTimeMs',
  'medianReactionMs',
] as const;
const REACTION_BEST_FIELDS = ['fastestReactionMs', 'bestReactionMs', 'fastestResponseMs'] as const;

/** One projected session row: scalar columns + blob-derived metric scalars. */
export interface ProjectedSessionRow {
  id: string;
  gameId: string;
  gameVersion: number;
  generatorVersion: number;
  scoringVersion: number;
  seed: number;
  normalizedResult: number;
  xp: number;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  /** First numeric `raw_result_json` score field (metrics-map priority), else null. */
  mScore: number | null;
  /** First numeric accuracy field, unclamped (the shared extractor clamps), else null. */
  mAccuracy: number | null;
  /** First reaction-time field (means before bests), else null. */
  mReactionMs: number | null;
  /** Numeric `difficulty_json.challengeRating`, unclamped, else null. */
  mDifficultyRating: number | null;
  /** `difficulty_json.level` when it is a known SDK level string, else null. */
  mDifficultyLevel: string | null;
}

/**
 * SQL expression for "first JSON number among `paths`", mirroring
 * `readNumber` (non-objects and non-numbers yield null). The outer
 * `json_valid` CASE guards malformed/corrupt blobs — SQLite only evaluates
 * the chosen CASE arm, so invalid JSON degrades to nulls exactly like the
 * JS-side `fromJson` fallback instead of erroring the whole scan.
 */
function jsonNumberExpr(doc: string, path: string): string {
  return (
    `CASE WHEN json_type(${doc}, '${path}') IN ('integer','real') ` +
    `THEN json_extract(${doc}, '${path}') END`
  );
}

function coalescedJsonNumbers(doc: string, paths: readonly string[]): string {
  const inner = paths.map((path) => jsonNumberExpr(doc, path)).join(', ');
  return `CASE WHEN json_valid(${doc}) THEN COALESCE(${inner}) END`;
}

/** Bound parameter values for the known SDK difficulty levels (deterministic order). */
export const DIFFICULTY_LEVEL_PARAMS: readonly SQLiteValue[] = [...DIFFICULTY_LEVELS];

/**
 * Known difficulty-level string from `difficulty_json`, in either object form
 * (`{"level":"hard"}`) or bare-string form (`"hard"`). Unknown strings stay
 * null; the shared extractor maps them to challenge ratings.
 */
function difficultyLevelExpr(): string {
  const placeholders = DIFFICULTY_LEVELS.map(() => '?').join(', ');
  return (
    // Object form: {"level": "<known>"}
    'CASE WHEN json_valid(difficulty_json) THEN COALESCE(' +
    `CASE WHEN json_type(difficulty_json, '$.level') = 'text' ` +
    `AND json_extract(difficulty_json, '$.level') IN (${placeholders}) ` +
    `THEN json_extract(difficulty_json, '$.level') END, ` +
    // Bare-string form: "<known>"
    `CASE WHEN json_type(difficulty_json) = 'text' ` +
    `AND json_extract(difficulty_json, '$') IN (${placeholders}) ` +
    `THEN json_extract(difficulty_json, '$') END` +
    ') END'
  );
}

/** Projected column list; placeholder order = [levels…, levels…]. */
const PROJECTED_COLUMNS = [
  'id',
  'game_id AS gameId',
  'game_version AS gameVersion',
  'generator_version AS generatorVersion',
  'scoring_version AS scoringVersion',
  'seed',
  'normalized_result AS normalizedResult',
  'xp',
  'started_at AS startedAt',
  'completed_at AS completedAt',
  'duration_ms AS durationMs',
  coalescedJsonNumbers('raw_result_json', SCORE_FIELDS) + ' AS mScore',
  coalescedJsonNumbers('raw_result_json', ACCURACY_FIELDS) + ' AS mAccuracy',
  coalescedJsonNumbers('raw_result_json', [...REACTION_MEAN_FIELDS, ...REACTION_BEST_FIELDS]) +
    ' AS mReactionMs',
  coalescedJsonNumbers('difficulty_json', ['$.challengeRating']) + ' AS mDifficultyRating',
  difficultyLevelExpr() + ' AS mDifficultyLevel',
].join(',\n  ');

/** Newest-first projection over every session (bounded by the caller's limit). */
export const PROJECTED_SESSIONS_ALL_SQL = `
  SELECT ${PROJECTED_COLUMNS}
  FROM game_sessions
  ORDER BY completed_at DESC
  LIMIT ?`;

/** Newest-first projection for one game (uses idx_game_sessions_game_id). */
export const PROJECTED_SESSIONS_BY_GAME_SQL = `
  SELECT ${PROJECTED_COLUMNS}
  FROM game_sessions
  WHERE game_id = ?
  ORDER BY completed_at DESC
  LIMIT ?`;

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
 * Load projected session rows newest-first, or `null` when the fast path is
 * unavailable (no JSON1 support, nested-transaction guard, any SQL error) so
 * callers can fall back to the legacy full-row repository reads. Never throws.
 *
 * `gameId === null` loads across all games; otherwise only that game's rows.
 */
export async function tryLoadProjectedSessionRows(
  db: AppDatabase,
  gameId: string | null,
  limit: number,
): Promise<ProjectedSessionRow[] | null> {
  try {
    return await db.transaction(async (txn) => {
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
        limit,
      ];
      const sql = gameId === null ? PROJECTED_SESSIONS_ALL_SQL : PROJECTED_SESSIONS_BY_GAME_SQL;
      return txn.all<ProjectedSessionRow>(sql, params);
    });
  } catch {
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
