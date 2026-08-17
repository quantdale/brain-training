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
import { initializeConnection, runMigrations } from './migrate';
import { ProfileRepository } from './profile';
import { QuestRepository } from './quests';
import { RatingRepository } from './rating';
import { SessionRepository } from './sessions';
import { TutorialRepository } from './tutorial';
import type { RatingService } from './types';
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
export { SCHEMA_VERSION, SQL, MIGRATIONS } from './schema';
export type { Migration } from './schema';
export { runMigrations, getSchemaVersion, initializeConnection } from './migrate';
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
export { createExpoSqliteAdapter, openExpoDatabase } from './adapters/expo';

/** On-device database file name. */
export const APP_DATABASE_NAME = 'brain-training.db';

export interface AppDatabaseOptions {
  /** Injectable clock (Unix epoch ms), used for profile/ledger timestamps. */
  now?: () => number;
  /** Rating service applied by `completeSession` (see `RatingService`). */
  rating?: RatingService;
}

/** Typed facade over the seven repositories, bound to one connection. */
export class AppDatabase {
  readonly profile: ProfileRepository;
  readonly sessions: SessionRepository;
  readonly ledger: LedgerRepository;
  readonly ratings: RatingRepository;
  readonly favorites: FavoritesRepository;
  readonly quests: QuestRepository;
  readonly achievements: AchievementRepository;
  readonly xpAwards: XpAwardsRepository;
  readonly tutorials: TutorialRepository;

  constructor(adapter: SQLiteAdapter, options: AppDatabaseOptions = {}) {
    const now = options.now;
    this.profile = new ProfileRepository(adapter, now);
    this.sessions = new SessionRepository(adapter, now, options.rating);
    this.ledger = new LedgerRepository(adapter, now);
    this.ratings = new RatingRepository(adapter, now);
    this.favorites = new FavoritesRepository(adapter, now);
    this.quests = new QuestRepository(adapter, now);
    this.achievements = new AchievementRepository(adapter, now);
    this.xpAwards = new XpAwardsRepository(adapter, now);
    this.tutorials = new TutorialRepository(adapter, now);
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
