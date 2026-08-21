/**
 * Database-integrity hardening regressions (campaign 009, worker W10).
 *
 * Pins the audit-matrix behaviors that were defective or untested:
 * - v8 `operation_id` backfill must never fail on historical data (duplicate
 *   legacy `gameplay` rows per session used to abort the migration on the
 *   partial unique index, which bricks app startup for that database).
 * - Corrupt stored JSON degrades gracefully instead of crashing reads.
 * - Activity dates are LOCAL calendar days (the streak engine's convention),
 *   not UTC days.
 * - Index usage on the hot read paths is pinned with EXPLAIN QUERY PLAN
 *   evidence (measured plans, not just index existence).
 * - FK enforcement and the partial unique index on `operation_id`.
 * - Returned timestamps always equal stored timestamps under an advancing
 *   injectable clock.
 */

import { describe, expect, it } from '@jest/globals';
import type { SQLiteAdapter } from '../adapter';
import { createNodeSqliteAdapter } from '../adapters/node';
import { getSchemaVersion, initializeConnection, runMigrations } from '../migrate';
import { SCHEMA_VERSION } from '../schema';
import { AchievementRepository } from '../achievements';
import { LedgerRepository } from '../ledger';
import { ProfileRepository } from '../profile';
import { QuestRepository } from '../quests';
import { SessionRepository } from '../sessions';
import { XpAwardsRepository } from '../xp-awards';
import type { GameSessionRecord } from '../types';
import { createMigratedDb } from './helpers';

const T0 = 1_700_000_000_000;

/** Database migrated to v7 (the last version before the v8 backfill runs). */
async function createV7Db(): Promise<SQLiteAdapter> {
  const adapter = createNodeSqliteAdapter(':memory:');
  await initializeConnection(adapter);
  await runMigrations(adapter, { targetVersion: 7 });
  expect(await getSchemaVersion(adapter)).toBe(7);
  return adapter;
}

