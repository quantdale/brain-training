/**
 * Versioned schema + migration definitions.
 *
 * Version tracking uses `PRAGMA user_version`; each migration runs in its own
 * transaction together with the `user_version` bump, so a failed migration
 * leaves the database untouched at the previous version. All SQL stays in the
 * common dialect shared by expo-sqlite and better-sqlite3.
 */

import type { SQLiteAdapter } from './adapter';

export const SCHEMA_VERSION = 6;

/** A single ordered schema migration. `version` must be unique and > 0. */
export interface Migration {
  version: number;
  /**
   * Apply the migration. `txn` is the transaction connection: it exposes
   * `exec` for DDL plus `get`/`all`/`run` so a migration can inspect schema
   * state (e.g. add a column only when it is missing) and stay replay-safe.
   */
  up: (txn: SQLiteAdapter) => Promise<void>;
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

  /**
   * XP earned outside sessions (constitution §17: one global level driven by
   * XP; quests/achievements award XP). Append-only like the currency ledger —
   * rewards are never mutated or deleted once granted.
   */
  createXpAwards: `
    CREATE TABLE IF NOT EXISTS xp_awards (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      amount     INTEGER NOT NULL CHECK (amount > 0),
      reason     TEXT    NOT NULL,
      source     TEXT    NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_xp_awards_created_at
      ON xp_awards (created_at);

    CREATE TRIGGER IF NOT EXISTS trg_xp_awards_no_update
    BEFORE UPDATE ON xp_awards
    BEGIN
      SELECT RAISE(ABORT, 'xp_awards is append-only: UPDATE forbidden');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_xp_awards_no_delete
    BEFORE DELETE ON xp_awards
    BEGIN
      SELECT RAISE(ABORT, 'xp_awards is append-only: DELETE forbidden');
    END;
  `,

  /**
   * Quest definitions (constitution §18: daily/weekly quests). Seeded by the
   * app from a versioned definition module (`src/quests/definitions.ts`);
   * `criteria_json` is an opaque versioned criteria document owned by the
   * quest engine.
   */
  createQuests: `
    CREATE TABLE IF NOT EXISTS quests (
      id              TEXT    PRIMARY KEY,
      kind            TEXT    NOT NULL CHECK (kind IN ('daily', 'weekly', 'longterm')),
      title           TEXT    NOT NULL,
      description     TEXT    NOT NULL,
      criteria_json   TEXT    NOT NULL,
      reward_xp       INTEGER NOT NULL CHECK (reward_xp >= 0),
      reward_currency INTEGER NOT NULL CHECK (reward_currency >= 0),
      version         INTEGER NOT NULL
    );
  `,

  /**
   * Quest progress per period (daily -> local date, weekly -> ISO week key).
   * `progress` is the raw criteria count (0..target); `completed_at` is set
   * when the target is reached; `claimed_at` marks the reward as claimed.
   */
  createQuestProgress: `
    CREATE TABLE IF NOT EXISTS quest_progress (
      quest_id     TEXT    NOT NULL,
      period       TEXT    NOT NULL,
      progress     REAL    NOT NULL DEFAULT 0,
      completed_at INTEGER,
      claimed_at   INTEGER,
      PRIMARY KEY (quest_id, period),
      FOREIGN KEY (quest_id) REFERENCES quests (id)
    );
  `,

  /** Long-term achievement definitions (constitution §18). */
  createAchievements: `
    CREATE TABLE IF NOT EXISTS achievements (
      id              TEXT    PRIMARY KEY,
      title           TEXT    NOT NULL,
      description     TEXT    NOT NULL,
      criteria_json   TEXT    NOT NULL,
      reward_xp       INTEGER NOT NULL CHECK (reward_xp >= 0),
      reward_currency INTEGER NOT NULL CHECK (reward_currency >= 0),
      version         INTEGER NOT NULL
    );
  `,

  /** Unlocked achievements (once per achievement; claimed_at marks reward). */
  createAchievementUnlocks: `
    CREATE TABLE IF NOT EXISTS achievement_unlocks (
      achievement_id TEXT    PRIMARY KEY,
      unlocked_at    INTEGER NOT NULL,
      claimed_at     INTEGER,
      FOREIGN KEY (achievement_id) REFERENCES achievements (id)
    );
  `,

