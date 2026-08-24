import { AppDatabase, SCHEMA_VERSION } from '@/db';
import { createMigratedDb } from '../../db/__tests__/helpers';
import type { SQLiteAdapter } from '@/db';

import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  computeChecksum,
  canonicalString,
  type BackupData,
  type BackupEnvelope,
} from '../index';

export const T0 = 1_700_000_000_000;

/** Build a node-backed AppDatabase (migrated, profile ensured) for tests. */
export async function makeDb(now: () => number = () => T0): Promise<AppDatabase> {
  const adapter = await createMigratedDb();
  const db = new AppDatabase(adapter, { now });
  await db.profile.ensureExists();
  return db;
}

export interface SeedOptions {
  now?: () => number;
}

/**
 * Seed a full, realistic fixture covering every backup section. Timestamps are
 * explicit so tests can assert exact round-trips. Uses raw inserts for total
 * control over ids/values.
 */
export async function seedFixture(db: AppDatabase, opts: SeedOptions = {}): Promise<void> {
  const now = opts.now ?? (() => T0);
  await db.transaction(async (txn) => {
    await txn.run(
      "INSERT OR REPLACE INTO profile (id, display_name, settings_json, created_at, updated_at) VALUES ('local', 'Tester', ?, ?, ?)",
      [JSON.stringify({ theme: 'dark', streaks: { freeze: 2, shield: 1, recovery: 0 } }), T0, T0 + 1000],
    );

    await txn.run(
      `INSERT INTO game_sessions (id, game_id, game_version, generator_version, scoring_version, seed, difficulty_json, raw_result_json, normalized_result, xp, started_at, completed_at, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['s1', 'memory', 1, 1, 1, 42, JSON.stringify({ level: 'easy' }), JSON.stringify({ correct: 5 }), 0.9, 50, T0, T0 + 100, 1000],
    );
    await txn.run(
      `INSERT INTO game_sessions (id, game_id, game_version, generator_version, scoring_version, seed, difficulty_json, raw_result_json, normalized_result, xp, started_at, completed_at, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['s2', 'memory', 1, 1, 1, 43, JSON.stringify({ level: 'normal' }), JSON.stringify({ correct: 4 }), 0.8, 50, T0 + 200, T0 + 400, 1000],
    );

    await txn.run(
      'INSERT INTO domain_ratings (domain, rating, sessions, updated_at) VALUES (?, ?, ?, ?)',
      ['Memory', 1050, 2, T0],
    );

    await txn.run(
      'INSERT INTO rating_history (session_id, domain, delta, rating_after, created_at) VALUES (?, ?, ?, ?, ?)',
      ['s1', 'Memory', 25, 1025, T0],
    );
    await txn.run(
      'INSERT INTO rating_history (session_id, domain, delta, rating_after, created_at) VALUES (?, ?, ?, ?, ?)',
      ['s2', 'Memory', 25, 1050, T0 + 500],
    );

    await txn.run(
      'INSERT INTO currency_ledger (amount, reason, session_id, created_at, operation_id) VALUES (?, ?, ?, ?, ?)',
      [10, 'gameplay', 's1', T0, 'op-1'],
    );
    await txn.run(
      'INSERT INTO currency_ledger (amount, reason, session_id, created_at, operation_id) VALUES (?, ?, ?, ?, ?)',
      [5, 'quest', null, T0 + 200, null],
    );

    await txn.run('INSERT INTO game_favorites (game_id, created_at) VALUES (?, ?)', ['memory', T0]);

    await txn.run(
      'INSERT INTO xp_awards (amount, reason, source, created_at) VALUES (?, ?, ?, ?)',
      [20, 'quest reward', 'quest:q1', T0 + 300],
    );

    await txn.run(
      "INSERT INTO tutorial_state (game_id, completed, replay_requested, version, updated_at) VALUES (?, ?, ?, ?, ?)",
      ['memory', 1, 0, '1.0.0', T0],
    );

    await txn.run(
      "INSERT INTO workout_instances (date, game_ids_json, status, current_index, reroll_attempt, seed_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ['2026-08-20', JSON.stringify(['memory', 'speed-tap-rush']), 'active', 1, 0, 1, T0, T0],
    );

    await txn.run(
      "INSERT INTO quests (id, kind, title, description, criteria_json, reward_xp, reward_currency, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ['q1', 'daily', 'Q1', 'desc', JSON.stringify({ target: 3 }), 20, 5, 1],
    );
    await txn.run(
      'INSERT INTO quest_progress (quest_id, period, progress, completed_at, claimed_at) VALUES (?, ?, ?, ?, ?)',
      ['q1', '2026-08-20', 3, T0, null],
    );

    await txn.run(
      "INSERT INTO achievements (id, title, description, criteria_json, reward_xp, reward_currency, version) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['a1', 'A1', 'desc', JSON.stringify({ target: 1 }), 50, 25, 1],
    );
    await txn.run(
      'INSERT INTO achievement_unlocks (achievement_id, unlocked_at, claimed_at) VALUES (?, ?, ?)',
      ['a1', T0, null],
    );
  });
}

export { SCHEMA_VERSION };
export type { SQLiteAdapter };

/**
 * Build a fully-checksummed envelope from raw `data` (shared by the
 * adversarial + hardening suites so crafted-backup tests stay consistent).
 */
export function buildEnvelope(
  data: BackupData | Record<string, unknown>,
  opts: { version?: number; schemaVersion?: number; createdAt?: number } = {},
): BackupEnvelope {
  const withoutChecksum: Omit<BackupEnvelope, 'checksum'> = {
    format: BACKUP_FORMAT,
    version: opts.version ?? BACKUP_FORMAT_VERSION,
    createdAt: opts.createdAt ?? T0 + 1,
    schemaVersion: opts.schemaVersion ?? 7,
    checksumAlgorithm: 'sha256',
    data: data as BackupData,
  };
  const checksum = computeChecksum(
    canonicalString(withoutChecksum as unknown as Record<string, unknown>),
  );
  return { ...withoutChecksum, checksum };
}

/** A minimal but valid data snapshot (empty everything). */
export function emptyData(): BackupData {
  return {
    schemaVersion: 7,
    profile: null,
    gameSessions: [],
    domainRatings: [],
    ratingHistory: [],
    currencyLedger: [],
    gameFavorites: [],
    xpAwards: [],
    tutorialState: [],
    workoutInstances: [],
    questDefinitions: [],
    questProgress: [],
    achievementDefinitions: [],
    achievementUnlocks: [],
  };
}
