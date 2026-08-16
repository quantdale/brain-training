/**
 * Public entry point for the persistence layer.
 *
 * App startup must call `initDatabase()` exactly once (orchestrator wires
 * this into the app entry / root layout), then every consumer uses `getDb()`.
 * All persistence code lives under src/db; games and the Game SDK interact
 * only through this facade's typed repositories.
 */
import type { SQLiteAdapter } from './adapter';
import { createExpoSqliteAdapter, openExpoDatabase } from './adapters/expo';
import { FavoritesRepository } from './favorites';
import { LedgerRepository } from './ledger';
import { initializeConnection, runMigrations } from './migrate';
import { ProfileRepository } from './profile';
import { RatingRepository } from './rating';
import { SessionRepository } from './sessions';
import type { RatingService } from './types';

export type { SQLiteAdapter, SQLiteRunResult } from './adapter';
export type {
  CompleteSessionInput,
  GameSessionRecord,
  LedgerEntry,
  Profile,
  RatingDelta,
  RatingOutcome,
  RatingService,
  SQLiteValue,
} from './types';
export type { GameAggregate } from './sessions';
export { SCHEMA_VERSION, SQL, MIGRATIONS } from './schema';
export type { Migration } from './schema';
export { runMigrations, getSchemaVersion, initializeConnection } from './migrate';
export { ProfileRepository, LOCAL_PROFILE_ID } from './profile';
export { LedgerRepository } from './ledger';
export { RatingRepository, INITIAL_RATING, MIN_RATING, isRatingStale } from './rating';
export type { DomainRating, RatingHistoryEntry } from './rating';
export { FavoritesRepository } from './favorites';
export { SessionRepository } from './sessions';
export type { CompleteSessionResult } from './sessions';
export { createExpoSqliteAdapter, openExpoDatabase } from './adapters/expo';

/** On-device database file name. */
export const APP_DATABASE_NAME = 'brain-training.db';

export interface AppDatabaseOptions {
  /** Injectable clock (Unix epoch ms), used for profile/ledger timestamps. */
  now?: () => number;
  /** Rating service applied by `completeSession` (see `RatingService`). */
  rating?: RatingService;
}

/** Typed facade over the four repositories, bound to one connection. */
export class AppDatabase {
  readonly profile: ProfileRepository;
  readonly sessions: SessionRepository;
  readonly ledger: LedgerRepository;
  readonly ratings: RatingRepository;
  readonly favorites: FavoritesRepository;

  constructor(adapter: SQLiteAdapter, options: AppDatabaseOptions = {}) {
    const now = options.now;
    this.profile = new ProfileRepository(adapter, now);
    this.sessions = new SessionRepository(adapter, now, options.rating);
    this.ledger = new LedgerRepository(adapter, now);
    this.ratings = new RatingRepository(adapter, now);
    this.favorites = new FavoritesRepository(adapter, now);
  }
}

let instance: AppDatabase | null = null;

/**
 * Open the app database, migrate it to SCHEMA_VERSION and ensure the
 * singleton profile exists. Call once at app startup (e.g. from the root
 * route layout before rendering). Idempotent: calling twice reuses the same
 * connection (expo-sqlite caches per name) and migrations are a no-op.
 */
export async function initDatabase(options: AppDatabaseOptions = {}): Promise<AppDatabase> {
  const adapter = createExpoSqliteAdapter(openExpoDatabase(APP_DATABASE_NAME));
  await initializeConnection(adapter);
  await runMigrations(adapter);
  const app = new AppDatabase(adapter, options);
  await app.profile.ensureExists(); // create-on-first-launch
  instance = app;
  return app;
}

/** Access the initialized database; throws when initDatabase() was not run. */
export function getDb(): AppDatabase {
  if (!instance) {
    throw new Error('Database not initialized — call initDatabase() once at app startup');
  }
  return instance;
}
