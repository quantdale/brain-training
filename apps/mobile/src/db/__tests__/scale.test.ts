/**
 * Scale / performance tests (task G): the local store must stay responsive as
 * history grows. These assert the v8 `idx_game_sessions_completed_at` index
 * exists and that the most common read paths stay fast with thousands of rows.
 * Timing bounds are intentionally generous (CI variance) — the point is to catch
 * gross regressions, not to pin microseconds.
 */

import { describe, expect, it } from '@jest/globals';
import type { SQLiteAdapter } from '../adapter';
import type { SQLiteValue } from '../types';
import { createMigratedDb } from './helpers';
import { SessionRepository } from '../sessions';
import { RatingRepository } from '../rating';
import { LedgerRepository } from '../ledger';
import { AppDatabase } from '../index';
import { exportLocalData } from '../../data-portability';

const T0 = 1_700_000_000_000;
const N = 3000;

async function seedLargeHistory(adapter: SQLiteAdapter): Promise<void> {
  await adapter.run("INSERT INTO profile (id, display_name, settings_json, created_at, updated_at) VALUES ('local','t','{}',?,?)", [T0, T0]);
  // Batch inserts for speed.
  const sessionValues: SQLiteValue[] = [];
  const ledgerValues: SQLiteValue[] = [];
  const historyValues: SQLiteValue[] = [];
  const ratingValues: SQLiteValue[] = [];
  for (let i = 0; i < N; i++) {
    const done = T0 + i * 1000;
    sessionValues.push(`s${i}`, 'memory', 1, 1, 1, i, '{}', '{}', 0.5 + (i % 5) * 0.1, 50, T0 + i * 500, done, 1000);
    ledgerValues.push(50, 'gameplay', `s${i}`, done, `gameplay:s${i}`);
    historyValues.push(`s${i}`, 'Memory', 5, 1000 + i, done);
    ratingValues.push('Memory', 1000 + i, i + 1, done);
  }
  // Use a single transaction with many bound rows via exec of compiled statements.
  await adapter.transaction(async (txn) => {
    const insS = await txn.run.bind(txn);
    void insS;
    for (let i = 0; i < N; i++) {
      await txn.run(
        'INSERT INTO game_sessions (id, game_id, game_version, generator_version, scoring_version, seed, difficulty_json, raw_result_json, normalized_result, xp, started_at, completed_at, duration_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [sessionValues[i * 13], sessionValues[i * 13 + 1], sessionValues[i * 13 + 2], sessionValues[i * 13 + 3], sessionValues[i * 13 + 4], sessionValues[i * 13 + 5], sessionValues[i * 13 + 6], sessionValues[i * 13 + 7], sessionValues[i * 13 + 8], sessionValues[i * 13 + 9], sessionValues[i * 13 + 10], sessionValues[i * 13 + 11], sessionValues[i * 13 + 12]],
      );
      await txn.run('INSERT INTO currency_ledger (amount, reason, session_id, created_at, operation_id) VALUES (?,?,?,?,?)', [ledgerValues[i * 5], ledgerValues[i * 5 + 1], ledgerValues[i * 5 + 2], ledgerValues[i * 5 + 3], ledgerValues[i * 5 + 4]]);
      await txn.run('INSERT INTO rating_history (session_id, domain, delta, rating_after, created_at) VALUES (?,?,?,?,?)', [historyValues[i * 5], historyValues[i * 5 + 1], historyValues[i * 5 + 2], historyValues[i * 5 + 3], historyValues[i * 5 + 4]]);
      await txn.run('INSERT INTO domain_ratings (domain, rating, sessions, updated_at) VALUES (?,?,?,?) ON CONFLICT(domain) DO UPDATE SET rating=excluded.rating, sessions=excluded.sessions, updated_at=excluded.updated_at', [ratingValues[i * 4], ratingValues[i * 4 + 1], ratingValues[i * 4 + 2], ratingValues[i * 4 + 3]]);
    }
  });
}

function time<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
  return (async () => {
    const start = Date.now();
    const value = await fn();
    return { ms: Date.now() - start, value };
  })();
}

describe('scale / performance (task G)', () => {
  it('creates the game_sessions(completed_at) index in v8', async () => {
    const adapter = await createMigratedDb();
    const rows = await adapter.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_game_sessions_completed_at'",
    );
    expect(rows).toHaveLength(1);
  });

  it('keeps core read paths responsive with 3000 sessions', async () => {
    const adapter = await createMigratedDb();
    await seedLargeHistory(adapter);
    const sessions = new SessionRepository(adapter);
    const ratings = new RatingRepository(adapter);
    const ledger = new LedgerRepository(adapter);
    const db = new AppDatabase(adapter);

    const recent = await time(() => sessions.listRecent(50));
    expect(recent.value).toHaveLength(50);
    expect(recent.ms).toBeLessThan(4000);

    const agg = await time(() => sessions.getAggregates());
    expect(agg.value.length).toBeGreaterThan(0);
    expect(agg.ms).toBeLessThan(4000);

    const hist = await time(() => ratings.getHistory(100));
    expect(hist.value).toHaveLength(100);
    expect(hist.ms).toBeLessThan(4000);

    const dates = await time(() => sessions.getDistinctActivityDates());
    expect(dates.value.length).toBeGreaterThan(0);
    expect(dates.ms).toBeLessThan(4000);

    const bal = await time(() => ledger.getBalance());
    expect(bal.value).toBe(N * 50);
    expect(bal.ms).toBeLessThan(4000);

    // A full export of the large history must complete without hanging.
    const exp = await time(() => exportLocalData(db, { now: () => T0 + 1 }));
    expect(exp.value.data.gameSessions.length).toBe(N);
    expect(exp.ms).toBeLessThan(8000);
  });
});