  /** Tutorial completion state keyed by game ID. */
  createTutorialState: `
    CREATE TABLE IF NOT EXISTS tutorial_state (
      game_id        TEXT    PRIMARY KEY,
      completed      INTEGER NOT NULL DEFAULT 0,
      replay_requested INTEGER NOT NULL DEFAULT 0,
      version        TEXT,
      updated_at     INTEGER NOT NULL
    );
  `,

  /** CHECK constraints for data integrity (task 8.1). */
  addCheckConstraints: `
    -- Ensure normalized_result is in [0, 1]
    CREATE TRIGGER IF NOT EXISTS trg_game_sessions_normalized_check
    BEFORE INSERT ON game_sessions
    BEGIN
      SELECT CASE
        WHEN NEW.normalized_result < 0 OR NEW.normalized_result > 1 THEN
          RAISE(ABORT, 'normalized_result must be in [0, 1]')
      END;
    END;

    -- Ensure xp is nonnegative
    CREATE TRIGGER IF NOT EXISTS trg_game_sessions_xp_check
    BEFORE INSERT ON game_sessions
    BEGIN
      SELECT CASE
        WHEN NEW.xp < 0 THEN
          RAISE(ABORT, 'xp must be nonnegative')
      END;
    END;

    -- Ensure rating is nonnegative
    CREATE TRIGGER IF NOT EXISTS trg_domain_ratings_rating_check
    BEFORE INSERT ON domain_ratings
    BEGIN
      SELECT CASE
        WHEN NEW.rating < 0 THEN
          RAISE(ABORT, 'rating must be nonnegative')
      END;
    END;

    CREATE TRIGGER IF NOT EXISTS trg_domain_ratings_rating_update_check
    BEFORE UPDATE ON domain_ratings
    BEGIN
      SELECT CASE
        WHEN NEW.rating < 0 THEN
          RAISE(ABORT, 'rating must be nonnegative')
      END;
    END;
  `,
};

/** Ordered migrations from version 0 to SCHEMA_VERSION. Never reorder/patch old entries. */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    up: async (txn) => {
      await txn.exec(SQL.createProfile);
      await txn.exec(SQL.createGameSessions);
      await txn.exec(SQL.createCurrencyLedger);
      await txn.exec(SQL.createCurrencyBalanceView);
    },
  },
  {
    version: 2,
    up: async (txn) => {
      await txn.exec(SQL.createDomainRatings);
      await txn.exec(SQL.createRatingHistory);
      await txn.exec(SQL.createGameFavorites);
    },
  },
  {
    version: 3,
    up: async (txn) => {
      await txn.exec(SQL.createXpAwards);
      await txn.exec(SQL.createQuests);
      await txn.exec(SQL.createQuestProgress);
      await txn.exec(SQL.createAchievements);
      await txn.exec(SQL.createAchievementUnlocks);
    },
  },
  {
    version: 4,
    up: async (txn) => {
      await txn.exec(SQL.createTutorialState);
    },
  },
  {
    version: 5,
    up: async (txn) => {
      await txn.exec(SQL.addCheckConstraints);
    },
  },
  {
    version: 6,
    up: async (txn) => {
      // `ALTER TABLE ... ADD COLUMN` is not idempotent in SQLite, so guard it
      // against a column that already exists (e.g. a database replayed after a
      // downgrade, or migrations re-run after a partial apply). The unique
      // index is already guarded with IF NOT EXISTS.
      const cols = await txn.all<{ name: string }>('PRAGMA table_info(currency_ledger)');
      if (!cols.some((c) => c.name === 'operation_id')) {
        await txn.exec('ALTER TABLE currency_ledger ADD COLUMN operation_id TEXT');
      }
      await txn.exec(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_currency_ledger_operation_id ' +
          'ON currency_ledger (operation_id) WHERE operation_id IS NOT NULL',
      );
    },
  },
];
