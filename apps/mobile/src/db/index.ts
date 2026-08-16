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
import { LedgerRepository } from './ledger';
import { initializeConnection, runMigrations } from './migrate';
import { ProfileRepository } from './profile';
import { SessionRepository } from './sessions';

export type { SQLiteAdapter, SQLiteRunResult } from './adapter';
export type {
  CompleteSessionInput,
  GameSessionRecord,
  LedgerEntry,
  Profile,
  SQLiteValue,
} from './types';
export { SCHEMA_VERSION, SQL, MIGRATIONS } from './schema';
export type { Migration } from './schema';
export { runMigrations, getSchemaVersion, initializeConnection } from './migrate';
export { ProfileRepository, LOCAL_PROFILE_ID } from './profile';
export { LedgerRepository } from './ledger';
export { SessionRepository } from './sessions';
export type { CompleteSessionResult } from './sessions';
export { createExpoSqliteAdapter, openExpoDatabase } from './adapters/expo';

/** On-device database file name. */
export const APP_DATABASE_NAME = 'brain-training.db';

export interface AppDatabaseOptions {
  /** Injectable clock (Unix epoch ms), used for profile/ledger timestamps. */
  now?: () => number;
}

/** Typed facade over the three repositories, bound to one connection. */
export class AppDatabase {
  readonly profile: ProfileRepository;
  readonly sessions: SessionRepository;
  readonly ledger: LedgerRepository;

  constructor(adapter: SQLiteAdapter, options: AppDatabaseOptions = {}) {
    const now = options.now;
    this.profile = new ProfileRepository(adapter, now);
    this.sessions = new SessionRepository(adapter, now);
    this.ledger = new LedgerRepository(adapter, now);
  }
}

let instance: AppDatabase | null = null;

/**
 * Open the app database, migrate it to SCHEMA_VERSION and ensure the
 * singleton profile exists. Call once at app startup (e.g. from the root
 * route layout before rendering). Idempotent: calling twice reuses the same
 * connection (expo-sqlite caches per name) and migrations are a no-op.
 */
export async function initDatabase(): Promise<AppDatabase> {
  const adapter = createExpoSqliteAdapter(openExpoDatabase(APP_DATABASE_NAME));
  await initializeConnection(adapter);
  await runMigrations(adapter);
  const app = new AppDatabase(adapter);
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
