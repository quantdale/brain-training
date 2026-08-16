import type { SQLiteAdapter } from './adapter';
import { LOCAL_PROFILE_ID } from './profile';
import type { CompleteSessionInput, GameSessionRecord, LedgerEntry } from './types';

/**
 * Completed game sessions (constitution §9: "Completed sessions persist
 * atomically"). `completeSession` is the single write path: session row +
 * optional currency ledger entry + profile activity touch, all in one
 * transaction. A failure anywhere rolls everything back — no partial
 * session, no orphaned ledger entry.
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
const SELECT_TOTAL_XP = 'SELECT COALESCE(SUM(xp), 0) AS total FROM game_sessions';
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
}

export class SessionRepository {
  /**
   * @param now Injectable clock (Unix epoch ms) so tests are deterministic.
   */
  constructor(
    private readonly adapter: SQLiteAdapter,
    private readonly now: () => number = () => Date.now(),
  ) {}

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
        s.xp,
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

      // Profile touch: record activity so consumers can detect "last active".
      const touchAt = this.now();
      await txn.run(PROFILE_INSERT_IF_ABSENT, [LOCAL_PROFILE_ID, '', '{}', touchAt, touchAt]);
      await txn.run(PROFILE_TOUCH, [touchAt, LOCAL_PROFILE_ID]);

      const balanceRow = await txn.get<{ balance: number }>(SELECT_BALANCE);
      return { session: { ...s }, ledgerEntry, balance: balanceRow?.balance ?? 0 };
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

  /** Lifetime XP across all completed sessions (constitution §17). */
  async getTotalXp(): Promise<number> {
    const row = await this.adapter.get<{ total: number }>(SELECT_TOTAL_XP);
    return row?.total ?? 0;
  }
}
