/**
 * Public entry point for the persistence layer.
 *
 * App startup must call `initDatabase()` exactly once (orchestrator wires
 * this into the app entry / root layout), then every consumer uses `getDb()`.
 * All persistence code lives under src/db; games and the Game SDK interact
 * only through this facade's typed repositories.
 */
import type { SQLiteAdapter } from './adapter';
import { AchievementRepository } from './achievements';
import { createExpoSqliteAdapter, openExpoDatabase } from './adapters/expo';
import { FavoritesRepository } from './favorites';
import { LedgerRepository } from './ledger';
import { ensureSchemaGuards, initializeConnection, runMigrations } from './migrate';
import { ProfileRepository } from './profile';
import { QuestRepository } from './quests';
import { RatingRepository } from './rating';
import { SessionRepository } from './sessions';
import { TutorialRepository } from './tutorial';
import type { RatingService } from './types';
import { WorkoutRepository, deleteEmptyWorkoutInstances } from './workout';
import { XpAwardsRepository } from './xp-awards';

export type { SQLiteAdapter, SQLiteRunResult } from './adapter';
export type {
  AppliedRatingDelta,
  CompleteSessionInput,
  CompletionOutcome,
  GameSessionRecord,
  LedgerEntry,
  Profile,
  RatingDelta,
  RatingOutcome,
  RatingService,
  SQLiteValue,
} from './types';
export type { WorkoutSessionProvenance } from '@/workout/session-provenance';
export { SCHEMA_VERSION, SQL, MIGRATIONS } from './schema';
export type { Migration } from './schema';
export { runMigrations, getSchemaVersion, initializeConnection, ensureSchemaGuards } from './migrate';
export { ProfileRepository, LOCAL_PROFILE_ID } from './profile';
export { LedgerRepository } from './ledger';
export { RatingRepository, INITIAL_RATING, MIN_RATING, isRatingStale } from './rating';
export type { DomainRating, RatingHistoryEntry } from './rating';
export { FavoritesRepository } from './favorites';
export { QuestRepository } from './quests';
export type {
  QuestDefinition,
  QuestKind,
  QuestProgress,
  QuestProgressUpdate,
} from './quests';
export { AchievementRepository } from './achievements';
export type { AchievementDefinition, AchievementUnlock } from './achievements';
export { XpAwardsRepository } from './xp-awards';
export type { XpAward } from './xp-awards';
export { SessionRepository } from './sessions';
export { TutorialRepository } from './tutorial';
export type { CompleteSessionResult, GameAggregate } from './sessions';
export { WorkoutRepository, WorkoutWriteConflictError, deleteEmptyWorkoutInstances } from './workout';
export type { RerollBaseline, WorkoutAdvanceResult, WorkoutInstance, WorkoutStatus } from './workout';
export { createExpoSqliteAdapter, openExpoDatabase } from './adapters/expo';
export {
  spendCurrency,
  purchaseStreakItem,
  paidReroll,
  InsufficientFundsError,
  InvalidCurrencyAmountError,
} from './economy';
export type { SpendInput, PurchaseStreakItemInput, PaidRerollInput } from './economy';

// --- Campaign 010 W11: repository API maturation (additive) -----------------
// Pure query-building helpers and the safe batch primitive. Free functions
// over any SQLiteAdapter — the adapter interface itself is unchanged.
export {
  SQL_VARIABLE_CHUNK,
  DEFAULT_READ_LIMIT,
  MAX_READ_LIMIT,
  chunk,
  buildInPlaceholders,
  clampLimit,
  normalizeOffset,
  joinAnd,
  requireFiniteNumber,
} from './query';
export { executeBatch } from './batch';
export type { BatchStatement, BatchOutcome } from './batch';
export type {
  SessionSummary,
  SessionFilterQuery,
  SessionSummaryQuery,
  SessionDayBoundary,
  SessionDayCountQuery,
  SessionCursor,
  SessionPage,
  WindowedSessionAggregate,
  DailySessionCount,
} from './sessions';
export { isValidSessionCursor } from './sessions';
export type { RatingHistoryQuery } from './rating';
export type { FavoriteEntry } from './favorites';

// --- Campaign 010 W22: Progress read-projection primitive (additive) --------
// Row shape of `SessionRepository.listProgressProjection` /
// `listProgressProjectionByGame` (scalar columns + blob-derived metric
// scalars extracted in SQLite; consumed by `analytics/projections.ts`).
export type { SessionProgressRow } from './sessions';

/** On-device database file name. */
export const APP_DATABASE_NAME = 'brain-training.db';

export interface AppDatabaseOptions {
  /** Injectable clock (Unix epoch ms), used for profile/ledger timestamps. */
  now?: () => number;
  /** Rating service applied by `completeSession` (see `RatingService`). */
  rating?: RatingService;
  /**
   * Injectable adapter opener (059). Defaults to the Expo native database;
   * tests inject a disposable adapter to prove failed passes close up.
   */
  createAdapter?: () => SQLiteAdapter;
}

/** Typed facade over the seven repositories, bound to one connection. */
export class AppDatabase {
  private readonly adapter: SQLiteAdapter;
  readonly profile: ProfileRepository;
  readonly sessions: SessionRepository;
  readonly ledger: LedgerRepository;
  readonly ratings: RatingRepository;
  readonly favorites: FavoritesRepository;
  readonly quests: QuestRepository;
  readonly achievements: AchievementRepository;
  readonly xpAwards: XpAwardsRepository;
  readonly workouts: WorkoutRepository;
  readonly tutorials: TutorialRepository;

