/**
 * Campaign 013 hardening — migration-chain adversarial/idempotency suite,
 * focused on the v10 `metadata_json` step and transaction atomicity.
 *
 * Complements migrations.test.ts / migration-matrix.test.ts /
 * migration-robustness.test.ts with the edge cases those suites do not cover:
 *
 * - the idempotent edge where `user_version` says 9 but the physical
 *   `metadata_json` column ALREADY exists (header rolled back / botched
 *   downgrade): migration must succeed without a duplicate-column error;
 * - column SHAPE verification (TEXT affinity, nullable, no default);
 * - malformed persisted metadata cells never brick startup or reads, and raw
 *   historical evidence is never silently rewritten;
 * - FAILURE INJECTION mid-migration proves DDL + `user_version` + economy
 *   mutations roll back TOGETHER (including the v8 drop-trigger/backfill
 *   window), and a retry then succeeds;
 * - repeated full initialization (connection setup included) is a no-op;
 * - unsupported (newer-than-code) databases fail startup explicitly.
 */

import { describe, expect, it } from '@jest/globals';
import type { SQLiteAdapter } from '../adapter';
import { createNodeSqliteAdapter } from '../adapters/node';
import { getSchemaVersion, initializeConnection, runMigrations } from '../migrate';
import { MIGRATIONS, SCHEMA_VERSION, SQL } from '../schema';
import { LedgerRepository } from '../ledger';
import { WorkoutRepository } from '../workout';

const T0 = 1_700_000_000_000;

async function objectNames(adapter: SQLiteAdapter): Promise<string[]> {
  const rows = await adapter.all<{ name: string; type: string }>(
    "SELECT name, type FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'",
  );
  return rows.map((r) => `${r.type}:${r.name}`);
}

async function workoutColumnNames(adapter: SQLiteAdapter): Promise<string[]> {
  const cols = await adapter.all<{ name: string }>(
    'PRAGMA table_info(workout_instances)',
  );
  return cols.map((c) => c.name);
}

