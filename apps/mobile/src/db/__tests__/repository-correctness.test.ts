/**
 * Campaign 011 W11 — repository correctness (integration, real better-sqlite3).
 *
 * Covers the packet's repository matrix that no existing suite pinned:
 * - keyset pagination (`pageSummaries`): complete, duplicate-free walks under
 *   HEAVILY tied sort keys, plus offset-paging parity with `listSummaries`;
 *   the same walk contract for `RatingRepository.getHistoryWindowed`.
 * - `executeBatch`: real-DB commit aggregation, all-or-nothing rollback under
 *   a mid-batch failure, and the documented no-nesting contract when called
 *   inside an open transaction.
 * - `getSessionWindowAggregate` / `countSessions`: pushdown equality against a
 *   plain-JS reference on a seeded deterministic pseudo-random fixture.
 * - `listByIds`: caller-order preservation with missing ids, dedup, and
 *   multi-chunk (> SQL_VARIABLE_CHUNK) id lists.
 * - `getDailySessionCounts`: UTC vs LOCAL day-boundary conventions each match
 *   their JS reference; default boundary is 'utc'.
 * - Malformed historic JSON blobs never break the SQL-side projection reads
 *   (json_valid guard) and degrade to null metric scalars.
 */

import { describe, expect, it } from '@jest/globals';
import type { SQLiteAdapter } from '../adapter';
import { RatingRepository } from '../rating';
import { SessionRepository } from '../sessions';
import type { WindowedSessionAggregate } from '../sessions';
import { executeBatch } from '../batch';
import { SQL_VARIABLE_CHUNK } from '../query';
import { createMigratedDb } from './helpers';

const T0 = 1_700_000_000_000;

interface SeedRow {
  id: string;
  gameId: string;
  xp: number;
  normalizedResult: number;
  durationMs: number;
  completedAt: number;
}

/** Raw-insert one session row (fast bulk seeding; bypasses repository writes). */
async function insertSessionRow(adapter: SQLiteAdapter, row: SeedRow, startedAt?: number): Promise<void> {
  await adapter.run(
    `INSERT INTO game_sessions (
      id, game_id, game_version, generator_version, scoring_version, seed,
      difficulty_json, raw_result_json, normalized_result, xp,
      started_at, completed_at, duration_ms
    ) VALUES (?, ?, 1, 1, 1, 42, '{}', '{}', ?, ?, ?, ?, ?)`,
    [row.id, row.gameId, row.normalizedResult, row.xp, startedAt ?? row.completedAt - 1000, row.completedAt, row.durationMs],
  );
}

