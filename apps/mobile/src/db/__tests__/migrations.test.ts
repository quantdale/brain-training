import { describe, expect, it } from '@jest/globals';
import type { SQLiteAdapter } from '../adapter';
import { createNodeSqliteAdapter } from '../adapters/node';
import { runMigrations, getSchemaVersion } from '../migrate';
import { SCHEMA_VERSION } from '../schema';
import { LedgerRepository } from '../ledger';
import { createMigratedDb } from './helpers';

async function objectNames(adapter: SQLiteAdapter): Promise<string[]> {
  const rows = await adapter.all<{ name: string; type: string }>(
    "SELECT name, type FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'",
  );
  return rows.map((r) => `${r.type}:${r.name}`);
}

describe('migrations', () => {
  it('migrates a fresh database to SCHEMA_VERSION with all objects', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await runMigrations(adapter);

    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);

    const names = await objectNames(adapter);
    expect(names).toEqual(
      expect.arrayContaining([
        'table:profile',
        'table:game_sessions',
        'table:currency_ledger',
        'table:domain_ratings',
        'table:rating_history',
        'table:game_favorites',
        'table:xp_awards',
        'table:quests',
        'table:quest_progress',
        'table:achievements',
        'table:achievement_unlocks',
        'view:currency_balance',
        'index:idx_game_sessions_game_id',
        'index:idx_currency_ledger_created_at',
        'index:idx_rating_history_domain',
        'index:idx_rating_history_session',
        'index:idx_xp_awards_created_at',
        'trigger:trg_currency_ledger_no_update',
        'trigger:trg_currency_ledger_no_delete',
        'trigger:trg_rating_history_no_update',
        'trigger:trg_rating_history_no_delete',
        'trigger:trg_xp_awards_no_update',
        'trigger:trg_xp_awards_no_delete',
      ]),
    );
  });

  it('upgrades a v2 database to v3 preserving existing rows', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await runMigrations(adapter, { targetVersion: 2 });
    expect(await getSchemaVersion(adapter)).toBe(2);

    await adapter.run(
      'INSERT INTO profile (id, display_name, settings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      ['local', 'tester', '{}', 1000, 2000],
    );
    await adapter.run(
      'INSERT INTO domain_ratings (domain, rating, sessions, updated_at) VALUES (?, ?, ?, ?)',
      ['Math', 1010, 2, 2000],
    );

    await runMigrations(adapter);
    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);

    const rating = await adapter.get<{ rating: number }>('SELECT rating FROM domain_ratings');
    expect(rating?.rating).toBe(1010);

    expect(await adapter.all('SELECT * FROM xp_awards')).toHaveLength(0);
    expect(await adapter.all('SELECT * FROM quests')).toHaveLength(0);
    expect(await adapter.all('SELECT * FROM achievements')).toHaveLength(0);
  });

  it('upgrades a v1 database to v2 preserving existing rows', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await runMigrations(adapter, { targetVersion: 1 });
    expect(await getSchemaVersion(adapter)).toBe(1);

    // v1 data: profile row, one session, one ledger entry.
    await adapter.run(
      'INSERT INTO profile (id, display_name, settings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      ['local', 'tester', '{}', 1000, 2000],
    );
    await adapter.run(
      `INSERT INTO game_sessions (
        id, game_id, game_version, generator_version, scoring_version, seed,
        difficulty_json, raw_result_json, normalized_result, xp,
        started_at, completed_at, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['s1', 'memory', 1, 1, 1, 42, '{}', '{}', 0.5, 30, 1000, 2000, 1000],
    );
    await adapter.run(
      'INSERT INTO currency_ledger (amount, reason, session_id, created_at) VALUES (?, ?, ?, ?)',
      [10, 'reward', 's1', 2000],
    );

    // Migrate to v2: existing data must survive; new tables start empty.
    await runMigrations(adapter);
    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);

    const profile = await adapter.get<{ display_name: string }>('SELECT display_name FROM profile');
    expect(profile?.display_name).toBe('tester');
    const session = await adapter.get<{ id: string; xp: number }>(
      'SELECT id, xp FROM game_sessions',
    );
    expect(session).toEqual({ id: 's1', xp: 30 });
    const ledger = await adapter.get<{ amount: number }>('SELECT amount FROM currency_ledger');
    expect(ledger?.amount).toBe(10);

    expect(await adapter.all('SELECT * FROM domain_ratings')).toHaveLength(0);
    expect(await adapter.all('SELECT * FROM rating_history')).toHaveLength(0);
    expect(await adapter.all('SELECT * FROM game_favorites')).toHaveLength(0);
  });

  it('re-running migrations on a migrated database is a no-op', async () => {
    const adapter = await createMigratedDb();
    const profileBefore = await adapter.all('SELECT * FROM profile');
    const ledgerBefore = await adapter.all('SELECT * FROM currency_ledger');

    await runMigrations(adapter); // must not throw

    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);
    expect(await adapter.all('SELECT * FROM profile')).toEqual(profileBefore);
    expect(await adapter.all('SELECT * FROM currency_ledger')).toEqual(ledgerBefore);
  });

  it('a failing migration on a fresh database rolls back fully (version stays 0)', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    const failing = [
      {
        version: 1,
        up: async (txn: SQLiteAdapter) => {
          await txn.exec('CREATE TABLE partial_side_effect (id INTEGER)');
          throw new Error('boom');
        },
      },
    ];

    await expect(runMigrations(adapter, { migrations: failing, targetVersion: 1 })).rejects.toThrow(
      'boom',
    );

    // Nothing from the failed migration survived: version 0, no tables.
    expect(await getSchemaVersion(adapter)).toBe(0);
    const names = await objectNames(adapter);
    expect(names).not.toContain('table:partial_side_effect');
    expect(names).not.toContain('table:profile');

    // The database remains usable for a later, successful run.
    await runMigrations(adapter);
    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);
  });

  it('a failing later migration rolls back only itself, keeping prior migrations', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    const migrations = [
      {
        version: 1,
        up: async (txn: SQLiteAdapter) => {
          await txn.exec('CREATE TABLE migration_v1_ok (id INTEGER)');
        },
      },
      {
        version: 2,
        up: async (txn: SQLiteAdapter) => {
          await txn.exec('CREATE TABLE migration_v2_boom (id INTEGER)');
          throw new Error('boom v2');
        },
      },
    ];

    await expect(
      runMigrations(adapter, { migrations, targetVersion: 2 }),
    ).rejects.toThrow('boom v2');

    expect(await getSchemaVersion(adapter)).toBe(1);
    const names = await objectNames(adapter);
    expect(names).toContain('table:migration_v1_ok');
    expect(names).not.toContain('table:migration_v2_boom');

    // Re-running still stops at the failing migration; targeting v1 succeeds.
    await expect(
      runMigrations(adapter, { migrations, targetVersion: 2 }),
    ).rejects.toThrow('boom v2');
    await runMigrations(adapter, { migrations, targetVersion: 1 });
    expect(await getSchemaVersion(adapter)).toBe(1);
  });

  it('rejects duplicate migration versions', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    const dupes = [
      { version: 1, up: async () => undefined },
      { version: 1, up: async () => undefined },
    ];
    await expect(runMigrations(adapter, { migrations: dupes })).rejects.toThrow(
      'Duplicate migration version 1',
    );
  });
});

describe('currency ledger integrity', () => {
  it('enforces append-only: UPDATE and DELETE are rejected', async () => {
    const adapter = await createMigratedDb();
    const ledger = new LedgerRepository(adapter);
    const entry = await ledger.append({ amount: 10, reason: 'test' });

    await expect(
      adapter.run('UPDATE currency_ledger SET amount = 99 WHERE id = ?', [entry.id]),
    ).rejects.toThrow(/append-only/);
    await expect(adapter.run('DELETE FROM currency_ledger WHERE id = ?', [entry.id])).rejects.toThrow(
      /append-only/,
    );

    // Entry survived both attempts, balance untouched.
    expect(await ledger.getBalance()).toBe(10);
    expect(await ledger.list()).toHaveLength(1);
  });

  it('assigns strictly monotonic ledger ids', async () => {
    const adapter = await createMigratedDb();
    const ledger = new LedgerRepository(adapter);

    const ids: number[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push((await ledger.append({ amount: 1, reason: 'tick' })).id);
    }

    expect(ids).toHaveLength(5);
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBeGreaterThan(ids[i - 1]);
    }
  });
});

describe('task 8.5: historical pre-006R (v5) migration preserves every entity', () => {
  /**
   * Build a realistic pre-006R database at user_version 5 (the schema that
   * existed before 006R added the `operation_id` column on `currency_ledger`),
   * populate it with representative historical data across every entity, then
   * migrate to the current schema and prove all data survives.
   */
  it('migrates a realistic v5 database to v6 preserving all rows', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await runMigrations(adapter, { targetVersion: 5 });
    expect(await getSchemaVersion(adapter)).toBe(5);
    // Pre-006R schema has no operation_id column yet.
    const preCols = await adapter.all<{ name: string }>('PRAGMA table_info(currency_ledger)');
    expect(preCols.some((c) => c.name === 'operation_id')).toBe(false);

    await adapter.run(
      "INSERT INTO profile (id, display_name, settings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      ['local', 'Ada', '{"theme":"dark","reducedMotion":true}', 1000, 2000],
    );

    await adapter.run(
      `INSERT INTO game_sessions (
        id, game_id, game_version, generator_version, scoring_version, seed,
        difficulty_json, raw_result_json, normalized_result, xp,
        started_at, completed_at, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['s1', 'memory', 1, 1, 1, 42, '{"mode":"normal"}', '{"score":120}', 0.75, 50, 1000, 2000, 1000],
    );
    await adapter.run(
      `INSERT INTO game_sessions (
        id, game_id, game_version, generator_version, scoring_version, seed,
        difficulty_json, raw_result_json, normalized_result, xp,
        started_at, completed_at, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['s2', 'math-fast-math', 2, 3, 1, 7, '{"mode":"hard"}', '{"score":80}', 0.6, 40, 3000, 4000, 1000],
    );

    await adapter.run(
      'INSERT INTO currency_ledger (amount, reason, session_id, created_at) VALUES (?, ?, ?, ?)',
      [10, 'session_reward', 's1', 2000],
    );
    await adapter.run(
      'INSERT INTO currency_ledger (amount, reason, session_id, created_at) VALUES (?, ?, ?, ?)',
      [5, 'quest', null, 2500],
    );
    await adapter.run(
      'INSERT INTO currency_ledger (amount, reason, session_id, created_at) VALUES (?, ?, ?, ?)',
      [-3, 'reroll', null, 2600],
    );

    await adapter.run(
      'INSERT INTO domain_ratings (domain, rating, sessions, updated_at) VALUES (?, ?, ?, ?)',
      ['Memory', 1010, 1, 2000],
    );
    await adapter.run(
      'INSERT INTO domain_ratings (domain, rating, sessions, updated_at) VALUES (?, ?, ?, ?)',
      ['Attention', 980, 1, 4000],
    );
    await adapter.run(
      'INSERT INTO rating_history (session_id, domain, delta, rating_after, created_at) VALUES (?, ?, ?, ?, ?)',
      ['s1', 'Memory', 6, 1010, 2000],
    );
    await adapter.run(
      'INSERT INTO rating_history (session_id, domain, delta, rating_after, created_at) VALUES (?, ?, ?, ?, ?)',
      ['s2', 'Attention', 3, 980, 4000],
    );

    await adapter.run('INSERT INTO game_favorites (game_id, created_at) VALUES (?, ?)', ['memory', 1500]);

    await adapter.run(
      'INSERT INTO xp_awards (amount, reason, source, created_at) VALUES (?, ?, ?, ?)',
      [20, 'quest', 'quest:daily-1', 2200],
    );
    await adapter.run(
      'INSERT INTO xp_awards (amount, reason, source, created_at) VALUES (?, ?, ?, ?)',
      [50, 'achievement', 'achievement:first-session', 2300],
    );

    await adapter.run(
      `INSERT INTO quests (id, kind, title, description, criteria_json, reward_xp, reward_currency, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['daily-1', 'daily', 'Daily Win', 'Win 1 session', '{"target":1}', 20, 5, 1],
    );
    await adapter.run(
      `INSERT INTO quest_progress (quest_id, period, progress, completed_at, claimed_at)
       VALUES (?, ?, ?, ?, ?)`,
      ['daily-1', '2026-08-16', 1, 2000, 2200],
    );

    await adapter.run(
      `INSERT INTO achievements (id, title, description, criteria_json, reward_xp, reward_currency, version)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['first-session', 'First Session', 'Complete a session', '{"target":1}', 50, 10, 1],
    );
    await adapter.run(
      'INSERT INTO achievement_unlocks (achievement_id, unlocked_at, claimed_at) VALUES (?, ?, ?)',
      ['first-session', 2300, 2300],
    );

    await adapter.run(
      'INSERT INTO tutorial_state (game_id, completed, replay_requested, version, updated_at) VALUES (?, ?, ?, ?, ?)',
      ['memory', 1, 0, '1', 2100],
    );

    // Migrate forward to the current (006R) schema.
    await runMigrations(adapter);
    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);

    // Every entity count is preserved exactly.
    expect(await adapter.all('SELECT * FROM profile')).toHaveLength(1);
    expect(await adapter.all('SELECT * FROM game_sessions')).toHaveLength(2);
    expect(await adapter.all('SELECT * FROM currency_ledger')).toHaveLength(3);
    expect(await adapter.all('SELECT * FROM domain_ratings')).toHaveLength(2);
    expect(await adapter.all('SELECT * FROM rating_history')).toHaveLength(2);
    expect(await adapter.all('SELECT * FROM game_favorites')).toHaveLength(1);
    expect(await adapter.all('SELECT * FROM xp_awards')).toHaveLength(2);
    expect(await adapter.all('SELECT * FROM quests')).toHaveLength(1);
    expect(await adapter.all('SELECT * FROM quest_progress')).toHaveLength(1);
    expect(await adapter.all('SELECT * FROM achievements')).toHaveLength(1);
    expect(await adapter.all('SELECT * FROM achievement_unlocks')).toHaveLength(1);
    expect(await adapter.all('SELECT * FROM tutorial_state')).toHaveLength(1);

    // 006R added operation_id: column exists and existing rows are NULL.
    const cols = await adapter.all<{ name: string }>('PRAGMA table_info(currency_ledger)');
    expect(cols.some((c) => c.name === 'operation_id')).toBe(true);
    const ledger = await adapter.all<{ operation_id: unknown | null }>('SELECT operation_id FROM currency_ledger');
    expect(ledger).toEqual([{ operation_id: null }, { operation_id: null }, { operation_id: null }]);

    // Legacy values survive intact (profile settings, session xp, balance).
    const profile = await adapter.get<{ display_name: string; settings_json: string }>(
      'SELECT display_name, settings_json FROM profile',
    );
    expect(profile).toEqual({ display_name: 'Ada', settings_json: '{"theme":"dark","reducedMotion":true}' });
    const session = await adapter.get<{ id: string; xp: number }>('SELECT id, xp FROM game_sessions WHERE id = ?', ['s1']);
    expect(session).toEqual({ id: 's1', xp: 50 });
    expect(await new LedgerRepository(adapter).getBalance()).toBe(12); // 10 + 5 - 3
  });
});

describe('task 8.6: migration rollback and repeated/idempotent initialization', () => {
  it('rolls back the 006R v6 migration on failure, keeping the v5 DB intact and usable', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await runMigrations(adapter, { targetVersion: 5 });
    await adapter.run(
      "INSERT INTO profile (id, display_name, settings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      ['local', 'tester', '{}', 1000, 2000],
    );
    await adapter.run(
      'INSERT INTO currency_ledger (amount, reason, session_id, created_at) VALUES (?, ?, ?, ?)',
      [10, 'reward', null, 2000],
    );

    // Inject a failing v6 so the upgrade aborts mid-way.
    const failingV6 = [
      {
        version: 6,
        up: async (txn: SQLiteAdapter) => {
          await txn.exec('CREATE TABLE partial_v6_side_effect (id INTEGER)');
          throw new Error('v6 boom');
        },
      },
    ];
    await expect(runMigrations(adapter, { migrations: failingV6, targetVersion: 6 })).rejects.toThrow(
      'v6 boom',
    );

    // Database remains at v5 with all its data; the failed DDL rolled back.
    expect(await getSchemaVersion(adapter)).toBe(5);
    const names = await objectNames(adapter);
    expect(names).not.toContain('table:partial_v6_side_effect');
    expect(await adapter.all('SELECT * FROM profile')).toHaveLength(1);
    expect(await adapter.all('SELECT * FROM currency_ledger')).toHaveLength(1);

    // The database is still usable, and a later real migration completes cleanly.
    await runMigrations(adapter);
    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);
    expect(await adapter.all('SELECT * FROM profile')).toHaveLength(1);
    expect(await adapter.all('SELECT * FROM currency_ledger')).toHaveLength(1);
  });

  it('repeated full initialization never duplicates data or changes schema version', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await runMigrations(adapter);
    await adapter.run(
      `INSERT INTO game_sessions (
        id, game_id, game_version, generator_version, scoring_version, seed,
        difficulty_json, raw_result_json, normalized_result, xp,
        started_at, completed_at, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['s1', 'memory', 1, 1, 1, 42, '{}', '{}', 0.5, 30, 1000, 2000, 1000],
    );
    await adapter.run(
      'INSERT INTO currency_ledger (amount, reason, session_id, created_at) VALUES (?, ?, ?, ?)',
      [10, 'reward', 's1', 2000],
    );

    // Simulate re-running initialization multiple times after data exists.
    await runMigrations(adapter);
    await runMigrations(adapter);

    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);
    expect(await adapter.all('SELECT * FROM game_sessions')).toHaveLength(1);
    expect(await adapter.all('SELECT * FROM currency_ledger')).toHaveLength(1);
    expect(await new LedgerRepository(adapter).getBalance()).toBe(10);
  });
});
