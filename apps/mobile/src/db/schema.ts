/**
 * Versioned schema + migration definitions.
 *
 * Version tracking uses `PRAGMA user_version`; each migration runs in its own
 * transaction together with the `user_version` bump, so a failed migration
 * leaves the database untouched at the previous version. All SQL stays in the
 * common dialect shared by expo-sqlite and better-sqlite3.
 */

export const SCHEMA_VERSION = 2;

/** A single ordered schema migration. `version` must be unique and > 0. */
export interface Migration {
  version: number;
  /**
   * Apply the migration. `exec` runs one or more statements on the
   * transaction connection; no parameter binding is available (DDL only).
   */
  up: (exec: (sql: string) => Promise<void>) => Promise<void>;
}

/** SQL statement chunks shared by migrations and the runner. */
export const SQL = {
  /** Enforce foreign keys on every connection (SQLite defaults them off). */
  foreignKeysOn: 'PRAGMA foreign_keys = ON',

  /**
   * Singleton local profile (constitution §6: "One persistent local profile
   * per device"). `settings_json` is an opaque JSON object; `created_at` /
   * `updated_at` are Unix epoch milliseconds.
   */
  createProfile: `
    CREATE TABLE IF NOT EXISTS profile (
      id            TEXT    PRIMARY KEY,
      display_name  TEXT    NOT NULL DEFAULT '',
      settings_json TEXT    NOT NULL DEFAULT '{}',
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    );
  `,

  /**
   * Completed game sessions (constitution §9: "Completed sessions persist
   * atomically"). `difficulty_json` / `raw_result_json` are opaque JSON
   * payloads owned by the game; seeds and versions are integers for exact
   * replay. Timestamps are Unix epoch milliseconds.
   */
  createGameSessions: `
    CREATE TABLE IF NOT EXISTS game_sessions (
      id                 TEXT    PRIMARY KEY,
      game_id            TEXT    NOT NULL,
      game_version       INTEGER NOT NULL,
      generator_version  INTEGER NOT NULL,
      scoring_version    INTEGER NOT NULL,
      seed               INTEGER NOT NULL,
      difficulty_json    TEXT    NOT NULL,
      raw_result_json    TEXT    NOT NULL,
      normalized_result  REAL    NOT NULL,
      xp                 INTEGER NOT NULL,
      started_at         INTEGER NOT NULL,
      completed_at       INTEGER NOT NULL,
      duration_ms        INTEGER NOT NULL,
      CHECK (completed_at >= started_at),
      CHECK (duration_ms >= 0)
    );
    CREATE INDEX IF NOT EXISTS idx_game_sessions_game_id
      ON game_sessions (game_id, completed_at);
  `,

  /**
   * Append-only currency ledger (constitution §17: "Currency uses an
   * append-only transaction ledger, not only a mutable balance"). `id` uses
   * AUTOINCREMENT so ids are strictly monotonic and never reused; triggers
   * below reject UPDATE/DELETE outright.
   */
  createCurrencyLedger: `
    CREATE TABLE IF NOT EXISTS currency_ledger (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      amount     INTEGER NOT NULL,
      reason     TEXT    NOT NULL,
      session_id TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES game_sessions (id)
    );
    CREATE INDEX IF NOT EXISTS idx_currency_ledger_created_at
      ON currency_ledger (created_at);

    CREATE TRIGGER IF NOT EXISTS trg_currency_ledger_no_update
    BEFORE UPDATE ON currency_ledger
    BEGIN
      SELECT RAISE(ABORT, 'currency_ledger is append-only: UPDATE forbidden');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_currency_ledger_no_delete
    BEFORE DELETE ON currency_ledger
    BEGIN
      SELECT RAISE(ABORT, 'currency_ledger is append-only: DELETE forbidden');
    END;
  `,

  /** Balance derivation view: single aggregate over the whole ledger. */
  createCurrencyBalanceView: `
    CREATE VIEW IF NOT EXISTS currency_balance AS
      SELECT COALESCE(SUM(amount), 0) AS balance FROM currency_ledger;
  `,

  /**
   * Current rating per cognitive domain (constitution §15: separate domain
   * ratings + overall composite; §15 "Inactivity should not directly decay
   * ratings; instead reduce confidence/mark stale" — staleness is computed on
   * read from `updated_at`, never decayed here). `sessions` counts how many
   * completed sessions contributed, so consumers can weight confidence.
   */
  createDomainRatings: `
    CREATE TABLE IF NOT EXISTS domain_ratings (
      domain     TEXT    PRIMARY KEY,
      rating     INTEGER NOT NULL,
      sessions   INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
  `,

  /**
   * Append-only per-session rating movement (constitution §15: ratings move
   * gradually; history keeps the evidence chain). Every completed session
   * that moved a domain appends one row; triggers reject UPDATE/DELETE.
   */
  createRatingHistory: `
    CREATE TABLE IF NOT EXISTS rating_history (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   TEXT    NOT NULL,
      domain       TEXT    NOT NULL,
      delta        INTEGER NOT NULL,
      rating_after INTEGER NOT NULL,
      created_at   INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES game_sessions (id)
    );
    CREATE INDEX IF NOT EXISTS idx_rating_history_domain
      ON rating_history (domain, created_at);
    CREATE INDEX IF NOT EXISTS idx_rating_history_session
      ON rating_history (session_id);

    CREATE TRIGGER IF NOT EXISTS trg_rating_history_no_update
    BEFORE UPDATE ON rating_history
    BEGIN
      SELECT RAISE(ABORT, 'rating_history is append-only: UPDATE forbidden');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_rating_history_no_delete
    BEFORE DELETE ON rating_history
    BEGIN
      SELECT RAISE(ABORT, 'rating_history is append-only: DELETE forbidden');
    END;
  `,

  /** User favorites (constitution §21: support favorites in discovery). */
  createGameFavorites: `
    CREATE TABLE IF NOT EXISTS game_favorites (
      game_id    TEXT    PRIMARY KEY,
      created_at INTEGER NOT NULL
    );
  `,
};

/** Ordered migrations from version 0 to SCHEMA_VERSION. Never reorder/patch old entries. */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    up: async (exec) => {
      await exec(SQL.createProfile);
      await exec(SQL.createGameSessions);
      await exec(SQL.createCurrencyLedger);
      await exec(SQL.createCurrencyBalanceView);
    },
  },
  {
    version: 2,
    up: async (exec) => {
      await exec(SQL.createDomainRatings);
      await exec(SQL.createRatingHistory);
      await exec(SQL.createGameFavorites);
    },
  },
];
