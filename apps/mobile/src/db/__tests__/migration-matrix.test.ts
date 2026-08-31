/**
 * Campaign 011 W11 — schema migration matrix (BLOCKER-class owner).
 *
 * Extends migration-robustness.test.ts / migrations.test.ts with the full
 * adversarial matrix the packet requires, on real better-sqlite3:
 *
 * - EVERY starting version v0(fresh)..v8 migrates to SCHEMA_VERSION with
 *   seeded rows preserved exactly (table counts before/after — no loss, no
 *   duplication), including a v7 database carrying duplicate legacy `gameplay`
 *   ledger rows so the v8 backfill runs inside every late hop.
 * - The migrated object inventory is complete: both performance indexes
 *   (`idx_game_sessions_completed_at` v8, `idx_rating_history_created_at` v9),
 *   all six append-only triggers, and the balance view.
 * - Append-only enforcement actually rejects UPDATE/DELETE at the final state.
 * - `PRAGMA foreign_key_check` is clean after every hop.
 * - Corrupt `user_version` is rejected: newer-than-code (downgrade guard) and
 *   negative/garbage header values must never silently replay migrations over
 *   live data.
 */

import { describe, expect, it } from '@jest/globals';
import type { SQLiteAdapter } from '../adapter';
import { createNodeSqliteAdapter } from '../adapters/node';
import { getSchemaVersion, initializeConnection, runMigrations } from '../migrate';
import { MIGRATIONS, SCHEMA_VERSION } from '../schema';

const T0 = 1_700_000_000_000;

/** All non-internal schema objects as `type:name` strings. */
async function objectNames(adapter: SQLiteAdapter): Promise<string[]> {
  const rows = await adapter.all<{ name: string; type: string }>(
    "SELECT name, type FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'",
  );
  return rows.map((r) => `${r.type}:${r.name}`);
}

/** Tables that exist as of each schema version (cumulative). */
const TABLES_BY_VERSION: Record<number, readonly string[]> = {
  1: ['profile', 'game_sessions', 'currency_ledger'],
  2: ['domain_ratings', 'rating_history', 'game_favorites'],
  3: ['xp_awards', 'quests', 'quest_progress', 'achievements', 'achievement_unlocks'],
  4: ['tutorial_state'],
  7: ['workout_instances'],
};

function tablesAt(version: number): string[] {
  const out: string[] = [];
  for (let v = 1; v <= version; v++) {
    out.push(...(TABLES_BY_VERSION[v] ?? []));
  }
  return out;
}

/**
 * Seed one canonical dataset into every table that exists at `version`.
 *
 * The ledger intentionally carries TWO legacy `gameplay` rows for s1 with NULL
 * operation_id (the historical double-award shape) plus one non-gameplay row,
 * so any hop crossing v8 exercises the operation_id backfill. Returns the
 * expected row count per table after migration to SCHEMA_VERSION.
 */
