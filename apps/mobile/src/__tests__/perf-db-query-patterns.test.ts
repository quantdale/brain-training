/**
 * Performance guards — SQLite query patterns (campaign 009 W13).
 *
 * These are deterministic regression guards, not benchmarks: they pin the
 * query-shape contracts that keep screen load costs independent of history
 * size. Timing-sensitive measurements live in the opt-in probe suite
 * (`perf-baseline-probe.test.ts`, run via `scripts/perf/run-probes.mjs`).
 *
 * Contracts guarded here:
 * 1. Snapshot loaders issue a FIXED statement count — no N+1 as history grows.
 * 2. Quest/achievement evaluation reads projection columns only (never the
 *    per-session JSON blobs) — the §F scalability contract.
 * 3. History reads honor their LIMIT (no accidental unbounded scans).
 * 4. `listLightweight` really is lightweight (projection keys only).
 * 5. Distinct-activity-day reads return one row per active day (the cheap
 *    streak input used by Home).
 */
import { describe, expect, it } from '@jest/globals';

import type { SQLiteAdapter } from '@/db';
import { AppDatabase } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import {
  loadProgressSnapshot,
} from '@/analytics/queries';
import {
  buildAchievementSnapshot,
  buildQuestSamples,
} from '@/progression/sync';

/** Statement recorder wrapped around any adapter (counts reads AND writes). */
function instrument(adapter: SQLiteAdapter): {
  adapter: SQLiteAdapter;
  statements: { op: string; sql: string }[];
} {
  const statements: { op: string; sql: string }[] = [];
  const wrapped: SQLiteAdapter = {
    async exec(sql) {
      statements.push({ op: 'exec', sql });
      return adapter.exec(sql);
    },
    async run(sql, params) {
      statements.push({ op: 'run', sql });
      return adapter.run(sql, params);
    },
    async get(sql, params) {
      statements.push({ op: 'get', sql });
      return adapter.get(sql, params);
    },
    async all(sql, params) {
      statements.push({ op: 'all', sql });
      return adapter.all(sql, params);
    },
    transaction: (fn) => adapter.transaction(fn),
    close: () => adapter.close(),
  };
  return { adapter: wrapped, statements };
}

const DIFFICULTY_BLOB = JSON.stringify({
  level: 'normal',
  rounds: 5,
  gridSize: 16,
  targetCells: 4,
  studyMs: 1800,
});
const RAW_RESULT_BLOB = JSON.stringify({
  schemaVersion: 1,
  gameVersion: 1,
  generatorVersion: 1,
  scoringVersion: 1,
  difficulty: 'normal',
  seed: '123456',
  stats: {
    score: 320,
    roundsPlayed: 5,
    roundsPassed: 4,
    bestRecall: 4,
    bestStreak: 3,
    wrongTaps: 2,
  },
  timing: { startedAtMs: 0, activeDurationMs: 95000, pausedDurationMs: 1200 },
});