/** Deterministic LCG so randomized fixtures are reproducible run-to-run. */
function makeLcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/** YYYY-MM-DD key in UTC (mirrors the analytics calendar convention). */
function utcDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** YYYY-MM-DD key in the device-local calendar (streak engine convention). */
function localDateKey(ms: number): string {
  const d = new Date(ms);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

describe('keyset pagination over tied sort keys', () => {
  /** 57 sessions sharing only FIVE distinct completed_at values. */
  async function seedTiedSessions(adapter: SQLiteAdapter): Promise<SeedRow[]> {
    const rows: SeedRow[] = [];
    for (let i = 0; i < 57; i++) {
      rows.push({
        id: `k${String(i).padStart(2, '0')}`,
        gameId: i % 2 === 0 ? 'memory' : 'math-fast-math',
        xp: 10,
        normalizedResult: 0.5,
        durationMs: 1000,
        // Heavy ties: 57 rows over 5 timestamps -> ~12-way ties per timestamp.
        completedAt: T0 + (i % 5) * 1000,
      });
    }
    await adapter.transaction(async (txn) => {
      for (const row of rows) {
        await insertSessionRow(txn, row);
      }
    });
    return rows;
  }

  /** Reference order: completed_at DESC, id DESC (the documented keyset order). */
  function expectedOrder(rows: SeedRow[]): string[] {
    return [...rows]
      .sort((a, b) => b.completedAt - a.completedAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
      .map((r) => r.id);
  }

  it('pageSummaries walks every row exactly once despite massive ties', async () => {
    const adapter = await createMigratedDb();
    const rows = await seedTiedSessions(adapter);
    const sessions = new SessionRepository(adapter);
    const want = expectedOrder(rows);

    const seen: string[] = [];
    let cursor = null as import('../sessions').SessionCursor | null;
    let pages = 0;
    for (;;) {
      const page = await sessions.pageSummaries(cursor, 8);
      pages += 1;
      seen.push(...page.items.map((s) => s.id));
      if (!page.hasMore) {
        expect(page.nextCursor).toBeNull();
        break;
      }
      expect(page.nextCursor).not.toBeNull();
      cursor = page.nextCursor;
      expect(pages).toBeLessThan(100); // runaway guard, never hit
    }

    expect(seen).toEqual(want); // no skips, no dupes, deterministic tie-break
    expect(pages).toBe(Math.ceil(57 / 8));
    await adapter.close();
  });

  it('offset paging (listSummaries) produces the same sequence as the keyset walk', async () => {
    const adapter = await createMigratedDb();
    const rows = await seedTiedSessions(adapter);
    const sessions = new SessionRepository(adapter);
    const want = expectedOrder(rows);

    const offsetPaged: string[] = [];
    for (let offset = 0; ; offset += 8) {
      const page = await sessions.listSummaries({ limit: 8, offset });
      offsetPaged.push(...page.map((s) => s.id));
      if (page.length < 8) break;
    }
    expect(offsetPaged).toEqual(want);

    // Ascending order mirrors the descending reference.
    const asc = await sessions.listSummaries({ limit: 10000, order: 'asc' });
    expect(asc.map((s) => s.id)).toEqual([...want].reverse());
    await adapter.close();
  });

  it('getHistoryWindowed paginates deterministically over equal created_at values', async () => {
    const adapter = await createMigratedDb();
    // 23 history rows sharing THREE created_at values (FK parent sessions first).
    await adapter.transaction(async (txn) => {
      for (let i = 0; i < 23; i++) {
        if (i < 3) {
          await insertSessionRow(txn, { id: `h${i}`, gameId: 'memory', xp: 0, normalizedResult: 0.5, durationMs: 1, completedAt: T0 });
        }
      }
      for (let i = 0; i < 23; i++) {
        await txn.run(
          'INSERT INTO rating_history (session_id, domain, delta, rating_after, created_at) VALUES (?, ?, ?, ?, ?)',
          [`h${i % 3}`, 'Memory', 1, 1000 + i, T0 + (i % 3) * 1000],
        );
      }
    });

    const ratings = new RatingRepository(adapter);
    const walked: number[] = [];
    let offset = 0;
    for (;;) {
      const page = await ratings.getHistoryWindowed({ limit: 5, offset });
      walked.push(...page.map((e) => e.id));
      if (page.length < 5) break;
      offset += 5;
    }
    // Tie-break is id DESC within equal created_at; overall newest first.
    const all = await ratings.getHistoryWindowed({ limit: 10000 });
    expect(all.map((e) => e.id)).toEqual(walked);
    expect(new Set(walked).size).toBe(23);
    const sortedRef = [...all].sort((a, b) =>
      b.createdAt - a.createdAt || b.id - a.id,
    );
    expect(walked).toEqual(sortedRef.map((e) => e.id));

    // Domain-filtered windows stay consistent with the unfiltered walk.
    const memoryOnly = await ratings.getHistoryWindowed({ domain: 'Memory', limit: 10000 });
    expect(memoryOnly).toHaveLength(23);
    await adapter.close();
  });
});

describe('executeBatch (real database)', () => {
  it('commits every statement and aggregates changes + final rowid', async () => {
    const adapter = await createMigratedDb();
    const outcome = await executeBatch(adapter, [
      { sql: "INSERT INTO game_favorites (game_id, created_at) VALUES ('a', 1)" },
      { sql: "INSERT INTO game_favorites (game_id, created_at) VALUES ('b', 2)" },
      { sql: "INSERT INTO game_favorites (game_id, created_at) VALUES ('c', 3)" },
    ]);
    expect(outcome.statementCount).toBe(3);
    expect(outcome.changes).toBe(3);
    const last = await adapter.get<{ rowid: number }>("SELECT rowid AS rowid FROM game_favorites WHERE game_id = 'c'");
    expect(outcome.lastInsertRowId).toBe(last?.rowid);
    expect(await adapter.all('SELECT game_id FROM game_favorites')).toHaveLength(3);
    await adapter.close();
  });

  it('rolls back the WHOLE batch when a mid-batch statement fails', async () => {
    const adapter = await createMigratedDb();
    await expect(
      executeBatch(adapter, [
        { sql: "INSERT INTO game_favorites (game_id, created_at) VALUES ('x1', 1)" },
        { sql: "INSERT INTO game_favorites (game_id, created_at) VALUES ('x2', 2)" },
        // Primary-key collision: aborts the batch...
        { sql: "INSERT INTO game_favorites (game_id, created_at) VALUES ('x1', 3)" },
        { sql: "INSERT INTO game_favorites (game_id, created_at) VALUES ('x4', 4)" },
      ]),
    ).rejects.toThrow(/UNIQUE/);

    // ...and nothing from the batch survived (all-or-nothing proof).
    expect(await adapter.all('SELECT * FROM game_favorites')).toHaveLength(0);
    await adapter.close();
  });

  it('rejects nesting inside an open transaction and leaves the outer work rolled back', async () => {
    // Pins the adapter contract ("Transactions do not nest", adapter.ts) for
    // batch callers: executeBatch must be given the ROOT adapter OUTSIDE any
    // transaction. On the node backend the inner BEGIN IMMEDIATE throws, the
    // error propagates, and the outer transaction rolls back entirely. The
    // expo backend (withExclusiveTransactionAsync) fails equivalently.
    const adapter = await createMigratedDb();
    await expect(
      adapter.transaction(async () => {
        await executeBatch(adapter, [
          { sql: "INSERT INTO game_favorites (game_id, created_at) VALUES ('n1', 1)" },
        ]);
      }),
    ).rejects.toThrow(/within a transaction/i);

    expect(await adapter.all('SELECT * FROM game_favorites')).toHaveLength(0);
    await adapter.close();
  });
});

describe('aggregate pushdown equals a JS reference on randomized fixtures', () => {
  it('matches count/sum/avg/min/max for several filter shapes', async () => {
    const adapter = await createMigratedDb();
    const rnd = makeLcg(20260821);
    const games = ['g1', 'g2', 'g3', 'g4', 'g5'];
    const rows: SeedRow[] = [];
    for (let i = 0; i < 200; i++) {
      rows.push({
        id: `r${String(i).padStart(3, '0')}`,
        gameId: games[Math.floor(rnd() * games.length)],
        xp: Math.floor(rnd() * 50),
        normalizedResult: Math.round(rnd() * 100) / 100,
        durationMs: Math.floor(rnd() * 60_000),
        completedAt: T0 + i * 3_600_000,
      });
    }
    await adapter.transaction(async (txn) => {
      for (const row of rows) {
        await insertSessionRow(txn, row);
      }
    });

    const select = (pred: (r: SeedRow) => boolean) => rows.filter(pred);
    const cases: { name: string; pred: (r: SeedRow) => boolean }[] = [
      { name: 'all sessions', pred: () => true },
      { name: 'one game', pred: (r) => r.gameId === 'g2' },
      { name: 'time window', pred: (r) => r.completedAt >= T0 + 10 * 3_600_000 && r.completedAt <= T0 + 150 * 3_600_000 },
      { name: 'normalized band', pred: (r) => r.normalizedResult >= 0.3 && r.normalizedResult <= 0.7 },
      { name: 'games + band', pred: (r) => ['g1', 'g3', 'g5'].includes(r.gameId) && r.normalizedResult >= 0.5 },
      { name: 'empty match', pred: (r) => r.gameId === 'ghost' },
    ];

    const sessions = new SessionRepository(adapter);
    for (const c of cases) {
      const matching = select(c.pred);
      const query = c.name === 'one game'
        ? { gameIds: ['g2'] }
        : c.name === 'time window'
          ? { fromMs: T0 + 10 * 3_600_000, toMs: T0 + 150 * 3_600_000 }
          : c.name === 'normalized band'
            ? { minNormalized: 0.3, maxNormalized: 0.7 }
            : c.name === 'games + band'
              ? { gameIds: ['g1', 'g3', 'g5'], minNormalized: 0.5 }
              : c.name === 'empty match'
                ? { gameIds: ['ghost'] }
                : {};

      const agg: WindowedSessionAggregate = await sessions.getSessionWindowAggregate(query);
      const expectedAgg = {
        count: matching.length,
        totalXp: matching.reduce((sum, r) => sum + r.xp, 0),
        bestNormalized: matching.length ? Math.max(...matching.map((r) => r.normalizedResult)) : 0,
        totalDurationMs: matching.reduce((sum, r) => sum + r.durationMs, 0),
        firstCompletedAt: matching.length ? Math.min(...matching.map((r) => r.completedAt)) : 0,
        lastCompletedAt: matching.length ? Math.max(...matching.map((r) => r.completedAt)) : 0,
      };
      expect(`${c.name} count`).toBe(`${c.name} count`);
      expect(agg.count).toBe(expectedAgg.count);
      expect(agg.totalXp).toBe(expectedAgg.totalXp);
      expect(agg.bestNormalized).toBeCloseTo(expectedAgg.bestNormalized, 10);
      expect(agg.totalDurationMs).toBe(expectedAgg.totalDurationMs);
      expect(agg.firstCompletedAt).toBe(expectedAgg.firstCompletedAt);
      expect(agg.lastCompletedAt).toBe(expectedAgg.lastCompletedAt);
      // AVG equality against the exact SQL definition (SUM/COUNT over REAL).
      const expectedAvg = expectedAgg.count
        ? matching.reduce((sum, r) => sum + r.normalizedResult, 0) / expectedAgg.count
        : 0;
      expect(agg.avgNormalized).toBeCloseTo(expectedAvg, 10);

      expect(await sessions.countSessions(query)).toBe(expectedAgg.count);
    }

    // Empty match reports the documented all-zero shape.
    const ghost = await sessions.getSessionWindowAggregate({ gameIds: ['ghost'] });
    expect(ghost).toEqual({
      count: 0,
      totalXp: 0,
      avgNormalized: 0,
      bestNormalized: 0,
      totalDurationMs: 0,
      firstCompletedAt: 0,
      lastCompletedAt: 0,
    });
    await adapter.close();
  });
});

describe('listByIds order, dedup, and chunk boundaries', () => {
  it('returns rows in CALLER order, dropping missing ids and duplicates', async () => {
    const adapter = await createMigratedDb();
    const sessions = new SessionRepository(adapter);
    await adapter.transaction(async (txn) => {
      for (let i = 0; i < 12; i++) {
        await insertSessionRow(txn, {
          id: `m${String(i).padStart(2, '0')}`,
          gameId: 'memory',
          xp: i,
          normalizedResult: 0.5,
          durationMs: 1000,
          completedAt: T0 + i,
        });
      }
    });

    const result = await sessions.listByIds(['m03', 'ghost', 'm07', 'm03', 'm00']);
    expect(result.map((r) => r.id)).toEqual(['m03', 'm07', 'm00']);
    expect(await sessions.listByIds([])).toEqual([]);
    expect(await sessions.listByIds(['ghost'])).toEqual([]);
    await adapter.close();
  });

  it('handles id lists larger than the per-statement variable budget', async () => {
    const adapter = await createMigratedDb();
    const sessions = new SessionRepository(adapter);
    const N = SQL_VARIABLE_CHUNK * 2 + 100; // forces 3 chunks (500/500/100)
    const ids: string[] = [];
    await adapter.transaction(async (txn) => {
      for (let i = 0; i < N; i++) {
        const id = `b${String(i).padStart(4, '0')}`;
        ids.push(id);
        await insertSessionRow(txn, {
          id,
          gameId: 'memory',
          xp: 1,
          normalizedResult: 0.5,
          durationMs: 1,
          completedAt: T0 + i,
        });
      }
    });

    // Exact chunk-edge sizes.
    expect(await sessions.listByIds(ids.slice(0, SQL_VARIABLE_CHUNK))).toHaveLength(SQL_VARIABLE_CHUNK);
    expect(await sessions.listByIds(ids.slice(0, SQL_VARIABLE_CHUNK + 1))).toHaveLength(
      SQL_VARIABLE_CHUNK + 1,
    );

    // Full multi-chunk fetch preserves caller order even reversed.
    const reversed = [...ids].reverse();
    const got = await sessions.listByIds(reversed);
    expect(got.map((r) => r.id)).toEqual(reversed);
    await adapter.close();
  });
});

describe('daily counts honor the requested day-boundary convention', () => {
  it('UTC and LOCAL groupings each match their JS reference; default is UTC', async () => {
    const adapter = await createMigratedDb();
    const sessions = new SessionRepository(adapter);

    // Instants that straddle BOTH boundaries where the host timezone allows:
    // local midnight +/- 1 minute, UTC midnight +/- 1 minute (today, UTC).
    const localMidnight = new Date();
    localMidnight.setHours(0, 0, 0, 0);
    const nowUtc = new Date();
    const utcMidnight = Date.UTC(
      nowUtc.getUTCFullYear(),
      nowUtc.getUTCMonth(),
      nowUtc.getUTCDate(),
    );
    const instants = [
      localMidnight.getTime() - 60_000,
      localMidnight.getTime() + 60_000,
      utcMidnight - 60_000,
      utcMidnight + 60_000,
      T0, // fixed ancient instant, stable anchor
    ];
    await adapter.transaction(async (txn) => {
      let n = 0;
      for (const at of instants) {
        // Two sessions on the local-midnight edge days make counts non-trivial.
        await insertSessionRow(txn, { id: `d${n++}`, gameId: 'memory', xp: 0, normalizedResult: 0.5, durationMs: 1, completedAt: at });
        await insertSessionRow(txn, { id: `d${n++}`, gameId: 'memory', xp: 0, normalizedResult: 0.5, durationMs: 1, completedAt: at });
      }
    });

    const groupBy = (keyFn: (ms: number) => string): Map<string, number> => {
      const map = new Map<string, number>();
      for (const at of instants) {
        for (const key of [keyFn(at)]) {
          map.set(key, (map.get(key) ?? 0) + 2);
        }
      }
      return map;
    };
    const toSortedRows = (map: Map<string, number>): { day: string; count: number }[] =>
      [...map.entries()].map(([day, count]) => ({ day, count })).sort((a, b) => (a.day < b.day ? 1 : -1));

    const localExpected = toSortedRows(groupBy(localDateKey));
    const utcExpected = toSortedRows(groupBy(utcDateKey));

    const localGot = await sessions.getDailySessionCounts({ dayBoundary: 'local' });
    expect(localGot).toEqual(localExpected);

    const utcGot = await sessions.getDailySessionCounts({ dayBoundary: 'utc' });
    expect(utcGot).toEqual(utcExpected);

    // Omitted boundary defaults to the analytics (UTC) calendar.
    expect(await sessions.getDailySessionCounts()).toEqual(utcGot);

    await expect(
      sessions.getDailySessionCounts({ dayBoundary: 'solstice' as never }),
    ).rejects.toThrow(/dayBoundary/);
    await adapter.close();
  });
});

describe('malformed stored JSON never breaks projection reads', () => {
  it('scalar projections, aggregates, day counts, and the JSON1 progress projection survive corrupt blobs', async () => {
    const adapter = await createMigratedDb();
    const sessions = new SessionRepository(adapter);
    await insertSessionRow(adapter, {
      id: 'p_good',
      gameId: 'memory',
      xp: 20,
      normalizedResult: 0.8,
      durationMs: 2000,
      completedAt: T0,
    });
    // Overwrite the good row's blobs with rich JSON, then add a corrupt row.
    await adapter.run("UPDATE game_sessions SET difficulty_json = '{\"level\":\"hard\"}', raw_result_json = '{\"score\":120,\"accuracy\":0.9}' WHERE id = 'p_good'");
    await adapter.run(
      `INSERT INTO game_sessions (
        id, game_id, game_version, generator_version, scoring_version, seed,
        difficulty_json, raw_result_json, normalized_result, xp,
        started_at, completed_at, duration_ms
      ) VALUES ('p_bad', 'memory', 1, 1, 1, 42, '{nope', '[also bad', 0.5, 10, ?, ?, 1000)`,
      [T0 + 1000, T0 + 2000],
    );

    // Scalar projections: corrupt blobs are simply not parsed (columns are scalar).
    const summaries = await sessions.listSummaries({ limit: 10 });
    expect(summaries.map((s) => s.id)).toEqual(['p_bad', 'p_good']);

    const page = await sessions.pageSummaries(null, 1);
    expect(page.items).toHaveLength(1);
    expect(page.hasMore).toBe(true);

    const agg = await sessions.getSessionWindowAggregate({});
    expect(agg.count).toBe(2);
    expect(await sessions.getDailySessionCounts()).toHaveLength(1);

    // JSON1 progress projection: corrupt blobs degrade to null metrics
    // (json_valid guard); the well-formed row extracts its scalars.
    const projected = await sessions.listProgressProjection(10);
    const bad = projected.find((r) => r.id === 'p_bad');
    expect(bad).toBeDefined();
    expect([bad?.mScore, bad?.mAccuracy, bad?.mReactionMs, bad?.mDifficultyRating, bad?.mDifficultyLevel]).toEqual([
      null, null, null, null, null,
    ]);
    const good = projected.find((r) => r.id === 'p_good');
    expect(good?.mScore).toBe(120);
    expect(good?.mAccuracy).toBe(0.9);
    expect(good?.mDifficultyLevel).toBe('hard');

    const byGame = await sessions.listProgressProjectionByGame('memory', 10);
    expect(byGame).toHaveLength(2);
    await adapter.close();
  });
});
