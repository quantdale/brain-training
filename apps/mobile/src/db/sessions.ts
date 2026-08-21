import type { SQLiteAdapter } from "./adapter";
import { DIFFICULTY_LEVELS } from "@/sdk/types/difficulty";
import { LOCAL_PROFILE_ID } from "./profile";
import { RatingRepository } from "./rating";
import {
  MAX_READ_LIMIT,
  DEFAULT_READ_LIMIT,
  SQL_VARIABLE_CHUNK,
  buildInPlaceholders,
  chunk,
  clampLimit,
  joinAnd,
  normalizeOffset,
  requireFiniteNumber,
} from "./query";
import type { SQLiteValue } from "./types";
import type {
  AppliedRatingDelta,
  CompleteSessionInput,
  CompletionOutcome,
  GameSessionRecord,
  LedgerEntry,
  RatingDelta,
  RatingService,
} from "./types";

/**
 * Completed game sessions (constitution §9: "Completed sessions persist
 * atomically"). `completeSession` is the single write path: session row +
 * optional currency ledger entry + optional rating outcome (XP override,
 * currency award, per-domain rating history) + profile activity touch, all
 * in one transaction. A failure anywhere rolls everything back — no partial
 * session, no orphaned ledger entry or rating movement.
 */

interface SessionRow {
  id: string;
  game_id: string;
  game_version: number;
  generator_version: number;
  scoring_version: number;
  seed: number;
  difficulty_json: string;
  raw_result_json: string;
  normalized_result: number;
  xp: number;
  started_at: number;
  completed_at: number;
  duration_ms: number;
}