/** Insert `count` realistic session rows starting at `start`. */
async function seedSessions(
  adapter: SQLiteAdapter,
  count: number,
  start: number,
  gameIds: readonly string[] = ['memory-grid-recall', 'math-fast-math'],
): Promise<void> {
  const insert = `INSERT INTO game_sessions (
      id, game_id, game_version, generator_version, scoring_version, seed,
      difficulty_json, raw_result_json, normalized_result, xp,
      started_at, completed_at, duration_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  for (let i = start; i < start + count; i++) {
    await adapter.run(insert, [
      `sess-${i}`,
      gameIds[i % gameIds.length],
      1,
      1,
      1,
      1000 + i,
      DIFFICULTY_BLOB,
      RAW_RESULT_BLOB,
      0.4 + ((i % 6) / 10),
      10 + (i % 20),
      i * 1000,
      i * 1000 + 500,
      30_000 + (i % 7) * 1000,
    ]);
  }
}

describe('perf: snapshot loaders are O(1) in statement count', () => {
  it('loadProgressSnapshot issues the same small statement count at 10 and 310 sessions', async () => {
    const base = await createMigratedDb();
    await seedSessions(base, 10, 0);

    const small = instrument(base);
    const appSmall = new AppDatabase(small.adapter);
    await loadProgressSnapshot(appSmall);
    const smallCount = small.statements.length;

    // Grow the history 30x — the loader must not grow a per-row or per-game
    // query loop (N+1 guard).
    await seedSessions(base, 300, 10);

    const large = instrument(base);
    const appLarge = new AppDatabase(large.adapter);
    await loadProgressSnapshot(appLarge);
    const largeCount = large.statements.length;

    expect(largeCount).toBe(smallCount);
    // The loader is one Promise.all over six repository reads; allow a small
    // constant overhead but never per-row work.
    expect(smallCount).toBeLessThanOrEqual(8);
  });

  it('buildQuestSamples + buildAchievementSnapshot stay flat as history grows', async () => {
    const base = await createMigratedDb();
    await seedSessions(base, 10, 0);
    const small = instrument(base);
    await buildQuestSamples(new AppDatabase(small.adapter));
    await buildAchievementSnapshot(new AppDatabase(small.adapter));
    const smallCount = small.statements.length;

    await seedSessions(base, 300, 10);
    const large = instrument(base);
    await buildQuestSamples(new AppDatabase(large.adapter));
    await buildAchievementSnapshot(new AppDatabase(large.adapter));

    expect(large.statements.length).toBe(smallCount);
  });

  it('quest/achievement evaluation never reads session JSON blob columns', async () => {
    const base = await createMigratedDb();
    await seedSessions(base, 40, 0);
    const rec = instrument(base);
    const db = new AppDatabase(rec.adapter);

    await buildQuestSamples(db);
    await buildAchievementSnapshot(db);

    const blobReads = rec.statements.filter(
      (s) =>
        (s.op === 'all' || s.op === 'get') &&
        /raw_result_json|difficulty_json/i.test(s.sql),
    );
    expect(blobReads).toEqual([]);
  });
});

describe('perf: history reads honor their LIMIT', () => {
  it('listRecent / listByGame / ledger.list / ratings.getHistory return at most their limit', async () => {
    const base = await createMigratedDb();
    await seedSessions(base, 30, 0);

    // Extra rows for the ledger/history limit checks.
    for (let i = 0; i < 12; i++) {
      await base.run(
        'INSERT INTO currency_ledger (amount, reason, session_id, created_at) VALUES (?, ?, ?, ?)',
        [5, 'gameplay', `sess-${i}`, i * 100],
      );
      await base.run(
        'INSERT INTO rating_history (session_id, domain, delta, rating_after, created_at) VALUES (?, ?, ?, ?, ?)',
        [`sess-${i}`, 'Memory', 2, 500 + i, i * 100],
      );
    }

    const db = new AppDatabase(base);
    expect((await db.sessions.listRecent(10)).length).toBe(10);
    expect((await db.sessions.listByGame('memory-grid-recall', 5)).length).toBe(5);
    expect((await db.ledger.list(5)).length).toBe(5);
    expect((await db.ratings.getHistory(7)).length).toBe(7);
  });

  it('listLightweight returns projection rows only (no JSON blobs materialized)', async () => {
    const base = await createMigratedDb();
    await seedSessions(base, 8, 0);
    const db = new AppDatabase(base);

    const rows = await db.sessions.listLightweight(100);
    expect(rows.length).toBe(8);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(['completedAt', 'gameId', 'xp']);
    }
  });

  it('getDistinctActivityDates returns one row per active day, not per session', async () => {
    const base = await createMigratedDb();
    // 12 sessions across 3 distinct UTC days (day boundaries at 86_400_000 ms;
    // SQLite DATE(...,'unixepoch') is UTC-based).
    const dayMs = 86_400_000;
    const dayZero = Date.UTC(2026, 0, 10);
    const insert = `INSERT INTO game_sessions (
        id, game_id, game_version, generator_version, scoring_version, seed,
        difficulty_json, raw_result_json, normalized_result, xp,
        started_at, completed_at, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    for (let i = 0; i < 12; i++) {
      const completedAt = dayZero + Math.floor(i / 4) * dayMs + 3_600_000;
      await base.run(insert, [
        `day-${i}`,
        'memory-grid-recall',
        1,
        1,
        1,
        i,
        '{}',
        '{}',
        0.5,
        10,
        completedAt - 60_000,
        completedAt,
        60_000,
      ]);
    }
    const db = new AppDatabase(base);
    const dates = await db.sessions.getDistinctActivityDates();
    expect(dates.length).toBe(3);
    expect(dates).toEqual(['2026-01-12', '2026-01-11', '2026-01-10']);
  });
});