/** Insert a pre-v10 workout instance row (no metadata column involved). */
async function insertLegacyWorkout(
  adapter: SQLiteAdapter,
  key: string,
  overrides: Partial<{
    gameIds: string;
    status: string;
    currentIndex: number;
    rerollAttempt: number;
    seedVersion: number;
  }> = {},
): Promise<void> {
  await adapter.run(
    `INSERT INTO workout_instances
       (date, game_ids_json, status, current_index, reroll_attempt, seed_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      key,
      overrides.gameIds ?? '["g-a","g-b","g-c","g-d"]',
      overrides.status ?? 'active',
      overrides.currentIndex ?? 0,
      overrides.rerollAttempt ?? 0,
      overrides.seedVersion ?? 1,
      T0,
      T0 + 1000,
    ],
  );
}

describe('fresh initialization lands directly at the current schema', () => {
  it('a brand-new database reaches SCHEMA_VERSION with the v10 column present from birth', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await initializeConnection(adapter);
    await runMigrations(adapter);

    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);
    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);
    // The v10 column exists immediately — the repository never needs its
    // runtime probe fallback on a freshly initialized database.
    expect(await workoutColumnNames(adapter)).toContain('metadata_json');

    const repo = new WorkoutRepository(adapter);
    const created = await repo.getOrCreate('2026-08-24', {
      gameIds: ['g-a', 'g-b'],
      seedVersion: 2,
    });
    expect(created.metadata).toBeUndefined(); // nothing fabricated
    expect(await workoutColumnNames(adapter)).toContain('metadata_json');
    await adapter.close();
  });
});

describe('v12 rating-history natural-key repair', () => {
  it('keeps the earliest duplicate and adds a unique session/domain index', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await runMigrations(adapter, { targetVersion: 11 });
    await adapter.run(
      `INSERT INTO game_sessions
        (id, game_id, game_version, generator_version, scoring_version, seed,
         difficulty_json, raw_result_json, normalized_result, xp, started_at,
         completed_at, duration_ms)
       VALUES ('s1', 'memory', 1, 1, 1, 1, '{}', '{}', 0.5, 0, 100, 100, 0)`,
    );
    await adapter.run(
      'INSERT INTO rating_history (session_id, domain, delta, rating_after, created_at) VALUES (?, ?, ?, ?, ?)',
      ['s1', 'Memory', 5, 1005, 100],
    );
    await adapter.run(
      'INSERT INTO rating_history (session_id, domain, delta, rating_after, created_at) VALUES (?, ?, ?, ?, ?)',
      ['s1', 'Memory', 99, 1099, 200],
    );

    await runMigrations(adapter);

    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);
    expect(
      await adapter.all('SELECT session_id, domain, delta FROM rating_history'),
    ).toEqual([{ session_id: 's1', domain: 'Memory', delta: 5 }]);
    expect(
      await adapter.all("PRAGMA index_list('rating_history')"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'idx_rating_history_session_domain', unique: 1 }),
      ]),
    );
    await expect(
      adapter.run(
        'DELETE FROM rating_history WHERE session_id = ? AND domain = ?',
        ['s1', 'Memory'],
      ),
    ).rejects.toThrow(/append-only/);
  });
});

describe('v9 -> v10 preserves user rows exactly', () => {
  it('migrates populated daily + template instances to v10 byte-intact with NULL metadata', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await runMigrations(adapter, { targetVersion: 9 });
    expect(await getSchemaVersion(adapter)).toBe(9);
    expect(await workoutColumnNames(adapter)).not.toContain('metadata_json');

    await insertLegacyWorkout(adapter, '2026-08-23', {
      currentIndex: 3,
      rerollAttempt: 2,
      seedVersion: 5,
      status: 'active',
    });
    await insertLegacyWorkout(adapter, '2026-08-23::focus-memory::extended', {
      gameIds: '["g-x"]',
      currentIndex: 1,
      status: 'completed',
    });

    await runMigrations(adapter);
    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);

    const rows = await adapter.all<{
      date: string;
      game_ids_json: string;
      status: string;
      current_index: number;
      reroll_attempt: number;
      seed_version: number;
      created_at: number;
      updated_at: number;
      metadata_json: string | null;
    }>('SELECT * FROM workout_instances ORDER BY date ASC');
    expect(rows).toEqual([
      {
        date: '2026-08-23',
        game_ids_json: '["g-a","g-b","g-c","g-d"]',
        status: 'active',
        current_index: 3,
        reroll_attempt: 2,
        seed_version: 5,
        created_at: T0,
        updated_at: T0 + 1000,
        metadata_json: null,
      },
      {
        date: '2026-08-23::focus-memory::extended',
        game_ids_json: '["g-x"]',
        status: 'completed',
        current_index: 1,
        reroll_attempt: 0,
        seed_version: 1,
        created_at: T0,
        updated_at: T0 + 1000,
        metadata_json: null,
      },
    ]);
    // The repository still reads both legacy rows, metadata undefined.
    const repo = new WorkoutRepository(adapter);
    expect((await repo.getByDate('2026-08-23'))?.rerollAttempt).toBe(2);
    expect((await repo.getByDate('2026-08-23'))?.metadata).toBeUndefined();
    expect(
      (await repo.getByDate('2026-08-23::focus-memory::extended'))?.status,
    ).toBe('completed');
    await adapter.close();
  });
});

describe('idempotent edge: user_version=9 while metadata_json already exists', () => {
  it('does NOT fail with duplicate-column and lands healthy at v10 (empty column)', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await runMigrations(adapter, { targetVersion: 9 });
    await insertLegacyWorkout(adapter, '2026-08-23');

    // Simulate header corruption / botched downgrade: the physical column
    // exists but user_version still claims 9.
    await adapter.exec(SQL.addWorkoutMetadataColumn);
    await adapter.exec('PRAGMA user_version = 9');

    await runMigrations(adapter); // must not throw duplicate-column

    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);
    const metaCols = (await workoutColumnNames(adapter)).filter(
      (name) => name === 'metadata_json',
    );
    expect(metaCols).toHaveLength(1); // guard skipped the ALTER — no duplicate
    const row = await adapter.get<{ date: string; metadata_json: string | null }>(
      'SELECT date, metadata_json FROM workout_instances',
    );
    expect(row).toEqual({ date: '2026-08-23', metadata_json: null });
    await adapter.close();
  });

  it('survives the same edge with the column POPULATED (data untouched)', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await runMigrations(adapter, { targetVersion: 9 });
    await insertLegacyWorkout(adapter, '2026-08-23');

    await adapter.exec(SQL.addWorkoutMetadataColumn);
    const payload = JSON.stringify({
      version: 1,
      kind: 'template',
      templateId: 'focus-memory',
      length: 'standard',
      focus: null,
    });
    await adapter.run('UPDATE workout_instances SET metadata_json = ?', [payload]);
    await adapter.exec('PRAGMA user_version = 9');

    await runMigrations(adapter);

    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);
    expect(
      (await workoutColumnNames(adapter)).filter((n) => n === 'metadata_json'),
    ).toHaveLength(1);
    const row = await adapter.get<{ metadata_json: string | null }>(
      'SELECT metadata_json FROM workout_instances',
    );
    expect(row?.metadata_json).toBe(payload); // replay rewrote nothing

    // And the repository round-trips the surviving metadata.
    const instance = await new WorkoutRepository(adapter).getByDate('2026-08-23');
    expect(instance?.metadata?.templateId).toBe('focus-memory');
    await adapter.close();
  });
});

describe('repeated full initialization is a no-op', () => {
  it('initializeConnection + runMigrations twice leaves version and objects unchanged (with data present)', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await initializeConnection(adapter);
    await runMigrations(adapter);
    await insertLegacyWorkout(adapter, '2026-08-23');
    const ledger = new LedgerRepository(adapter);
    await ledger.append({ amount: 25, reason: 'quest', sessionId: null });

    const objectsBefore = await objectNames(adapter);
    const versionBefore = await getSchemaVersion(adapter);

    // Full second initialization, exactly like a re-invoked app startup path.
    await initializeConnection(adapter);
    await runMigrations(adapter);
    await initializeConnection(adapter);
    await runMigrations(adapter);

    expect(await getSchemaVersion(adapter)).toBe(versionBefore);
    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);
    expect(await objectNames(adapter)).toEqual(objectsBefore);
    expect(await ledger.getBalance()).toBe(25);
    expect(
      (await workoutColumnNames(adapter)).filter((n) => n === 'metadata_json'),
    ).toHaveLength(1);
    await adapter.close();
  });
});

describe('metadata_json column shape', () => {
  it('is a nullable TEXT column with no default, appended last', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await runMigrations(adapter);

    const cols = await adapter.all<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>('PRAGMA table_info(workout_instances)');
    const meta = cols.find((c) => c.name === 'metadata_json');
    expect(meta).toBeDefined();
    expect(meta!.type.toUpperCase()).toBe('TEXT'); // TEXT affinity
    expect(meta!.notnull).toBe(0); // nullable — legacy rows stay NULL
    expect(meta!.dflt_value).toBeNull(); // no DEFAULT clause
    expect(meta!.pk).toBe(0);
    expect(meta!.cid).toBe(cols.length - 1); // additive: appended last
    await adapter.close();
  });

  it('nullable semantics: omitted and explicit NULL both store NULL; TEXT affinity coerces numbers', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await runMigrations(adapter);

    await insertLegacyWorkout(adapter, '2026-08-23'); // column omitted -> NULL
    await adapter.run(
      `INSERT INTO workout_instances
         (date, game_ids_json, status, current_index, reroll_attempt, seed_version, created_at, updated_at, metadata_json)
       VALUES ('2026-08-24', '["g-a"]', 'active', 0, 0, 1, ?, ?, NULL)`,
      [T0, T0],
    );

    const rows = await adapter.all<{ date: string; metadata_json: string | null }>(
      'SELECT date, metadata_json FROM workout_instances ORDER BY date ASC',
    );
    expect(rows.map((r) => r.metadata_json)).toEqual([null, null]);

    // TEXT affinity evidence: a numeric bind is stored as TEXT ('123'), and
    // typeof() reports 'text' — readers only ever see strings or NULL.
    await adapter.run(
      'UPDATE workout_instances SET metadata_json = 123 WHERE date = ?',
      ['2026-08-23'],
    );
    const coerced = await adapter.get<{ t: string; v: string | null }>(
      'SELECT typeof(metadata_json) AS t, metadata_json AS v FROM workout_instances WHERE date = ?',
      ['2026-08-23'],
    );
    expect(coerced?.t).toBe('text');
    expect(coerced?.v).toBe('123');
    await adapter.close();
  });
});

describe('malformed persisted metadata cells degrade explicitly, never brick, never rewritten', () => {
  const MALFORMED_CELLS: readonly string[] = [
    '{not json', // invalid JSON
    '', // empty string
    'null', // JSON null literal
    '[]', // JSON array (wrong container)
    '42', // JSON number
    '"plain string"', // JSON string
    '{"version":"one"}', // wrong-shaped object (bad types)
    '{"nope":true}', // wrong-shaped object (unknown keys only)
  ];

  it('startup migrations succeed over garbage cells; reads return metadata-less instances; raw bytes are preserved', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await runMigrations(adapter);
    const repo = new WorkoutRepository(adapter);

    for (const [i, cell] of MALFORMED_CELLS.entries()) {
      const key = `2026-08-${String(20 + i).padStart(2, '0')}`;
      await insertLegacyWorkout(adapter, key);
      await adapter.run('UPDATE workout_instances SET metadata_json = ? WHERE date = ?', [
        cell,
        key,
      ]);
    }

    // Startup over the corrupted database: migrations are a no-op and do not
    // touch user rows (never silently repaired).
    await runMigrations(adapter);
    await runMigrations(adapter);
    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);

    for (const [i, cell] of MALFORMED_CELLS.entries()) {
      const key = `2026-08-${String(20 + i).padStart(2, '0')}`;
      // Read degrades EXPLICITLY to "no metadata"; every other field intact.
      const instance = await repo.getByDate(key);
      expect(instance).not.toBeNull();
      expect(instance?.metadata).toBeUndefined();
      expect(instance?.gameIds).toEqual(['g-a', 'g-b', 'g-c', 'g-d']);
      expect(instance?.status).toBe('active');
      // Raw historical evidence preserved BYTE-FOR-BYTE (no silent rewrite).
      const raw = await adapter.get<{ metadata_json: string | null }>(
        'SELECT metadata_json FROM workout_instances WHERE date = ?',
        [key],
      );
      expect(raw?.metadata_json).toBe(cell);
    }

    // Bulk history reads over the corrupted rows never throw either.
    const history = await repo.listHistory({ limit: 100 });
    expect(history).toHaveLength(MALFORMED_CELLS.length);
    expect(history.every((h) => h.metadata === undefined)).toBe(true);
    await adapter.close();
  });
});

describe('failure injection: migration steps are atomic with user_version and economy', () => {
  it('a v10 crash AFTER the ALTER rolls the column AND the version bump back together; retry succeeds with exactly one column', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await runMigrations(adapter, { targetVersion: 9 });
    await insertLegacyWorkout(adapter, '2026-08-23');
    const ledger = new LedgerRepository(adapter);
    await ledger.append({ amount: 40, reason: 'gameplay', sessionId: null });

    const failingV10 = [
      ...MIGRATIONS.filter((m) => m.version < 10),
      {
        version: 10,
        up: async (txn: SQLiteAdapter) => {
          await txn.exec(SQL.addWorkoutMetadataColumn);
          throw new Error('simulated v10 crash after DDL');
        },
      },
    ];

    await expect(runMigrations(adapter, { migrations: failingV10 })).rejects.toThrow(
      'simulated v10 crash after DDL',
    );

    // Atomicity: version stayed 9 AND the physical column vanished — they
    // rolled back together, leaving zero partial state.
    expect(await getSchemaVersion(adapter)).toBe(9);
    expect(await workoutColumnNames(adapter)).not.toContain('metadata_json');
    expect(await objectNames(adapter)).toEqual(
      expect.arrayContaining([
        'trigger:trg_currency_ledger_no_update',
        'trigger:trg_currency_ledger_no_delete',
      ]),
    );
    // Append-only enforcement still live after the failed hop.
    await expect(
      adapter.run("UPDATE currency_ledger SET amount = 99 WHERE reason = 'gameplay'"),
    ).rejects.toThrow(/append-only/);
    // No partial economy mutation: balance and rows exactly as before.
    expect(await ledger.getBalance()).toBe(40);
    expect(await adapter.all('SELECT * FROM workout_instances')).toHaveLength(1);

    // Retry with the real chain succeeds cleanly.
    await runMigrations(adapter);
    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);
    expect(
      (await workoutColumnNames(adapter)).filter((n) => n === 'metadata_json'),
    ).toHaveLength(1);
    expect(await ledger.getBalance()).toBe(40);
    await adapter.close();
  });

  it('a v8 crash inside the drop-trigger/backfill window restores the append-only guard and leaves the ledger unkeyed', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await runMigrations(adapter, { targetVersion: 7 });
    await adapter.run(
      `INSERT INTO game_sessions (
         id, game_id, game_version, generator_version, scoring_version, seed,
         difficulty_json, raw_result_json, normalized_result, xp,
         started_at, completed_at, duration_ms
       ) VALUES ('s1', 'memory', 1, 1, 1, 42, '{}', '{}', 0.5, 30, ?, ?, 1000)`,
      [T0, T0 + 500],
    );
    // Two legacy gameplay rows for s1 (the historical double-award shape).
    await adapter.run(
      "INSERT INTO currency_ledger (amount, reason, session_id, created_at) VALUES (50, 'gameplay', 's1', ?)",
      [T0],
    );
    await adapter.run(
      "INSERT INTO currency_ledger (amount, reason, session_id, created_at) VALUES (50, 'gameplay', 's1', ?)",
      [T0 + 1],
    );

    const failingV8 = [
      ...MIGRATIONS.filter((m) => m.version < 8),
      {
        version: 8,
        up: async (txn: SQLiteAdapter) => {
          await txn.exec('DROP TRIGGER IF EXISTS trg_currency_ledger_no_update');
          await txn.exec(SQL.backfillGameplayOperationIds);
          throw new Error('simulated v8 crash inside guarded window');
        },
      },
    ];

    await expect(runMigrations(adapter, { migrations: failingV8 })).rejects.toThrow(
      'simulated v8 crash inside guarded window',
    );

    // Rollback undid EVERYTHING in the failed step together: version still 7,
    // the dropped trigger is BACK (from the committed v1 definition), and the
    // backfill UPDATE left no keyed rows behind.
    expect(await getSchemaVersion(adapter)).toBe(7);
    await expect(
      adapter.run("UPDATE currency_ledger SET amount = 99 WHERE id = 1"),
    ).rejects.toThrow(/append-only/);
    const keys = await adapter.all<{ operation_id: string | null }>(
      'SELECT operation_id FROM currency_ledger ORDER BY id',
    );
    expect(keys.map((k) => k.operation_id)).toEqual([null, null]);
    expect(await new LedgerRepository(adapter).getBalance()).toBe(100);

    // Retry with the real chain: succeeds and keys only the earliest row.
    await runMigrations(adapter);
    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);
    const keyed = await adapter.all<{ operation_id: string | null }>(
      'SELECT operation_id FROM currency_ledger ORDER BY id',
    );
    expect(keyed.map((k) => k.operation_id)).toEqual(['gameplay:s1', null]);
    await expect(
      adapter.run("UPDATE currency_ledger SET amount = 99 WHERE id = 1"),
    ).rejects.toThrow(/append-only/);
    await adapter.close();
  });
});

describe('unsupported database state fails startup explicitly', () => {
  it('a newer-than-code user_version aborts initialization loudly, leaving state untouched', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await runMigrations(adapter, { targetVersion: SCHEMA_VERSION - 1 });
    await insertLegacyWorkout(adapter, '2026-08-23');
    await adapter.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);

    // Full startup sequence: the rejection must come from the migration gate,
    // with an actionable message — never a silent fake-health open.
    await initializeConnection(adapter);
    await expect(runMigrations(adapter)).rejects.toThrow(
      /newer than supported version.*update the application/i,
    );

    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION + 1);
    expect(await adapter.all('SELECT * FROM workout_instances')).toHaveLength(1);
    await adapter.close();
  });
});