  constructor(adapter: SQLiteAdapter, options: AppDatabaseOptions = {}) {
    const now = options.now;
    this.adapter = adapter;
    this.profile = new ProfileRepository(adapter, now);
    this.sessions = new SessionRepository(adapter, now, options.rating);
    this.ledger = new LedgerRepository(adapter, now);
    this.ratings = new RatingRepository(adapter, now);
    this.favorites = new FavoritesRepository(adapter, now);
    this.quests = new QuestRepository(adapter, now);
    this.achievements = new AchievementRepository(adapter, now);
    this.xpAwards = new XpAwardsRepository(adapter, now);
    this.workouts = new WorkoutRepository(adapter, now);
    this.tutorials = new TutorialRepository(adapter, now);
  }

  /**
   * Run `fn` inside a single write transaction (task 7.1–7.4). `fn` receives the
   * transaction connection, which every economy/claim repository call must use
   * so all steps commit together or roll back as one. The adapter forbids
   * nesting, so callers must pass `txn` into repositories rather than opening a
   * nested transaction.
   */
  transaction<T>(fn: (txn: SQLiteAdapter) => Promise<T>): Promise<T> {
    return this.adapter.transaction(fn);
  }

  /**
   * Run a single statement directly on the underlying connection, OUTSIDE any
   * transaction. Used by the data-portability reset/restore path to toggle
   * connection-level schema operations that are intentionally unsafe or
   * ineffective when attempted *inside* a transaction. The data-portability
   * replace path uses this seam to drop append-only DELETE triggers before its
   * wipe transaction and recreates the exact captured definitions afterward.
   * Added as an isolated, intentional core-DB API convenience.
   */
  rawExec(sql: string): Promise<void> {
    return this.adapter.exec(sql);
  }
}

let instance: AppDatabase | null = null;
let instanceAdapter: SQLiteAdapter | null = null;
let initializationPromise: Promise<AppDatabase> | null = null;

/**
 * Open the app database, migrate it to SCHEMA_VERSION and ensure the
 * singleton profile exists. Call once at app startup (e.g. from the root
 * route layout before rendering).
 *
 * Idempotent (065): once a pass has succeeded the live singleton is returned
 * untouched. Concurrent startup calls share one in-flight pass so React
 * runtime remounts cannot initialize the same native file concurrently, and a
 * retry after a later bootstrap stage failed must never open a SECOND native
 * connection — the first one is still open and owned by `instance`, so
 * re-opening would leak it and split the write queue across two handles for
 * the same file.
 */
export async function initDatabase(options: AppDatabaseOptions = {}): Promise<AppDatabase> {
  if (instance) {
    return instance;
  }

  if (!initializationPromise) {
    initializationPromise = initializeDatabase(options).catch((error: unknown) => {
      // Only a rejected pass is retryable: clear the in-flight promise so the
      // next call opens a fresh adapter (the failed one is closed inside
      // `initializeDatabase`). A fulfilled promise stays cached behind the
      // `instance` guard above instead of being cleared.
      initializationPromise = null;
      throw error;
    });
  }
  return initializationPromise;
}

/** Perform one startup pass; concurrent callers are coalesced by initDatabase. */
async function initializeDatabase(options: AppDatabaseOptions): Promise<AppDatabase> {
  const createAdapter =
    options.createAdapter ??
    (() => createExpoSqliteAdapter(openExpoDatabase(APP_DATABASE_NAME)));
  const adapter = createAdapter();
  try {
    await initializeConnection(adapter);
    await runMigrations(adapter);
    // Self-heal any schema guard lost to a crash during a previous
    // replace-import/wipe (drop-then-recreate window). No-op on healthy DBs.
    await ensureSchemaGuards(adapter);
    // Purge definitionally-corrupt empty workout rows (any status) so
    // `countCompleted` can never include them (059; closes the 056-F8
    // residual). No-op on healthy DBs; healthy rows are never touched.
    await deleteEmptyWorkoutInstances(adapter);
    const app = new AppDatabase(adapter, options);
    await app.profile.ensureExists(); // create-on-first-launch
    instance = app;
    instanceAdapter = adapter;
    return app;
  } catch (error) {
    // A failed pass must not leak its native connection: bootstrap retry
    // would otherwise stack connections against the same file (059).
    // Best-effort — a half-opened handle may already be unusable.
    await adapter.close().catch(() => {});
    throw error;
  }
}

/**
 * Test-only reset: closes the singleton connection and clears module state so
 * a suite can build a fresh database per test (the Node in-memory backend is
 * discarded per test). Never call from product code; `initDatabase` is
 * idempotent by design for the app runtime.
 */
export async function resetDatabaseForTests(): Promise<void> {
  const adapter = instanceAdapter;
  instance = null;
  instanceAdapter = null;
  initializationPromise = null;
  if (adapter) {
    await adapter.close().catch(() => {});
  }
}

/** Access the initialized database; throws when initDatabase() was not run. */
export function getDb(): AppDatabase {
  if (!instance) {
    throw new Error('Database not initialized — call initDatabase() once at app startup');
  }
  return instance;
}
