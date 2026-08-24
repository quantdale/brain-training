/**
 * Versioned schema + migration definitions.
 *
 * Version tracking uses `PRAGMA user_version`; each migration runs in its own
 * transaction together with the `user_version` bump, so a failed migration
 * leaves the database untouched at the previous version. All SQL stays in the
 * common dialect shared by expo-sqlite and better-sqlite3.
 */

import type { SQLiteAdapter } from "./adapter";

export const SCHEMA_VERSION = 10;

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
  foreignKeysOn: "PRAGMA foreign_keys = ON",

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

  /**
   * Persistent daily workout instance (constitution §14; 006R task 6.1). One
   * row per local calendar date. `game_ids_json` is the ordered four-game
   * selection; `current_index` is the next game to play (resume point);
   * `status` is 'active' until the fourth game is durably completed;
   * `reroll_attempt` counts rerolls applied today (0 = base, persisted for
   * 006R task 6.5); `seed_version` records the selector/profile version for
   * provenance. Existing completed positions are immutable across rerolls
   * (006R task 6.6).
   */
  createWorkoutInstances: `
    CREATE TABLE IF NOT EXISTS workout_instances (
      date           TEXT    PRIMARY KEY,
      game_ids_json  TEXT    NOT NULL,
      status         TEXT    NOT NULL DEFAULT 'active',
      current_index  INTEGER NOT NULL DEFAULT 0,
      reroll_attempt INTEGER NOT NULL DEFAULT 0,
      seed_version   INTEGER NOT NULL DEFAULT 0,
      created_at     INTEGER NOT NULL,
      updated_at     INTEGER NOT NULL
    );
  `,

  /**
   * Performance index for the most common read paths (task G): recent-session
   * lists, per-game history, aggregate `lastCompletedAt`, and the distinct
   * activity-date scan used by streak calculation. All order by / filter on
   * `completed_at`, which had no dedicated index before v8.
   */
  createGameSessionsCompletedAtIndex: `
    CREATE INDEX IF NOT EXISTS idx_game_sessions_completed_at
      ON game_sessions (completed_at);
  `,

  /**
   * Campaign 010 (W11) — SCHEMA CHANGE v9, documented per the worker packet's
   * granted exception. Append-only and collision-safe (`IF NOT EXISTS`); no
   * table, column, or row is touched, so existing installs migrate forward
   * with zero data impact and backups stay compatible (backup `schemaVersion`
   * is informational only).
   *
   * Why: the new windowed rating-history read (`RatingRepository
   * .getHistoryWindowed`) orders by `created_at` when no domain filter is
   * present. Before this index that ordering was a full scan + sort of the
   * append-only history — the same gap v8 closed for `game_sessions
   * .completed_at`. Domain-scoped windowed reads were already covered by
   * `idx_rating_history_domain (domain, created_at)`.
   */
  createRatingHistoryCreatedAtIndex: `
    CREATE INDEX IF NOT EXISTS idx_rating_history_created_at
      ON rating_history (created_at);
  `,

  /**
   * Campaign 012/013 — SCHEMA CHANGE v10. Optional Workout V2 metadata
   * (versioned JSON: kind/templateId/length/focus + generation inputs +
   * recorded selection reasons). Additive and nullable; readers/writers
   * already tolerate its absence (legacy installs pre-v10 keep working).
   */
  addWorkoutMetadataColumn: `
    ALTER TABLE workout_instances ADD COLUMN metadata_json TEXT;
  `,

  /**
   * Backfill a stable idempotency key onto legacy gameplay currency rows that
   * predate v8 (task A/idempotency). Newer rows already carry
   * `gameplay:<sessionId>` from `completeSession`. Two guards keep the
   * backfill conflict-free with the partial unique index on `operation_id`, so
   * the migration can never fail on historical data:
   *
   * 1. `NOT EXISTS` skips any row whose derived key is already committed.
   * 2. Only the EARLIEST legacy row per session is keyed. If historical data
   *    contains several `gameplay` rows for one session (e.g. a merge of two
   *    pre-v6 exports), keying them all would collide on the unique index and
   *    abort this migration — bricking startup for that database. The extra
   *    duplicate rows stay NULL: they remain visible as historical evidence of
   *    the double award instead of blocking the upgrade.
   */
  backfillGameplayOperationIds: `
    UPDATE currency_ledger
    SET operation_id = 'gameplay:' || session_id
    WHERE session_id IS NOT NULL
      AND operation_id IS NULL
      AND reason = 'gameplay'
      AND id = (
        SELECT MIN(first.id) FROM currency_ledger AS first
        WHERE first.session_id = currency_ledger.session_id
          AND first.reason = 'gameplay'
          AND first.operation_id IS NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM currency_ledger AS other
        WHERE other.operation_id = 'gameplay:' || currency_ledger.session_id
      );
  `,

  /**
   * Recreates the currency-ledger append-only UPDATE guard. Must mirror the
   * definition embedded in `createCurrencyLedger` (v1) exactly. Migration v8
   * needs it because that very trigger rejects the backfill UPDATE below —
   * the drop/backfill/recreate trio runs inside one transaction, so the
   * protection is never absent from a committed state.
   */
  createCurrencyLedgerNoUpdateTrigger: `
    CREATE TRIGGER IF NOT EXISTS trg_currency_ledger_no_update
    BEFORE UPDATE ON currency_ledger
    BEGIN
      SELECT RAISE(ABORT, 'currency_ledger is append-only: UPDATE forbidden');
    END;
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
      const cols = await txn.all<{ name: string }>(
        "PRAGMA table_info(currency_ledger)",
      );
      if (!cols.some((c) => c.name === "operation_id")) {
        await txn.exec(
          "ALTER TABLE currency_ledger ADD COLUMN operation_id TEXT",
        );
      }
      await txn.exec(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_currency_ledger_operation_id " +
          "ON currency_ledger (operation_id) WHERE operation_id IS NOT NULL",
      );
    },
  },
  {
    version: 7,
    up: async (txn) => {
      await txn.exec(SQL.createWorkoutInstances);
    },
  },
  {
    version: 8,
    up: async (txn) => {
      // Index for scale (recent lists / aggregates / activity-date scan).
      await txn.exec(SQL.createGameSessionsCompletedAtIndex);
      // Backfill idempotency keys on legacy gameplay currency rows. The
      // append-only guard trigger rejects UPDATE outright, so it is dropped
      // and recreated around the backfill — all inside this transaction, so
      // a failure rolls the drop back too and the trigger never disappears
      // from a committed database.
      await txn.exec("DROP TRIGGER IF EXISTS trg_currency_ledger_no_update");
      await txn.exec(SQL.backfillGameplayOperationIds);
      await txn.exec(SQL.createCurrencyLedgerNoUpdateTrigger);
    },
  },
  {
    version: 9,
    up: async (txn) => {
      // Index for the windowed rating-history read (campaign 010 W11). See
      // SQL.createRatingHistoryCreatedAtIndex for rationale; append-only,
      // collision-safe, no data change.
      await txn.exec(SQL.createRatingHistoryCreatedAtIndex);
    },
  },
  {
    version: 10,
    up: async (txn) => {
      // Campaign 012 closeout / 013 hardening — SCHEMA CHANGE v10: persist
      // Workout Engine V2 instance metadata (template id, length, focus,
      // generation inputs, recorded personalization REASONS). Additive NULL
      // column only — no row is rewritten and legacy rows read back with
      // metadata undefined exactly as before. The repository has always
      // written this column opportunistically when present (runtime PRAGMA
      // probe); shipping it in the schema makes that path real instead of
      // permanently dormant.
      //
      // Column-existence guard: ALTER TABLE ADD COLUMN is not idempotent, so
      // a database whose user_version was rolled back below 10 while the
      // column already exists (header corruption / botched downgrade) must
      // not brick startup on a duplicate-column error.
      const columns = await txn.all<{ name: string }>(
        "PRAGMA table_info(workout_instances)",
      );
      if (!columns.some((column) => column.name === "metadata_json")) {
        await txn.exec(SQL.addWorkoutMetadataColumn);
      }
    },
  },
];