const INSERT_SESSION = `INSERT OR IGNORE INTO game_sessions (
    id, game_id, game_version, generator_version, scoring_version, seed,
    difficulty_json, raw_result_json, normalized_result, xp,
    started_at, completed_at, duration_ms
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const SELECT_SESSION_BY_ID = "SELECT * FROM game_sessions WHERE id = ?";
const SELECT_ALL_SESSIONS = "SELECT * FROM game_sessions";
/**
 * Column-limited projection for list/aggregate read paths (campaign 010 W11).
 * Exactly the columns the Progress/analytics consumers need — never the
 * per-session `difficulty_json` / `raw_result_json` blobs, whose JSON.parse
 * cost dominated screen loads at scale (009 audit F1/F3). Aliased to camelCase
 * so rows map 1:1 onto `SessionSummary` without a mapper pass.
 */
const SELECT_SUMMARY_COLUMNS =
  "SELECT id, game_id AS gameId, xp, normalized_result AS normalizedResult, " +
  "duration_ms AS durationMs, completed_at AS completedAt FROM game_sessions";
const SELECT_LEDGER_FOR_SESSION =
  "SELECT id, amount, reason, session_id, created_at, operation_id FROM currency_ledger WHERE session_id = ? ORDER BY id ASC LIMIT 1";
/** Stable idempotency key for a session's gameplay currency award. */
const gameplayOperationId = (sessionId: string): string =>
  `gameplay:${sessionId}`;
const SELECT_SESSIONS_BY_GAME =
  "SELECT * FROM game_sessions WHERE game_id = ? ORDER BY completed_at DESC LIMIT ?";
const SELECT_SESSIONS_RECENT =
  "SELECT * FROM game_sessions ORDER BY completed_at DESC LIMIT ?";
const SELECT_TOTAL_XP =
  "SELECT COALESCE(SUM(xp), 0) AS total FROM game_sessions";
const SELECT_COUNT = "SELECT COUNT(*) AS n FROM game_sessions";
const SELECT_DISTINCT_GAME_COUNT =
  "SELECT COUNT(DISTINCT game_id) AS n FROM game_sessions";
const SELECT_DISTINCT_ACTIVITY_DATE_COUNT =
  "SELECT COUNT(DISTINCT DATE(completed_at / 1000, 'unixepoch', 'localtime')) AS n FROM game_sessions";
const SELECT_ACCURACY_SESSION_COUNT =
  "SELECT COUNT(*) AS n FROM game_sessions WHERE normalized_result >= ?";
const SELECT_BEST_NORMALIZED =
  "SELECT COALESCE(MAX(normalized_result), 0) AS n FROM game_sessions";
const SELECT_GAME_ID_COUNTS =
  "SELECT game_id AS gameId, COUNT(*) AS n FROM game_sessions GROUP BY game_id";
const SELECT_LIGHTWEIGHT =
  "SELECT game_id AS gameId, xp, completed_at AS completedAt FROM game_sessions ORDER BY completed_at DESC LIMIT ?";
const SELECT_AGGREGATES = `
  SELECT game_id AS gameId, COUNT(*) AS count,
         AVG(normalized_result) AS avgNormalized,
         MAX(normalized_result) AS bestNormalized,
         MAX(completed_at) AS lastCompletedAt
  FROM game_sessions GROUP BY game_id ORDER BY lastCompletedAt DESC`;
const SELECT_AGGREGATE_BY_GAME = `
  SELECT game_id AS gameId, COUNT(*) AS count,
         AVG(normalized_result) AS avgNormalized,
         MAX(normalized_result) AS bestNormalized,
         MAX(completed_at) AS lastCompletedAt
  FROM game_sessions WHERE game_id = ? GROUP BY game_id`;
const SELECT_BALANCE = "SELECT balance FROM currency_balance";
const INSERT_LEDGER_ENTRY =
  "INSERT INTO currency_ledger (amount, reason, session_id, created_at) VALUES (?, ?, ?, ?)";
const INSERT_LEDGER_ENTRY_OP =
  "INSERT INTO currency_ledger (amount, reason, session_id, created_at, operation_id) VALUES (?, ?, ?, ?, ?)";
const PROFILE_INSERT_IF_ABSENT =
  "INSERT OR IGNORE INTO profile (id, display_name, settings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)";
const PROFILE_TOUCH = "UPDATE profile SET updated_at = ? WHERE id = ?";

/** JSON columns are always stored as JSON documents, never undefined. */
function toJson(value: unknown): string {
  return JSON.stringify(value === undefined ? null : value);
}

function fromJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // Corrupt JSON must not brick reads: one bad row used to throw out of
    // getById/listRecent and take down history screens and data export.
    // Degrade to a null payload (same policy as profile settings / workout
    // game ids) so the rest of the history stays readable.
    return null;
  }
}

function mapRow(row: SessionRow): GameSessionRecord {
  return {
    id: row.id,
    gameId: row.game_id,
    gameVersion: row.game_version,
    generatorVersion: row.generator_version,
    scoringVersion: row.scoring_version,
    seed: row.seed,
    difficulty: fromJson(row.difficulty_json),
    rawResult: fromJson(row.raw_result_json),
    normalizedResult: row.normalized_result,
    xp: row.xp,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms,
  };
}

export interface CompleteSessionResult {
  session: GameSessionRecord;
  /** The ledger entry committed with the session, or null when none requested. */
  ledgerEntry: LedgerEntry | null;
  /** Balance after this completion. */
  balance: number;
  /**
   * Rating outcome applied by the configured rating service, or null when no
   * service is configured. `session.xp` reflects the outcome's authoritative
   * XP when present.
   */
  rating: {
    xp: number;
    currency: number;
    deltas: readonly RatingDelta[];
    balance: number;
  } | null;
  /**
   * The authoritative completion outcome (constitution §15). Present when a
   * rating service is configured. Contains the persisted session with
   * authoritative XP, per-domain applied deltas with resulting ratings,
   * and the post-completion balance. This is the single source of truth for
   * the result UI; game screens should render from this rather than their own
   * no-op XP hooks.
   */
  completionOutcome: CompletionOutcome | null;
}

export class SessionRepository {
  /**
   * @param now Injectable clock (Unix epoch ms) so tests are deterministic.
   * @param rating Optional rating service (see `RatingService`): its outcome
   *   is applied atomically with the session row.
   */
  constructor(
    private readonly adapter: SQLiteAdapter,
    private readonly now: () => number = () => Date.now(),
    private readonly rating?: RatingService,
  ) {
    this.ratingRepository = new RatingRepository(adapter, now);
  }

  private readonly ratingRepository: RatingRepository;

  /**
   * Persist a completed session atomically: session row, optional currency
   * ledger entry (timestamped with the session's own completion time), and a
   * profile activity touch. Rolls back entirely on any failure.
   */
  async completeSession(
    input: CompleteSessionInput,
  ): Promise<CompleteSessionResult> {
    const s = input.session;

    // Friendly validation up front; DB CHECK constraints back this up.
    if (!s.id) {
      throw new Error("completeSession: session.id is required");
    }
    if (s.completedAt < s.startedAt) {
      throw new Error("completeSession: completedAt must be >= startedAt");
    }
    if (s.durationMs < 0) {
      throw new Error("completeSession: durationMs must be >= 0");
    }

    return this.adapter.transaction(async (txn) => {
      // When a rating service is configured, its outcome is authoritative for
      // XP/currency/ratings and must be computed before the session row exists
      // (the history rows reference the session id).
      const outcome = this.rating
        ? await this.rating.compute({ session: s })
        : null;
      const xp = outcome ? outcome.xp : s.xp;

      // Idempotent by session id (data-integrity requirement A/H: a retried or
      // replayed completion of the same `session.id` must never award currency
      // or ratings twice, and must not crash on the primary-key collision).
      // `INSERT OR IGNORE` leaves an already-present row untouched and reports
      // `changes === 0`; we only commit the gameplay currency award and rating
      // deltas for a freshly inserted row. A replay is otherwise harmless (the
      // profile touch below is idempotent) and the caller observes the
      // already-persisted row via the result.
      const insert = await txn.run(INSERT_SESSION, [
        s.id,
        s.gameId,
        s.gameVersion,
        s.generatorVersion,
        s.scoringVersion,
        s.seed,
        toJson(s.difficulty),
        toJson(s.rawResult),
        s.normalizedResult,
        xp,
        s.startedAt,
        s.completedAt,
        s.durationMs,
      ]);
      const isNew = insert.changes > 0;

      // Ownership (task 7.6): when a rating service is configured it owns the
      // gameplay currency award; a caller-supplied `input.currency` is ignored
      // so the same completion event is never double-awarded. When no rating
      // service is present the caller entry is the single owner. Rewards are
      // only granted on the first (new) completion; replays are no-ops.
      let ledgerEntry: LedgerEntry | null = null;
      if (isNew && outcome && outcome.currency > 0) {
        const result = await txn.run(INSERT_LEDGER_ENTRY_OP, [
          outcome.currency,
          "gameplay",
          s.id,
          s.completedAt,
          gameplayOperationId(s.id),
        ]);
        ledgerEntry = {
          id: result.lastInsertRowId,
          amount: outcome.currency,
          reason: "gameplay",
          sessionId: s.id,
          createdAt: s.completedAt,
        };
      } else if (isNew && !outcome && input.currency) {
        const result = await txn.run(INSERT_LEDGER_ENTRY_OP, [
          input.currency.amount,
          input.currency.reason,
          s.id,
          s.completedAt,
          gameplayOperationId(s.id),
        ]);
        ledgerEntry = {
          id: result.lastInsertRowId,
          amount: input.currency.amount,
          reason: input.currency.reason,
          sessionId: s.id,
          createdAt: s.completedAt,
        };
      }

      const deltas: readonly RatingDelta[] = outcome ? outcome.deltas : [];
      let appliedDeltas: readonly AppliedRatingDelta[] = [];
      if (isNew && deltas.length > 0) {
        appliedDeltas = await this.ratingRepository.applyDeltas(txn, s.id, deltas, s.completedAt);
      }

      // On a duplicate completion we reflect the already-persisted row rather
      // than re-awarding; no ledger entry or rating deltas are produced.
      let existing: SessionRow | null = null;
      if (!isNew) {
        existing = await txn.get<SessionRow>(SELECT_SESSION_BY_ID, [s.id]);
        if (!existing) {
          // Should be unreachable: INSERT OR IGNORE only skips on a conflict.
          throw new Error(`completeSession: missing existing row for duplicate id ${s.id}`);
        }
      }

      // Profile touch: record activity so consumers can detect "last active".
      const touchAt = this.now();
      await txn.run(PROFILE_INSERT_IF_ABSENT, [
        LOCAL_PROFILE_ID,
        "",
        "{}",
        touchAt,
        touchAt,
      ]);
      await txn.run(PROFILE_TOUCH, [touchAt, LOCAL_PROFILE_ID]);

      const balanceRow = await txn.get<{ balance: number }>(SELECT_BALANCE);
      const balance = balanceRow?.balance ?? 0;
      // `existing` is non-null only on the duplicate path (the re-read above
      // throws if it somehow missed), so the non-null assertion is safe.
      const stored: GameSessionRecord = isNew
        ? { ...s, xp }
        : mapRow(existing!);

      // Build the authoritative completion outcome when a rating service is
      // configured and this is a fresh completion (constitution §15). On a
      // duplicate replay we report no freshly-applied outcome (the persisted
      // state is unchanged) but still surface the existing balance.
      const completionOutcome: CompletionOutcome | null =
        isNew && outcome
          ? {
              session: stored,
              xp: outcome.xp,
              currency: outcome.currency,
              deltas: appliedDeltas,
              balance,
            }
          : null;

      return {
        session: stored,
        ledgerEntry,
        balance,
        rating:
          isNew && outcome
            ? { xp: outcome.xp, currency: outcome.currency, deltas, balance }
            : null,
        completionOutcome,
      };
    });
  }

  async getById(id: string): Promise<GameSessionRecord | null> {
    const row = await this.adapter.get<SessionRow>(SELECT_SESSION_BY_ID, [id]);
    return row ? mapRow(row) : null;
  }

  /** Most recent sessions for one game, newest first. */
  async listByGame(gameId: string, limit = 50): Promise<GameSessionRecord[]> {
    const rows = await this.adapter.all<SessionRow>(SELECT_SESSIONS_BY_GAME, [
      gameId,
      limit,
    ]);
    return rows.map(mapRow);
  }

  /** Most recent sessions across all games, newest first. */
  async listRecent(limit = 50): Promise<GameSessionRecord[]> {
    const rows = await this.adapter.all<SessionRow>(SELECT_SESSIONS_RECENT, [
      limit,
    ]);
    return rows.map(mapRow);
  }

  /** Lifetime XP across all completed sessions (constitution §17). */
  async getTotalXp(): Promise<number> {
    const row = await this.adapter.get<{ total: number }>(SELECT_TOTAL_XP);
    return row?.total ?? 0;
  }

  /** Total completed sessions (O(1) aggregate; constitution §17). */
  async getCount(): Promise<number> {
    const row = await this.adapter.get<{ n: number }>(SELECT_COUNT);
    return row?.n ?? 0;
  }

  /** Number of distinct games ever played (breadth, §B). */
  async getDistinctGameCount(): Promise<number> {
    const row = await this.adapter.get<{ n: number }>(
      SELECT_DISTINCT_GAME_COUNT,
    );
    return row?.n ?? 0;
  }

  /** Number of distinct local calendar days with at least one session (consistency, §B). */
  async getDistinctActivityDateCount(): Promise<number> {
    const row = await this.adapter.get<{ n: number }>(
      SELECT_DISTINCT_ACTIVITY_DATE_COUNT,
    );
    return row?.n ?? 0;
  }

  /** Count of sessions whose normalized performance reached `threshold` (accuracy, §B). */
  async getAccuracySessionCount(threshold: number): Promise<number> {
    const row = await this.adapter.get<{ n: number }>(
      SELECT_ACCURACY_SESSION_COUNT,
      [threshold],
    );
    return row?.n ?? 0;
  }

  /** Best single-session normalized performance ever reached (0..1, personal best, §B). */
  async getBestNormalized(): Promise<number> {
    const row = await this.adapter.get<{ n: number }>(SELECT_BEST_NORMALIZED);
    return row?.n ?? 0;
  }

  /** Per-game session counts (at most one row per game; cheap for the catalog). */
  async getGameIdCounts(): Promise<Record<string, number>> {
    const rows = await this.adapter.all<{ gameId: string; n: number }>(
      SELECT_GAME_ID_COUNTS,
    );
    const out: Record<string, number> = {};
    for (const row of rows) {
      out[row.gameId] = row.n;
    }
    return out;
  }

  /**
   * Lightweight session projection for quest/achievement evaluation: only the
   * columns those engines need (game id, xp, completion time) — no JSON blobs.
   * Replaces `listRecent` for evaluation so large histories don't materialize
   * every heavy row (scalability, §F). `completedAt` is the local completion
   * epoch ms; callers map `gameId` → domain via the registry.
   */
  async listLightweight(
    limit = 5000,
  ): Promise<{ gameId: string; xp: number; completedAt: number }[]> {
    return this.adapter.all<{
      gameId: string;
      xp: number;
      completedAt: number;
    }>(SELECT_LIGHTWEIGHT, [limit]);
  }

  /**
   * Task 9.3: Get distinct activity dates for streak calculation.
   * Returns dates in YYYY-MM-DD format, most recent first.
   * Uses canonical activity query instead of arbitrary session limit.
   * Dates are LOCAL calendar days (`'localtime'` modifier): the streak engine
   * (`reconstructStreak`) and every other consumer key days by the device's
   * local calendar ("repo local-calendar convention"), so a session counts for
   * the day the user actually played it, not its UTC date.
   */
  async getDistinctActivityDates(): Promise<string[]> {
    const rows = await this.adapter.all<{ date: string }>(
      `SELECT DISTINCT DATE(completed_at / 1000, 'unixepoch', 'localtime') as date
       FROM game_sessions
       ORDER BY date DESC`,
    );
    return rows.map((row) => row.date);
  }

  /**
   * Per-game aggregates (constitution §21: per-game analytics). `avgNormalized`
   * and `bestNormalized` are on the shared 0..1 normalized scale.
   */
  async getAggregates(): Promise<GameAggregate[]> {
    const rows = await this.adapter.all<GameAggregateRow>(SELECT_AGGREGATES);
    return rows.map(mapAggregateRow);
  }

  /** Aggregate for one game, or null when it has no sessions yet. */
  async getGameAggregate(gameId: string): Promise<GameAggregate | null> {
    const row = await this.adapter.get<GameAggregateRow>(
      SELECT_AGGREGATE_BY_GAME,
      [gameId],
    );
    return row ? mapAggregateRow(row) : null;
  }

  /**
   * Column-limited session summaries with filter/order/pagination (campaign
   * 010 W11; answers the 009 audit's projection-read request). Reads only the
   * six projected columns — no JSON blobs — so cost scales with the page size,
   * not the history size.
   *
   * Index-awareness: without `gameIds` the read walks
   * `idx_game_sessions_completed_at` (ORDER BY completed_at); with `gameIds`
   * it walks `idx_game_sessions_game_id` (game_id, completed_at). Both orders
   * tie-break on `id` so equal timestamps still paginate deterministically.
   */
  async listSummaries(query: SessionSummaryQuery = {}): Promise<SessionSummary[]> {
    assertSummaryQuery(query);
    const { whereSql, params } = buildSessionFilter(query);
    const order = query.order === "asc" ? "ASC" : "DESC";
    const limit = clampLimit(query.limit, DEFAULT_READ_LIMIT, MAX_READ_LIMIT);
    const offset = normalizeOffset(query.offset);
    return this.adapter.all<SessionSummary>(
      `${SELECT_SUMMARY_COLUMNS} ${whereSql} ` +
        `ORDER BY completed_at ${order}, id ${order} LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
  }

  /**
   * Keyset-paginated walk over all sessions, newest first
   * (`completed_at DESC, id DESC`). Unlike OFFSET paging, per-page cost stays
   * flat at any depth: each page seeks directly past the previous page's last
   * row via `idx_game_sessions_completed_at`. Pass `nextCursor` from the
   * previous page until it comes back null.
   */
  async pageSummaries(
    cursor: SessionCursor | null = null,
    limit = DEFAULT_READ_LIMIT,
  ): Promise<SessionPage> {
    if (cursor !== null && !isValidSessionCursor(cursor)) {
      throw new Error(
        "pageSummaries: cursor must be { completedAt: finite number, id: non-empty string }",
      );
    }
    const pageSize = clampLimit(limit, DEFAULT_READ_LIMIT, MAX_READ_LIMIT);
    const conditions: string[] = [];
    const params: SQLiteValue[] = [];
    if (cursor) {
      // Expanded (non-row-value) keyset predicate: portable across every
      // SQLite either backend may ship, and sargable for the completed_at index.
      conditions.push("(completed_at < ? OR (completed_at = ? AND id < ?))");
      params.push(cursor.completedAt, cursor.completedAt, cursor.id);
    }
    // One extra row detects hasMore without a COUNT scan.
    const rows = await this.adapter.all<SessionSummary>(
      `${SELECT_SUMMARY_COLUMNS} ${joinAnd(conditions)} ` +
        "ORDER BY completed_at DESC, id DESC LIMIT ?",
      [...params, pageSize + 1],
    );
    const hasMore = rows.length > pageSize;
    const items = hasMore ? rows.slice(0, pageSize) : rows;
    const last = items[items.length - 1];
    return {
      items,
      hasMore,
      nextCursor:
        hasMore && last ? { completedAt: last.completedAt, id: last.id } : null,
    };
  }

  /** COUNT pushdown for the same filter shape `listSummaries` accepts. */
  async countSessions(query: SessionFilterQuery = {}): Promise<number> {
    assertSummaryQuery(query);
    const { whereSql, params } = buildSessionFilter(query);
    const row = await this.adapter.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM game_sessions ${whereSql}`,
      params,
    );
    return row?.n ?? 0;
  }

  /**
   * One-statement aggregate pushdown over a filtered window (COUNT/SUM/AVG/
   * MAX/MIN computed in SQLite instead of materializing rows into JS).
   * All-zero result means "no matching sessions".
   */
  async getSessionWindowAggregate(
    query: SessionFilterQuery = {},
  ): Promise<WindowedSessionAggregate> {
    assertSummaryQuery(query);
    const { whereSql, params } = buildSessionFilter(query);
    const row = await this.adapter.get<WindowedSessionAggregate>(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(xp), 0) AS totalXp,
              COALESCE(AVG(normalized_result), 0) AS avgNormalized,
              COALESCE(MAX(normalized_result), 0) AS bestNormalized,
              COALESCE(SUM(duration_ms), 0) AS totalDurationMs,
              COALESCE(MIN(completed_at), 0) AS firstCompletedAt,
              COALESCE(MAX(completed_at), 0) AS lastCompletedAt
       FROM game_sessions ${whereSql}`,
      params,
    );
    return (
      row ?? {
        count: 0,
        totalXp: 0,
        avgNormalized: 0,
        bestNormalized: 0,
        totalDurationMs: 0,
        firstCompletedAt: 0,
        lastCompletedAt: 0,
      }
    );
  }

  /**
   * Sessions-per-day counts pushed down to SQLite (one row per active day —
   * the cheap input for activity calendars/frequency charts, replacing full
   * row reads). `dayBoundary` picks the day-key convention: 'utc' matches the
   * analytics calendar (`utcDateKey`); 'local' matches the streak engine's
   * local-calendar convention (see `getDistinctActivityDates`). Days sort
   * newest first.
   */
  async getDailySessionCounts(
    query: SessionDayCountQuery = {},
  ): Promise<DailySessionCount[]> {
    assertSummaryQuery(query);
    if (
      query.dayBoundary !== undefined &&
      query.dayBoundary !== "utc" &&
      query.dayBoundary !== "local"
    ) {
      throw new Error('getDailySessionCounts: dayBoundary must be "utc" or "local"');
    }
    const { whereSql, params } = buildSessionFilter(query);
    // Only two fixed modifier strings exist; caller text never reaches SQL.
    const modifier = query.dayBoundary === "local" ? ", 'localtime'" : "";
    return this.adapter.all<DailySessionCount>(
      `SELECT DATE(completed_at / 1000, 'unixepoch'${modifier}) AS day,
              COUNT(*) AS count
       FROM game_sessions ${whereSql}
       GROUP BY day
       ORDER BY day DESC`,
      params,
    );
  }

  /* --------------------------------------------------------------------- *
   * Progress read projection (campaign 010 W22; resolves W09's NEEDS_PARENT
   * repository-primitive request)
   * --------------------------------------------------------------------- */

  /**
   * Newest-first Progress projection over ALL sessions: the scalar session
   * columns plus blob-derived metric scalars extracted inside SQLite
   * (`json_extract`), so the heavy `difficulty_json` / `raw_result_json`
   * blobs never cross into JS and no per-row `JSON.parse` runs on the JS
   * thread. A plain repository read on the shared connection — deliberately
   * NOT wrapped in a transaction, so Progress loads never take the
   * exclusive-lock detour the former `db.transaction()` seam required.
   *
   * `limit` is validated finite and floored but otherwise passed through
   * unclamped: analytics callers deliberately pass "effectively everything"
   * limits for lifetime aggregates, and clamping here would make this fast
   * path return different data than the legacy full-row fallback.
   *
   * Throws when the SQLite build lacks JSON1 functions (and on any SQL
   * error); the analytics loader treats that as "fast path unavailable" and
   * falls back — this read can never make Progress less available than the
   * legacy full-row reads it supplements.
   */
  async listProgressProjection(limit: number): Promise<SessionProgressRow[]> {
    requireFiniteNumber(limit, "limit");
    // Binding order follows placeholder textual order: the select list's two
    // difficulty-level IN-groups first, then the limit.
    return this.adapter.all<SessionProgressRow>(PROJECTED_SESSIONS_ALL_SQL, [
      ...DIFFICULTY_LEVEL_PARAMS,
      ...DIFFICULTY_LEVEL_PARAMS,
      Math.floor(limit),
    ]);
  }

  /** {@link listProgressProjection} restricted to one game (walks idx_game_sessions_game_id). */
  async listProgressProjectionByGame(
    gameId: string,
    limit: number,
  ): Promise<SessionProgressRow[]> {
    requireFiniteNumber(limit, "limit");
    return this.adapter.all<SessionProgressRow>(PROJECTED_SESSIONS_BY_GAME_SQL, [
      ...DIFFICULTY_LEVEL_PARAMS,
      ...DIFFICULTY_LEVEL_PARAMS,
      gameId,
      Math.floor(limit),
    ]);
  }

  /**
   * Bulk fetch by id preserving the CALLER'S order (deduplicated; missing ids
   * are simply absent). Ids are chunked under the per-statement variable
   * budget so arbitrarily large id lists stay safe.
   */
  async listByIds(ids: readonly string[]): Promise<GameSessionRecord[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      return [];
    }
    const byId = new Map<string, GameSessionRecord>();
    for (const chunkIds of chunk(unique, SQL_VARIABLE_CHUNK)) {
      const rows = await this.adapter.all<SessionRow>(
        `${SELECT_ALL_SESSIONS} WHERE id IN (${buildInPlaceholders(chunkIds.length)})`,
        chunkIds,
      );
      for (const row of rows) {
        byId.set(row.id, mapRow(row));
      }
    }
    return unique.flatMap((id) => {
      const record = byId.get(id);
      return record ? [record] : [];
    });
  }
}