/** Insert one minimal valid session row (FK parent for ledger/history rows). */
async function insertSession(adapter: SQLiteAdapter, id: string, completedAt = T0): Promise<void> {
  await adapter.run(
    `INSERT INTO game_sessions (
      id, game_id, game_version, generator_version, scoring_version, seed,
      difficulty_json, raw_result_json, normalized_result, xp,
      started_at, completed_at, duration_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, 'memory', 1, 1, 1, 42, '{}', '{}', 0.5, 10, completedAt - 1000, completedAt, 1000],
  );
}

/** Legacy (pre-v6-style) gameplay ledger row: NULL operation_id. */
async function insertLegacyGameplayRow(
  adapter: SQLiteAdapter,
  sessionId: string | null,
  amount: number,
  createdAt: number,
): Promise<void> {
  await adapter.run(
    'INSERT INTO currency_ledger (amount, reason, session_id, created_at) VALUES (?, ?, ?, ?)',
    [amount, 'gameplay', sessionId, createdAt],
  );
}

function makeRecord(id: string, over: Partial<GameSessionRecord> = {}): GameSessionRecord {
  return {
    id,
    gameId: 'memory',
    gameVersion: 1,
    generatorVersion: 1,
    scoringVersion: 1,
    seed: 42,
    difficulty: { mode: 'normal' },
    rawResult: { score: 10 },
    normalizedResult: 0.5,
    xp: 10,
    startedAt: T0,
    completedAt: T0 + 1000,
    durationMs: 1000,
    ...over,
  };
}

/** Local `YYYY-MM-DD` for an epoch-ms instant (same convention as the app). */
function localDate(ms: number): string {
  const d = new Date(ms);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

describe('v8 operation_id backfill collision safety', () => {
  it('keys only the earliest legacy gameplay row when one session has duplicates', async () => {
    const adapter = await createV7Db();
    await insertSession(adapter, 's1');
    // Historical double award: two gameplay rows for the SAME session, both
    // with NULL operation_id (pre-v6 data merged from two exports).
    await insertLegacyGameplayRow(adapter, 's1', 50, 100);
    await insertLegacyGameplayRow(adapter, 's1', 50, 200);

    // Used to reject with UNIQUE constraint failed: currency_ledger.operation_id,
    // aborting v8 and bricking startup for such databases.
    await runMigrations(adapter);
    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);

    // Earliest row keyed; the duplicate stays NULL (visible historical
    // evidence) instead of blocking the upgrade.
    const rows = await adapter.all<{ id: number; operation_id: string | null }>(
      'SELECT id, operation_id FROM currency_ledger ORDER BY id',
    );
    expect(rows).toEqual([
      { id: 1, operation_id: 'gameplay:s1' },
      { id: 2, operation_id: null },
    ]);
    // Balance untouched by the backfill.
    expect(await new LedgerRepository(adapter).getBalance()).toBe(100);
  });

  it('skips legacy rows whose derived key is already committed', async () => {
    const adapter = await createV7Db();
    await insertSession(adapter, 's1');
    // One row already carries the key; another legacy row would derive it.
    await adapter.run(
      "INSERT INTO currency_ledger (amount, reason, session_id, created_at, operation_id) VALUES (5, 'gameplay', 's1', 300, 'gameplay:s1')",
    );
    await insertLegacyGameplayRow(adapter, 's1', 50, 100);

    await runMigrations(adapter);
    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);

    const rows = await adapter.all<{ id: number; operation_id: string | null }>(
      'SELECT id, operation_id FROM currency_ledger ORDER BY id',
    );
    expect(rows).toEqual([
      { id: 1, operation_id: 'gameplay:s1' },
      { id: 2, operation_id: null },
    ]);
  });

  it('restores the append-only guard trigger after the backfill', async () => {
    const adapter = await createV7Db();
    await insertSession(adapter, 's1');
    await insertLegacyGameplayRow(adapter, 's1', 50, 100);

    await runMigrations(adapter);
    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);

    // The recreated trigger must reject UPDATE/DELETE exactly like the v1 one.
    await expect(
      adapter.run('UPDATE currency_ledger SET amount = 99 WHERE id = 1'),
    ).rejects.toThrow(/append-only/);
    await expect(
      adapter.run('DELETE FROM currency_ledger WHERE id = 1'),
    ).rejects.toThrow(/append-only/);
  });

  it('keys exactly one row per session across several duplicated sessions', async () => {
    const adapter = await createV7Db();
    for (const sid of ['s1', 's2', 's3']) {
      await insertSession(adapter, sid);
    }
    // s1 x2, s2 x3, s3 x1.
    await insertLegacyGameplayRow(adapter, 's1', 10, 100);
    await insertLegacyGameplayRow(adapter, 's1', 10, 110);
    await insertLegacyGameplayRow(adapter, 's2', 20, 120);
    await insertLegacyGameplayRow(adapter, 's2', 20, 130);
    await insertLegacyGameplayRow(adapter, 's2', 20, 140);
    await insertLegacyGameplayRow(adapter, 's3', 30, 150);

    await runMigrations(adapter);
    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);

    const rows = await adapter.all<{ id: number; session_id: string; operation_id: string | null }>(
      'SELECT id, session_id, operation_id FROM currency_ledger ORDER BY id',
    );
    expect(rows.map((r) => r.operation_id)).toEqual([
      'gameplay:s1',
      null,
      'gameplay:s2',
      null,
      null,
      'gameplay:s3',
    ]);
  });
});

describe('corrupt stored values degrade gracefully', () => {
  it('returns null payloads instead of throwing on corrupt session JSON', async () => {
    const adapter = await createMigratedDb();
    await insertSession(adapter, 's_good');
    await adapter.run(
      `INSERT INTO game_sessions (
        id, game_id, game_version, generator_version, scoring_version, seed,
        difficulty_json, raw_result_json, normalized_result, xp,
        started_at, completed_at, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['s_bad', 'memory', 1, 1, 1, 42, '{not json', '{also bad', 0.5, 10, T0, T0 + 500, 500],
    );

    const sessions = new SessionRepository(adapter);
    // One bad row used to throw out of getById/listRecent and take down the
    // history screens + export; now it degrades to null payloads.
    const bad = await sessions.getById('s_bad');
    expect(bad?.difficulty).toBeNull();
    expect(bad?.rawResult).toBeNull();

    const recent = await sessions.listRecent(10);
    expect(recent.map((r) => r.id)).toEqual(['s_bad', 's_good']);

    // Valid rows are unaffected.
    const good = await sessions.getById('s_good');
    expect(good?.difficulty).toEqual({});
    expect(good?.rawResult).toEqual({});
  });

  it('a replayed completion over a corrupt persisted row does not throw or award', async () => {
    const adapter = await createMigratedDb();
    await adapter.run(
      `INSERT INTO game_sessions (
        id, game_id, game_version, generator_version, scoring_version, seed,
        difficulty_json, raw_result_json, normalized_result, xp,
        started_at, completed_at, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['s_bad', 'memory', 1, 1, 1, 42, '{corrupt', '{}', 0.5, 10, T0, T0 + 500, 500],
    );

    const sessions = new SessionRepository(adapter);
    const result = await sessions.completeSession({
      session: makeRecord('s_bad'),
      currency: { amount: 25, reason: 'dup' },
    });

    // Duplicate path: reflects the stored row (degraded payloads), grants nothing.
    expect(result.session.id).toBe('s_bad');
    expect(result.session.difficulty).toBeNull();
    expect(result.ledgerEntry).toBeNull();
    expect(result.completionOutcome).toBeNull();
    expect(await adapter.all('SELECT * FROM currency_ledger')).toHaveLength(0);
    expect(await adapter.all('SELECT * FROM game_sessions')).toHaveLength(1);
  });

  it('quest and achievement definitions with corrupt criteria_json read back with null criteria', async () => {
    const adapter = await createMigratedDb();
    const quests = new QuestRepository(adapter);
    await quests.upsertDefinition({
      id: 'q1',
      kind: 'daily',
      title: 'Daily Win',
      description: 'Win one',
      criteria: { target: 1 },
      rewardXp: 20,
      rewardCurrency: 5,
      version: 1,
    });
    await adapter.run("UPDATE quests SET criteria_json = '{oops' WHERE id = 'q1'");

    const defs = await quests.listDefinitions();
    expect(defs).toHaveLength(1);
    expect(defs[0].criteria).toBeNull(); // used to throw SyntaxError
    expect(defs[0].title).toBe('Daily Win');

    const achievements = new AchievementRepository(adapter);
    await achievements.upsertDefinition({
      id: 'a1',
      title: 'First',
      description: 'First session',
      criteria: { goal: 1 },
      rewardXp: 50,
      rewardCurrency: 10,
      version: 1,
    });
    await adapter.run("UPDATE achievements SET criteria_json = '[broken' WHERE id = 'a1'");

    const adefs = await achievements.listDefinitions();
    expect(adefs).toHaveLength(1);
    expect(adefs[0].criteria).toBeNull();
    expect(adefs[0].title).toBe('First');
  });
});

describe('index usage (EXPLAIN QUERY PLAN evidence)', () => {
  it('recent-session lists use idx_game_sessions_completed_at', async () => {
    const adapter = await createMigratedDb();
    const plan = await adapter.all<{ detail: string }>(
      'EXPLAIN QUERY PLAN SELECT * FROM game_sessions ORDER BY completed_at DESC LIMIT 50',
    );
    expect(plan.some((r) => r.detail.includes('idx_game_sessions_completed_at'))).toBe(true);
  });

  it('per-game history uses idx_game_sessions_game_id', async () => {
    const adapter = await createMigratedDb();
    const plan = await adapter.all<{ detail: string }>(
      "EXPLAIN QUERY PLAN SELECT * FROM game_sessions WHERE game_id = 'memory' ORDER BY completed_at DESC LIMIT 50",
    );
    expect(plan.some((r) => r.detail.includes('idx_game_sessions_game_id'))).toBe(true);
  });

  it('the activity-date scan stays covered by idx_game_sessions_completed_at', async () => {
    const adapter = await createMigratedDb();
    const plan = await adapter.all<{ detail: string }>(
      "EXPLAIN QUERY PLAN SELECT DISTINCT DATE(completed_at / 1000, 'unixepoch', 'localtime') as date FROM game_sessions ORDER BY date DESC",
    );
    expect(plan.some((r) => r.detail.includes('COVERING INDEX idx_game_sessions_completed_at'))).toBe(
      true,
    );
  });
});

describe('foreign keys and uniqueness constraints', () => {
  it('rejects ledger entries referencing a non-existent session', async () => {
    const adapter = await createMigratedDb();
    await expect(
      adapter.run(
        "INSERT INTO currency_ledger (amount, reason, session_id, created_at) VALUES (5, 'x', 'ghost', 1)",
      ),
    ).rejects.toThrow(/FOREIGN KEY|foreign key/i);
  });

  it('rejects deleting a session that ledger entries reference', async () => {
    const adapter = await createMigratedDb();
    await insertSession(adapter, 's1');
    await insertLegacyGameplayRow(adapter, 's1', 10, 100);

    await expect(adapter.run("DELETE FROM game_sessions WHERE id = 's1'")).rejects.toThrow(
      /FOREIGN KEY|foreign key/i,
    );
    // Row survived the rejected delete.
    expect(await adapter.get('SELECT id FROM game_sessions WHERE id = ?', ['s1'])).not.toBeNull();
  });

  it('enforces the partial unique index on operation_id but allows many NULLs', async () => {
    const adapter = await createMigratedDb();
    await insertSession(adapter, 's1');
    await adapter.run(
      "INSERT INTO currency_ledger (amount, reason, session_id, created_at, operation_id) VALUES (5, 'quest', NULL, 1, 'op:1')",
    );
    await expect(
      adapter.run(
        "INSERT INTO currency_ledger (amount, reason, session_id, created_at, operation_id) VALUES (6, 'quest', NULL, 2, 'op:1')",
      ),
    ).rejects.toThrow(/UNIQUE/);

    // NULL keys never collide (partial index excludes them).
    await adapter.run(
      "INSERT INTO currency_ledger (amount, reason, session_id, created_at) VALUES (1, 'a', NULL, 3)",
    );
    await adapter.run(
      "INSERT INTO currency_ledger (amount, reason, session_id, created_at) VALUES (1, 'b', NULL, 4)",
    );
    expect(await adapter.all('SELECT * FROM currency_ledger')).toHaveLength(3);
  });
});

describe('timestamp consistency under an advancing injectable clock', () => {
  it('xp award returns the timestamp that was actually stored', async () => {
    const adapter = await createMigratedDb();
    let tick = T0;
    const xp = new XpAwardsRepository(adapter, () => (tick += 1000));

    const award = await xp.award(5, 'quest', 'quest:x');
    const stored = await adapter.get<{ created_at: number }>(
      'SELECT created_at FROM xp_awards WHERE id = ?',
      [award.id],
    );
    // Old code read the clock twice: returned createdAt drifted from stored created_at.
    expect(stored?.created_at).toBe(award.createdAt);
  });

  it('profile ensureExists inserts created_at == updated_at', async () => {
    const adapter = await createMigratedDb();
    let tick = T0;
    const profile = new ProfileRepository(adapter, () => (tick += 1000));

    await profile.ensureExists();
    const row = await adapter.get<{ created_at: number; updated_at: number }>(
      'SELECT created_at, updated_at FROM profile',
    );
    expect(row?.created_at).toBe(row?.updated_at);
  });
});

describe('activity dates use the local calendar (streak convention)', () => {
  it('maps sessions to their LOCAL calendar day, matching the streak engine', async () => {
    const adapter = await createMigratedDb();
    // Two instants on opposite sides of LOCAL midnight (yesterday 23:59 / today 00:01).
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const before = midnight.getTime() - 60_000;
    const after = midnight.getTime() + 60_000;
    await insertSession(adapter, 't_before', before);
    await insertSession(adapter, 't_after', after);

    const sessions = new SessionRepository(adapter);
    const dates = await sessions.getDistinctActivityDates();

    // Newest first, and equal to the JS local calendar dates of the instants.
    // The pre-fix query derived UTC dates, which disagree with the local
    // calendar whenever the host timezone offset is non-zero.
    expect(dates).toEqual([localDate(after), localDate(before)]);
    expect(await sessions.getDistinctActivityDateCount()).toBe(2);
  });
});
