import type { SQLiteAdapter } from './adapter';
import { LOCAL_PROFILE_ID } from './profile';
import { RatingRepository } from './rating';
import type {
  AppliedRatingDelta,
  CompleteSessionInput,
  CompletionOutcome,
  GameSessionRecord,
  LedgerEntry,
  RatingDelta,
  RatingService,
} from './types';

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

const INSERT_SESSION = `INSERT INTO game_sessions (
    id, game_id, game_version, generator_version, scoring_version, seed,
    difficulty_json, raw_result_json, normalized_result, xp,
    started_at, completed_at, duration_ms
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const SELECT_SESSION_BY_ID = 'SELECT * FROM game_sessions WHERE id = ?';
const SELECT_SESSIONS_BY_GAME =
  'SELECT * FROM game_sessions WHERE game_id = ? ORDER BY completed_at DESC LIMIT ?';
const SELECT_SESSIONS_RECENT =
  'SELECT * FROM game_sessions ORDER BY completed_at DESC LIMIT ?';
const SELECT_TOTAL_XP = 'SELECT COALESCE(SUM(xp), 0) AS total FROM game_sessions';
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
const SELECT_BALANCE = 'SELECT balance FROM currency_balance';
const INSERT_LEDGER_ENTRY =
  'INSERT INTO currency_ledger (amount, reason, session_id, created_at) VALUES (?, ?, ?, ?)';
const PROFILE_INSERT_IF_ABSENT =
  'INSERT OR IGNORE INTO profile (id, display_name, settings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)';
const PROFILE_TOUCH = 'UPDATE profile SET updated_at = ? WHERE id = ?';

/** JSON columns are always stored as JSON documents, never undefined. */
function toJson(value: unknown): string {
  return JSON.stringify(value === undefined ? null : value);
}

function fromJson(raw: string, column: string, id: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Corrupt JSON in "${column}" for session ${id}`);
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
    difficulty: fromJson(row.difficulty_json, 'difficulty_json', row.id),
    rawResult: fromJson(row.raw_result_json, 'raw_result_json', row.id),
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
  async completeSession(input: CompleteSessionInput): Promise<CompleteSessionResult> {
    const s = input.session;

    // Friendly validation up front; DB CHECK constraints back this up.
    if (!s.id) {
      throw new Error('completeSession: session.id is required');
    }
    if (s.completedAt < s.startedAt) {
      throw new Error('completeSession: completedAt must be >= startedAt');
    }
    if (s.durationMs < 0) {
      throw new Error('completeSession: durationMs must be >= 0');
    }

    return this.adapter.transaction(async (txn) => {
      // When a rating service is configured, its outcome is authoritative for
      // XP/currency/ratings and must be computed before the session row exists
      // (the history rows reference the session id).
      const outcome = this.rating ? await this.rating.compute({ session: s }) : null;
      const xp = outcome ? outcome.xp : s.xp;

      await txn.run(INSERT_SESSION, [
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

      let ledgerEntry: LedgerEntry | null = null;
      if (input.currency) {
        const result = await txn.run(INSERT_LEDGER_ENTRY, [
          input.currency.amount,
          input.currency.reason,
          s.id,
          s.completedAt,
        ]);
        ledgerEntry = {
          id: result.lastInsertRowId,
          amount: input.currency.amount,
          reason: input.currency.reason,
          sessionId: s.id,
          createdAt: s.completedAt,
        };
      }
      // The rating service's gameplay award takes precedence in the returned
      // entry (both entries are still appended to the ledger).
      if (outcome && outcome.currency > 0) {
        const result = await txn.run(INSERT_LEDGER_ENTRY, [
          outcome.currency,
          'gameplay',
          s.id,
          s.completedAt,
        ]);
        ledgerEntry = {
          id: result.lastInsertRowId,
          amount: outcome.currency,
          reason: 'gameplay',
          sessionId: s.id,
          createdAt: s.completedAt,
        };
      }

      const deltas: readonly RatingDelta[] = outcome ? outcome.deltas : [];
      let appliedDeltas: readonly AppliedRatingDelta[] = [];
      if (deltas.length > 0) {
        appliedDeltas = await this.ratingRepository.applyDeltas(txn, s.id, deltas, s.completedAt);
      }

      // Profile touch: record activity so consumers can detect "last active".
      const touchAt = this.now();
      await txn.run(PROFILE_INSERT_IF_ABSENT, [LOCAL_PROFILE_ID, '', '{}', touchAt, touchAt]);
      await txn.run(PROFILE_TOUCH, [touchAt, LOCAL_PROFILE_ID]);

      const balanceRow = await txn.get<{ balance: number }>(SELECT_BALANCE);
      const balance = balanceRow?.balance ?? 0;
      const stored = { ...s, xp };

      // Build the authoritative completion outcome when a rating service is
      // configured (constitution §15). This is the single source of truth for
      // result UI; game screens should render from this rather than their own
      // no-op XP hooks.
      const completionOutcome: CompletionOutcome | null = outcome
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
        rating: outcome
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
    const rows = await this.adapter.all<SessionRow>(SELECT_SESSIONS_BY_GAME, [gameId, limit]);
    return rows.map(mapRow);
  }

  /** Most recent sessions across all games, newest first. */
  async listRecent(limit = 50): Promise<GameSessionRecord[]> {
    const rows = await this.adapter.all<SessionRow>(SELECT_SESSIONS_RECENT, [limit]);
    return rows.map(mapRow);
  }

  /** Lifetime XP across all completed sessions (constitution §17). */
  async getTotalXp(): Promise<number> {
    const row = await this.adapter.get<{ total: number }>(SELECT_TOTAL_XP);
    return row?.total ?? 0;
  }

  /**
   * Task 9.3: Get distinct activity dates for streak calculation.
   * Returns dates in YYYY-MM-DD format, most recent first.
   * Uses canonical activity query instead of arbitrary session limit.
   */
  async getDistinctActivityDates(): Promise<string[]> {
    const rows = await this.adapter.all<{ date: string }>(
      `SELECT DISTINCT DATE(completed_at / 1000, 'unixepoch') as date
       FROM game_sessions
       ORDER BY date DESC`
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
    const row = await this.adapter.get<GameAggregateRow>(SELECT_AGGREGATE_BY_GAME, [gameId]);
    return row ? mapAggregateRow(row) : null;
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