export interface GameAggregate {
  gameId: string;
  count: number;
  /** Mean normalized performance (0..1) across the game's sessions. */
  avgNormalized: number;
  /** Best normalized performance (0..1). */
  bestNormalized: number;
  /** Unix epoch ms of the most recent session. */
  lastCompletedAt: number;
}

interface GameAggregateRow {
  gameId: string;
  count: number;
  avgNormalized: number | null;
  bestNormalized: number | null;
  lastCompletedAt: number | null;
}

function mapAggregateRow(row: GameAggregateRow): GameAggregate {
  return {
    gameId: row.gameId,
    count: row.count,
    avgNormalized: row.avgNormalized ?? 0,
    bestNormalized: row.bestNormalized ?? 0,
    lastCompletedAt: row.lastCompletedAt ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Projection / pagination APIs (campaign 010 W11)
// ---------------------------------------------------------------------------

/**
 * Lightweight session projection (constitution §21 analytics inputs). Six
 * scalar columns only — deliberately excludes the per-session
 * `difficulty`/`rawResult` JSON blobs, whose parse cost is what made full-row
 * reads scale poorly (009 audit F1/F3).
 */
export interface SessionSummary {
  id: string;
  gameId: string;
  xp: number;
  /** Shared 0..1 normalized performance. */
  normalizedResult: number;
  durationMs: number;
  /** Unix epoch ms of completion. */
  completedAt: number;
}

/** Filter shape shared by the windowed read/aggregate/count APIs. */
export interface SessionFilterQuery {
  /** Any of these games; empty/undefined = all games. */
  gameIds?: readonly string[];
  /** Inclusive lower bound on completed_at (epoch ms). */
  fromMs?: number;
  /** Inclusive upper bound on completed_at (epoch ms). */
  toMs?: number;
  /** Inclusive lower bound on normalized_result (0..1). */
  minNormalized?: number;
  /** Inclusive upper bound on normalized_result (0..1). */
  maxNormalized?: number;
}

/** `SessionFilterQuery` plus ordering and offset pagination for list reads. */
export interface SessionSummaryQuery extends SessionFilterQuery {
  /** Sort by completed_at; defaults to 'desc' (newest first). */
  order?: "asc" | "desc";
  /** Page size; clamped to [1, MAX_READ_LIMIT], default DEFAULT_READ_LIMIT. */
  limit?: number;
  /** Offset into the ordered result set; negative/undefined = 0. */
  offset?: number;
}

/** Day-key convention for `getDailySessionCounts`. */
export type SessionDayBoundary = "utc" | "local";

export interface SessionDayCountQuery extends SessionFilterQuery {
  /** Defaults to 'utc' (matches the analytics calendar convention). */
  dayBoundary?: SessionDayBoundary;
}

/** Resume point for keyset pagination (`pageSummaries`). Opaque to callers. */
export interface SessionCursor {
  completedAt: number;
  id: string;
}

/** One page of the keyset walk over all sessions, newest first. */
export interface SessionPage {
  items: SessionSummary[];
  /** True when another page exists after this one. */
  hasMore: boolean;
  /** Pass to the next `pageSummaries` call; null when exhausted. */
  nextCursor: SessionCursor | null;
}

/** Aggregate pushdown result for a filtered session window. */
export interface WindowedSessionAggregate {
  count: number;
  totalXp: number;
  avgNormalized: number;
  bestNormalized: number;
  totalDurationMs: number;
  /** Earliest matching completion (0 when none). */
  firstCompletedAt: number;
  /** Latest matching completion (0 when none). */
  lastCompletedAt: number;
}

/** One row of `getDailySessionCounts`. */
export interface DailySessionCount {
  /** YYYY-MM-DD day key in the requested boundary convention. */
  day: string;
  count: number;
}

/** Structural guard so deserialized cursors are validated before use. */
export function isValidSessionCursor(value: unknown): value is SessionCursor {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<SessionCursor>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.completedAt === "number" &&
    Number.isFinite(candidate.completedAt)
  );
}

/** Reject non-finite bounds up front with caller-facing names. */
function assertSummaryQuery(query: SessionSummaryQuery): void {
  requireFiniteNumber(query.fromMs, "query.fromMs");
  requireFiniteNumber(query.toMs, "query.toMs");
  requireFiniteNumber(query.minNormalized, "query.minNormalized");
  requireFiniteNumber(query.maxNormalized, "query.maxNormalized");
  if (
    query.order !== undefined &&
    query.order !== "asc" &&
    query.order !== "desc"
  ) {
    throw new Error('query.order: must be "asc" or "desc"');
  }
}

/**
 * Compose the shared WHERE clause for session projection/aggregate queries.
 * Values always bind as positional params; the only interpolated SQL comes
 * from fixed strings built here. `gameIds` dedupes and OR-groups its IN lists
 * so id sets larger than the per-statement variable budget stay correct.
 */
function buildSessionFilter(query: SessionFilterQuery): {
  whereSql: string;
  params: SQLiteValue[];
} {
  const conditions: string[] = [];
  const params: SQLiteValue[] = [];

  if (query.gameIds && query.gameIds.length > 0) {
    const unique = [...new Set(query.gameIds)];
    const groups: string[] = [];
    for (const chunkIds of chunk(unique, SQL_VARIABLE_CHUNK)) {
      groups.push(`game_id IN (${buildInPlaceholders(chunkIds.length)})`);
      params.push(...chunkIds);
    }
    conditions.push(`(${groups.join(" OR ")})`);
  }
  if (query.fromMs !== undefined) {
    conditions.push("completed_at >= ?");
    params.push(query.fromMs);
  }
  if (query.toMs !== undefined) {
    conditions.push("completed_at <= ?");
    params.push(query.toMs);
  }
  if (query.minNormalized !== undefined) {
    conditions.push("normalized_result >= ?");
    params.push(query.minNormalized);
  }
  if (query.maxNormalized !== undefined) {
    conditions.push("normalized_result <= ?");
    params.push(query.maxNormalized);
  }

  return { whereSql: joinAnd(conditions), params };
}

// ---------------------------------------------------------------------------
// Progress read-projection SQL (campaign 010 W22)
// ---------------------------------------------------------------------------

/**
 * One row of the Progress read projection: the scalar session columns plus
 * per-row metrics extracted from the JSON blobs in SQLite (`json_extract`),
 * so blob strings never cross into JS. Canonical home of the shape —
 * `analytics/projections.ts` re-exports it under its historical
 * `ProjectedSessionRow` name. Each `m*` field mirrors what the shared
 * `metrics-map` extractors read from the full blobs; null = field absent.
 */
export interface SessionProgressRow {
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
 * Field-name mirrors of the private candidate lists in
 * `analytics/metrics-map.ts`. The SQL extraction below must recognize exactly
 * the same names in the same priority order so shim-based extraction stays
 * behaviorally identical to parsing the full blob. If `metrics-map` gains a
 * field name, mirror it here in the same position.
 */
const SCORE_FIELDS = ["score", "points", "totalScore"] as const;
const ACCURACY_FIELDS = ["accuracy", "hitRate", "precision"] as const;
const REACTION_MEAN_FIELDS = [
  "avgResponseMs",
  "meanReactionMs",
  "avgReactionMs",
  "averageAnswerMs",
  "avgReactionTimeMs",
  "medianReactionMs",
] as const;
const REACTION_BEST_FIELDS = [
  "fastestReactionMs",
  "bestReactionMs",
  "fastestResponseMs",
] as const;

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
  const inner = paths.map((path) => jsonNumberExpr(doc, path)).join(", ");
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
  const placeholders = DIFFICULTY_LEVELS.map(() => "?").join(", ");
  return (
    // Object form: {"level": "<known>"}
    "CASE WHEN json_valid(difficulty_json) THEN COALESCE(" +
    `CASE WHEN json_type(difficulty_json, '$.level') = 'text' ` +
    `AND json_extract(difficulty_json, '$.level') IN (${placeholders}) ` +
    `THEN json_extract(difficulty_json, '$.level') END, ` +
    // Bare-string form: "<known>"
    `CASE WHEN json_type(difficulty_json) = 'text' ` +
    `AND json_extract(difficulty_json, '$') IN (${placeholders}) ` +
    `THEN json_extract(difficulty_json, '$') END` +
    ") END"
  );
}

/** Projected column list; placeholder order = [levels…, levels…]. */
const SESSION_PROGRESS_COLUMNS = [
  "id",
  "game_id AS gameId",
  "game_version AS gameVersion",
  "generator_version AS generatorVersion",
  "scoring_version AS scoringVersion",
  "seed",
  "normalized_result AS normalizedResult",
  "xp",
  "started_at AS startedAt",
  "completed_at AS completedAt",
  "duration_ms AS durationMs",
  coalescedJsonNumbers("raw_result_json", SCORE_FIELDS) + " AS mScore",
  coalescedJsonNumbers("raw_result_json", ACCURACY_FIELDS) + " AS mAccuracy",
  coalescedJsonNumbers("raw_result_json", [...REACTION_MEAN_FIELDS, ...REACTION_BEST_FIELDS]) +
    " AS mReactionMs",
  coalescedJsonNumbers("difficulty_json", ["$.challengeRating"]) + " AS mDifficultyRating",
  difficultyLevelExpr() + " AS mDifficultyLevel",
].join(",\n  ");

/** Newest-first projection over every session (bounded by the caller's limit). */
export const PROJECTED_SESSIONS_ALL_SQL = `
  SELECT ${SESSION_PROGRESS_COLUMNS}
  FROM game_sessions
  ORDER BY completed_at DESC
  LIMIT ?`;

/** Newest-first projection for one game (uses idx_game_sessions_game_id). */
export const PROJECTED_SESSIONS_BY_GAME_SQL = `
  SELECT ${SESSION_PROGRESS_COLUMNS}
  FROM game_sessions
  WHERE game_id = ?
  ORDER BY completed_at DESC
  LIMIT ?`;