async function seedCanonicalData(adapter: SQLiteAdapter, version: number): Promise<Map<string, number>> {
  const expected = new Map<string, number>();

  // --- v1 tables -----------------------------------------------------------
  await adapter.run(
    "INSERT INTO profile (id, display_name, settings_json, created_at, updated_at) VALUES ('local', 'Ada v" +
      version +
      "', '{\"theme\":\"dark\"}', ?, ?)",
    [T0, T0],
  );
  expected.set('profile', 1);

  for (const [i, id] of ['s1', 's2'].entries()) {
    await adapter.run(
      `INSERT INTO game_sessions (
        id, game_id, game_version, generator_version, scoring_version, seed,
        difficulty_json, raw_result_json, normalized_result, xp,
        started_at, completed_at, duration_ms
      ) VALUES (?, ?, 1, 1, 1, ?, '{}', '{"score":10}', ?, ?, ?, ?, 1000)`,
      [id, i === 0 ? 'memory' : 'math-fast-math', 42 + i, 0.5 + i * 0.1, 30 + i, T0 + i * 1000, T0 + i * 1000 + 500],
    );
  }
  expected.set('game_sessions', 2);

  await adapter.run(
    "INSERT INTO currency_ledger (amount, reason, session_id, created_at) VALUES (50, 'gameplay', 's1', ?)",
    [T0],
  );
  await adapter.run(
    "INSERT INTO currency_ledger (amount, reason, session_id, created_at) VALUES (50, 'gameplay', 's1', ?)",
    [T0 + 1],
  );
  await adapter.run(
    "INSERT INTO currency_ledger (amount, reason, session_id, created_at) VALUES (-3, 'reroll', NULL, ?)",
    [T0 + 2],
  );
  expected.set('currency_ledger', 3);

  // --- v2 tables -----------------------------------------------------------
  if (version >= 2) {
    await adapter.run("INSERT INTO domain_ratings (domain, rating, sessions, updated_at) VALUES ('Memory', 1010, 1, ?)", [T0]);
    await adapter.run("INSERT INTO domain_ratings (domain, rating, sessions, updated_at) VALUES ('Attention', 990, 1, ?)", [T0]);
    expected.set('domain_ratings', 2);

    await adapter.run("INSERT INTO rating_history (session_id, domain, delta, rating_after, created_at) VALUES ('s1', 'Memory', 10, 1010, ?)", [T0]);
    await adapter.run("INSERT INTO rating_history (session_id, domain, delta, rating_after, created_at) VALUES ('s2', 'Attention', -10, 990, ?)", [T0]);
    expected.set('rating_history', 2);

    await adapter.run("INSERT INTO game_favorites (game_id, created_at) VALUES ('memory', ?)", [T0]);
    expected.set('game_favorites', 1);
  }

  // --- v3 tables -----------------------------------------------------------
  if (version >= 3) {
    await adapter.run("INSERT INTO xp_awards (amount, reason, source, created_at) VALUES (20, 'quest', 'quest:daily-1', ?)", [T0]);
    await adapter.run("INSERT INTO xp_awards (amount, reason, source, created_at) VALUES (50, 'achievement', 'achievement:first', ?)", [T0]);
    expected.set('xp_awards', 2);

    await adapter.run(
      "INSERT INTO quests (id, kind, title, description, criteria_json, reward_xp, reward_currency, version) VALUES ('daily-1', 'daily', 'Daily Win', 'Win one', '{\"target\":1}', 20, 5, 1)",
    );
    expected.set('quests', 1);
    await adapter.run("INSERT INTO quest_progress (quest_id, period, progress, completed_at, claimed_at) VALUES ('daily-1', '2026-08-20', 1, ?, ?)", [T0, T0]);
    expected.set('quest_progress', 1);

    await adapter.run(
      "INSERT INTO achievements (id, title, description, criteria_json, reward_xp, reward_currency, version) VALUES ('first', 'First', 'First session', '{\"target\":1}', 50, 10, 1)",
    );
    expected.set('achievements', 1);
    await adapter.run("INSERT INTO achievement_unlocks (achievement_id, unlocked_at, claimed_at) VALUES ('first', ?, ?)", [T0, T0]);
    expected.set('achievement_unlocks', 1);
  }

  // --- v4 tables -----------------------------------------------------------
  if (version >= 4) {
    await adapter.run("INSERT INTO tutorial_state (game_id, completed, replay_requested, version, updated_at) VALUES ('memory', 1, 0, '1', ?)", [T0]);
    expected.set('tutorial_state', 1);
  }

  // --- v7 tables -----------------------------------------------------------
  if (version >= 7) {
    await adapter.run(
      "INSERT INTO workout_instances (date, game_ids_json, status, current_index, reroll_attempt, seed_version, created_at, updated_at) VALUES ('2026-08-20', '[\"memory\",\"math-fast-math\"]', 'active', 1, 0, 3, ?, ?)",
      [T0, T0],
    );
    expected.set('workout_instances', 1);
  }

  return expected;
}

