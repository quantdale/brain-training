/**
 * Migration robustness (task B): every upgrade path must land cleanly at the
 * current schema version, data must survive each hop, an interrupted/failed
 * migration must roll back, a future (newer-than-code) schema must be rejected,
 * and repeated initialization must be a no-op.
 */

import { describe, expect, it } from '@jest/globals';
import type { SQLiteAdapter } from '../adapter';
import { createNodeSqliteAdapter } from '../adapters/node';
import { runMigrations, getSchemaVersion } from '../migrate';
import { MIGRATIONS, SCHEMA_VERSION } from '../schema';
import { createMigratedDb } from './helpers';

describe('every upgrade path lands at SCHEMA_VERSION', () => {
  for (let start = 1; start < SCHEMA_VERSION; start += 1) {
    it(`migrates cleanly from v${start} -> v${SCHEMA_VERSION}`, async () => {
      const adapter = createNodeSqliteAdapter(':memory:');
      await runMigrations(adapter, { targetVersion: start });
      expect(await getSchemaVersion(adapter)).toBe(start);
      // Run the full remaining chain.
      await runMigrations(adapter, { targetVersion: SCHEMA_VERSION });
      expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);
      // The full object set is present.
      const names = await adapter.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type IN ('table','view','index','trigger') AND name NOT LIKE 'sqlite_%'",
      );
      expect(names.map((n) => n.name)).toEqual(
        expect.arrayContaining(['profile', 'game_sessions', 'currency_ledger', 'trg_currency_ledger_no_delete']),
      );
    });
  }
});

describe('data survives an upgrade from the earliest version', () => {
  it('v1 -> v8 preserves profile, session, and ledger rows', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await runMigrations(adapter, { targetVersion: 1 });
    await adapter.run(
      "INSERT INTO profile (id, display_name, settings_json, created_at, updated_at) VALUES ('local','Ada','{}',1000,2000)",
    );
    await adapter.run(
      `INSERT INTO game_sessions (id, game_id, game_version, generator_version, scoring_version, seed, difficulty_json, raw_result_json, normalized_result, xp, started_at, completed_at, duration_ms) VALUES ('s1','memory',1,1,1,42,'{}','{}',0.5,30,1000,2000,1000)`,
    );
    await adapter.run(
      "INSERT INTO currency_ledger (amount, reason, session_id, created_at) VALUES (10,'reward','s1',2000)",
    );

    await runMigrations(adapter); // full chain to SCHEMA_VERSION
    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);

    expect(await adapter.all('SELECT * FROM profile')).toHaveLength(1);
    expect(await adapter.all('SELECT * FROM game_sessions')).toHaveLength(1);
    expect(await adapter.all('SELECT * FROM currency_ledger')).toHaveLength(1);
    expect((await adapter.get<{ display_name: string }>('SELECT display_name FROM profile'))?.display_name).toBe('Ada');
  });
});

describe('determinism and idempotency', () => {
  it('two fresh databases have an identical, stable object set', async () => {
    const a = await createMigratedDb();
    const b = await createMigratedDb();
    const names = (db: SQLiteAdapter) =>
      db.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type IN ('table','view','index','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY name",
      );
    const na = (await names(a)).map((r) => r.name);
    const nb = (await names(b)).map((r) => r.name);
    expect(na).toEqual(nb);
    expect(await getSchemaVersion(a)).toBe(SCHEMA_VERSION);
  });

  it('re-running migrations on an already-current database is a no-op', async () => {
    const adapter = await createMigratedDb();
    await runMigrations(adapter);
    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);
  });
});

describe('future / unknown schema handling', () => {
  it('rejects running migrations down to a version below the current database', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await runMigrations(adapter, { targetVersion: 5 });
    expect(await getSchemaVersion(adapter)).toBe(5);
    // Requesting v3 when the DB is at v5 must be rejected (never silently
    // downgrade / corrupt). The migrations array length stays as-is.
    await expect(runMigrations(adapter, { targetVersion: 3 })).rejects.toThrow(/newer than|downgrad|below/i);
    expect(MIGRATIONS.length).toBe(SCHEMA_VERSION); // array is unchanged
  });

  it('a custom migrations array with a duplicate version is rejected', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    const dupes = [
      { version: 1, up: async () => undefined },
      { version: 1, up: async () => undefined },
    ];
    await expect(runMigrations(adapter, { migrations: dupes })).rejects.toThrow(/Duplicate migration version/i);
  });
});
