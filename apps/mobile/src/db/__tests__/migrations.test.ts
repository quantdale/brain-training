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
        'view:currency_balance',
        'index:idx_game_sessions_game_id',
        'index:idx_currency_ledger_created_at',
        'index:idx_rating_history_domain',
        'index:idx_rating_history_session',
        'trigger:trg_currency_ledger_no_update',
        'trigger:trg_currency_ledger_no_delete',
        'trigger:trg_rating_history_no_update',
        'trigger:trg_rating_history_no_delete',
      ]),
    );
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
        up: async (exec: (sql: string) => Promise<void>) => {
          await exec('CREATE TABLE partial_side_effect (id INTEGER)');
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
        up: async (exec: (sql: string) => Promise<void>) => {
          await exec('CREATE TABLE migration_v1_ok (id INTEGER)');
        },
      },
      {
        version: 2,
        up: async (exec: (sql: string) => Promise<void>) => {
          await exec('CREATE TABLE migration_v2_boom (id INTEGER)');
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