describe('campaign 011 W11 migration matrix', () => {
  /**
   * Fresh database -> SCHEMA_VERSION: object inventory + integrity only
   * (nothing seeded, so trigger probes would be no-ops on empty tables).
   */
  it('fresh database lands at v9 with the complete object inventory', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await initializeConnection(adapter);
    await runMigrations(adapter);

    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);
    expect(await objectNames(adapter)).toEqual(
      expect.arrayContaining([
        'index:idx_game_sessions_completed_at',
        'index:idx_rating_history_created_at',
        'index:idx_rating_history_session_domain',
        'trigger:trg_currency_ledger_no_update',
        'trigger:trg_currency_ledger_no_delete',
        'trigger:trg_rating_history_no_update',
        'trigger:trg_rating_history_no_delete',
        'trigger:trg_xp_awards_no_update',
        'trigger:trg_xp_awards_no_delete',
        'view:currency_balance',
      ]),
    );
    // Every declared table exists.
    const tableNames = (
      await adapter.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    ).map((r) => r.name);
    expect(tableNames.sort()).toEqual([...tablesAt(SCHEMA_VERSION)].sort());
    const fkViolations = await adapter.all<Record<string, unknown>>('PRAGMA foreign_key_check');
    expect(fkViolations).toEqual([]);
    await adapter.close();
  });

  /**
   * EVERY populated starting version v1..v(SCHEMA_VERSION-1) migrates to
   * SCHEMA_VERSION with seeded rows preserved exactly (table counts
   * before/after — no loss, no duplication). Late hops cross the v8 backfill,
   * which sees the seeded duplicate legacy gameplay rows.
   */
  for (let start = 1; start < SCHEMA_VERSION; start += 1) {
    it(`migrates populated v${start} -> v${SCHEMA_VERSION} losing no rows and leaving integrity clean`, async () => {
      const adapter = createNodeSqliteAdapter(':memory:');
      await initializeConnection(adapter);
      await runMigrations(adapter, { targetVersion: start });
      expect(await getSchemaVersion(adapter)).toBe(start);

      const expected = await seedCanonicalData(adapter, start);

      await runMigrations(adapter);
      expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);

      // 1. No row loss / no duplication in ANY table ever touched by a migration.
      for (const [table, count] of expected) {
        const row = await adapter.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
        expect(row?.n).toBe(count);
      }

      // 2. All objects present at final state, including the two performance
      //    indexes added by v8/v9 and every append-only trigger.
      const finalNames = await objectNames(adapter);
      expect(finalNames).toEqual(
        expect.arrayContaining([
          'index:idx_game_sessions_completed_at',
          'index:idx_rating_history_created_at',
          'index:idx_rating_history_session_domain',
          'trigger:trg_currency_ledger_no_update',
          'trigger:trg_currency_ledger_no_delete',
          'trigger:trg_rating_history_no_update',
          'trigger:trg_rating_history_no_delete',
          'trigger:trg_xp_awards_no_update',
          'trigger:trg_xp_awards_no_delete',
          'view:currency_balance',
        ]),
      );

      // 3. Foreign keys intact: no dangling references survived the chain.
      const fkViolations = await adapter.all<Record<string, unknown>>('PRAGMA foreign_key_check');
      expect(fkViolations).toEqual([]);

      // 4. Append-only enforcement holds at the final state (the triggers exist
      //    AND fire — existence alone was not enough during the v8 drop/recreate).
      //    BEFORE triggers only fire on matching rows, so probe per table only
      //    when the seeded dataset actually has rows in it.
      await expect(
        adapter.run('UPDATE currency_ledger SET amount = 99 WHERE amount = 50'),
      ).rejects.toThrow(/append-only/);
      if ((expected.get('rating_history') ?? 0) > 0) {
        await expect(adapter.run('DELETE FROM rating_history')).rejects.toThrow(/append-only/);
      }
      if ((expected.get('xp_awards') ?? 0) > 0) {
        await expect(adapter.run('DELETE FROM xp_awards')).rejects.toThrow(/append-only/);
      }

      // 5. Repeat initialization stays idempotent with data present.
      await runMigrations(adapter);
      expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);
      for (const [table, count] of expected) {
        const row = await adapter.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
        expect(row?.n).toBe(count);
      }

      await adapter.close();
    });
  }

  it('v8 backfill keys only the earliest duplicate gameplay row inside the matrix hop', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await initializeConnection(adapter);
    await runMigrations(adapter, { targetVersion: 7 });
    await seedCanonicalData(adapter, 7);

    await runMigrations(adapter);

    const rows = await adapter.all<{ operation_id: string | null }>(
      'SELECT operation_id FROM currency_ledger ORDER BY id',
    );
    // Earliest gameplay:s1 keyed; its duplicate and the reroll row stay NULL.
    expect(rows.map((r) => r.operation_id)).toEqual(['gameplay:s1', null, null]);
    // Balance untouched by the backfill UPDATE.
    const row = await adapter.get<{ balance: number }>('SELECT balance FROM currency_balance');
    expect(row?.balance).toBe(97); // 50 + 50 - 3
    await adapter.close();
  });

  it('every intermediate version has exactly the tables its migrations define', async () => {
    // Guards against an accidental renumber/reorder: migrating to version N
    // must produce precisely the cumulative table set of versions 1..N.
    for (let start = 1; start < SCHEMA_VERSION; start += 1) {
      const adapter = createNodeSqliteAdapter(':memory:');
      await runMigrations(adapter, { targetVersion: start });
      const names = (
        await adapter.all<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        )
      ).map((r) => r.name);
      expect(names.sort()).toEqual([...tablesAt(start)].sort());
      await adapter.close();
    }
  });
});

describe('corrupt user_version handling', () => {
  it('rejects a database whose user_version is newer than the code supports', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await runMigrations(adapter, { targetVersion: SCHEMA_VERSION - 1 });
    await adapter.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 3}`);

    await expect(runMigrations(adapter)).rejects.toThrow(/newer than supported version/);
    // The corrupt-but-newer version is left untouched (no partial writes).
    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION + 3);
    await adapter.close();
  });

  it('rejects a negative (header-corrupted) user_version instead of replaying migrations', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await runMigrations(adapter);
    const sessionsBefore = await adapter.get<{ n: number }>('SELECT COUNT(*) AS n FROM game_sessions');
    expect(sessionsBefore?.n).toBe(0);

    await adapter.exec('PRAGMA user_version = -5');

    // Pre-fix behavior silently treated this as version 0 and replayed the
    // entire chain (CREATE IF NOT EXISTS + the v8 backfill UPDATE) over live
    // data. Corruption must stop startup instead.
    await expect(runMigrations(adapter)).rejects.toThrow(/corrupt/);
    expect(await getSchemaVersion(adapter)).toBe(-5);
    await adapter.close();
  });
});

describe('migration set sanity', () => {
  it('declares exactly versions 1..SCHEMA_VERSION in order', () => {
    expect(MIGRATIONS.map((m) => m.version)).toEqual(
      Array.from({ length: SCHEMA_VERSION }, (_, i) => i + 1),
    );
  });
});
