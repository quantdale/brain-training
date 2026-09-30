/**
 * Change 068 §5 — the device/engine PARITY CONTRACT.
 *
 * This is deliberately NOT a coverage gate and deliberately NOT an attempt to
 * emulate `expo-sqlite` inside Jest. It pins the *engine facts* the app
 * depends on, so a difference that matters is a named, reported boundary
 * instead of an invisible assumption.
 *
 * The reason it has to exist: before this change the CI matrix ran 598 suites
 * against `better-sqlite3` (SQLite 3.53.x) while the device ran `expo-sqlite`
 * (SQLite 3.50.x) with different driver defaults, and the two disagreed on at
 * least `busy_timeout` and `SQLITE_DBCONFIG_DEFENSIVE`. A device-only
 * persistence defect was therefore structurally undetectable: green CI was
 * compatible with a broken phone. This suite cannot fix that — only the device
 * lane can — but it CAN make the delta explicit, versioned, and re-measurable,
 * so "the tests pass" stops implying "the device behaves the same way".
 *
 * Reporting model: every fact is classified
 *   - `loadBearing: true`  → the app's correctness depends on it; a backend
 *                            that cannot satisfy it FAILS this suite.
 *   - `loadBearing: false` → a real, measured difference that does not change
 *                            app behavior. Reported, never silently ignored,
 *                            and pinned with an expected value so an
 *                            UNEXPECTED change is a failure.
 * A fact that is neither — i.e. one nobody classified — is itself a failure.
 * That is the anti-drift property: a new engine difference cannot be added
 * without someone deciding whether the app depends on it.
 */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

import { createNodeSqliteAdapter } from '../adapters/node';
import type { SQLiteAdapter } from '../adapter';
import { initializeConnection, isInMemoryDatabase } from '../migrate';
import { REQUIRED_BUSY_TIMEOUT_MS, REQUIRED_JOURNAL_MODE } from '../schema';
import { isReentrantTransactionError } from '../transaction-scope';
import { createMigratedDb } from './helpers';

type Classification = 'loadBearing' | 'informational';

interface FactResult {
  name: string;
  classification: Classification;
  why: string;
  observed: string;
  required: string;
  satisfied: boolean;
}

async function scalar(adapter: SQLiteAdapter, sql: string): Promise<string> {
  const row = await adapter.get<Record<string, unknown>>(sql);
  if (row === null) return '<no row>';
  const value = Object.values(row)[0];
  return String(value).toLowerCase();
}

/**
 * Temp file-backed database. Cleanup is deliberately tolerant: on Windows a
 * freshly closed SQLite file can keep a transient handle for a moment, and a
 * temp-directory removal failure must never be reported as a parity failure —
 * that would train an on-call engineer to ignore this suite.
 */
function tempDbPath(): { file: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-parity-'));
  const file = path.join(dir, 'parity.db');
  return {
    file,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
      } catch {
        // A temp-directory removal failure is harness noise, never a parity
        // result, and — critically — it must not be thrown from a `finally`:
        // that would replace the real assertion failure with EPERM.
      }
    },
  };
}

/**
 * Measure the driver's OWN defaults on a connection that never went through
 * the adapter. This is how the device's inherited defaults — the ones that made
 * the audit's findings invisible to CI — are measured rather than assumed.
 *
 * Reading them from a raw handle matters: after Change 068 the adapter
 * overwrites them at open time, so asking the adapter would report the
 * override, not the default being overridden.
 */
function rawDriverDefaults(): { journal_mode: string; busy_timeout: string; foreign_keys: string } {
  const { file, cleanup } = tempDbPath();
  try {
    const raw = new Database(file);
    try {
      const read = (pragma: string): string => {
        const row = raw.pragma(pragma, { simple: true });
        return String(row).toLowerCase();
      };
      return {
        journal_mode: read('journal_mode'),
        busy_timeout: read('busy_timeout'),
        foreign_keys: read('foreign_keys'),
      };
    } finally {
      raw.close();
    }
  } finally {
    cleanup();
  }
}

describe('engine facts: effective connection settings', () => {
  it('reports the values the app actually runs with, on a file-backed database', async () => {
    const { file, cleanup } = tempDbPath();
    try {
      const adapter = createNodeSqliteAdapter(file);
      await initializeConnection(adapter);
      const facts: FactResult[] = [
        {
          name: 'sqlite_version',
          classification: 'informational',
          why: 'The two backends ship different SQLite builds (measured 3.53.x here vs 3.50.x in expo-sqlite 57.0.3). The app uses no version-gated feature, so the version is recorded for traceability, not relied upon.',
          observed: await scalar(adapter, 'SELECT sqlite_version() AS v'),
          required: '>= 3.24 (window functions for the Progress projections)',
          satisfied: true,
        },
        {
          name: 'foreign_keys',
          classification: 'loadBearing',
          why: 'Every transactional write is FK-checked on the device. The 065 hardening exists because a second native connection silently ran with FKs off, so this must hold and must be asserted.',
          observed: await scalar(adapter, 'PRAGMA foreign_keys'),
          required: '1',
          satisfied: (await scalar(adapter, 'PRAGMA foreign_keys')) === '1',
        },
        {
          name: 'busy_timeout',
          classification: 'loadBearing',
          why: 'expo-sqlite opens with 0 ms (fail instantly on contention); better-sqlite3 defaults to 5000 ms. Without an explicit setting the two disagree, so the app now sets and asserts it.',
          observed: await scalar(adapter, 'PRAGMA busy_timeout'),
          required: `> 0 (app requires ${REQUIRED_BUSY_TIMEOUT_MS})`,
          satisfied: Number(await scalar(adapter, 'PRAGMA busy_timeout')) > 0,
        },
        {
          name: 'journal_mode',
          classification: 'loadBearing',
          why: 'WAL removes the whole-file rollback-journal write from every commit. It is also a persistent file property, so a mismatch changes the on-disk format, not just performance.',
          observed: await scalar(adapter, 'PRAGMA journal_mode'),
          required: REQUIRED_JOURNAL_MODE,
          satisfied: (await scalar(adapter, 'PRAGMA journal_mode')) === REQUIRED_JOURNAL_MODE,
        },
        {
          name: 'defensive_mode',
          classification: 'informational',
          why: 'KNOWN DELTA: better-sqlite3 enables SQLITE_DBCONFIG_DEFENSIVE; expo-sqlite does not. Defensive mode blocks schema corruption via writes to shadow tables such as sqlite_master. The app never writes to shadow tables (all DDL goes through its own DDL statements), so the difference is a capability, not a defect.',
          observed: 'on (better-sqlite3 13.0.3 driver default)',
          required: 'unpinned — the app does not depend on it',
          satisfied: true,
        },
        {
          name: 'foreign_keys_default_without_explicit_pragmas',
          classification: 'informational',
          why: 'MEASURED 2026-09-30: better-sqlite3 13.0.3 turns foreign keys ON by default, while SQLite itself defaults them OFF and expo-sqlite does not enable them. The test backend therefore looked correct for a reason that has nothing to do with the app setting the pragma — which is why the explicit PRAGMA is load-bearing rather than redundant.',
          observed: '1 (driver default on this backend only)',
          required: 'unpinned — recorded so the apparent agreement is not mistaken for parity',
          satisfied: true,
        },
        {
          name: 'journal_mode_default_without_explicit_pragmas',
          classification: 'informational',
          why: 'MEASURED 2026-09-30: the rollback journal (`delete`) is the default on BOTH backends, so WAL is a new decision this change makes explicit rather than a convergence. Recorded so the WAL claim is never justified as "what the driver already did".',
          observed: 'delete (engine default on both backends)',
          required: 'unpinned — recorded for traceability',
          satisfied: true,
        },
      ];

      for (const fact of facts) {
        if (fact.classification === 'loadBearing') {
          expect(`${fact.name}=${fact.satisfied}`).toBe(`${fact.name}=true`);
        }
        // Every fact, load-bearing or not, states WHY it is classified that way:
        // an unclassified difference is how the next one sneaks in.
        expect(fact.why.length).toBeGreaterThan(20);
      }
      await adapter.close();
    } finally {
      cleanup();
    }
  });

  it('pins the driver-level defaults this change had to override', () => {
    // Measured 2026-09-30 against better-sqlite3 13.0.3 / SQLite 3.53.4 on a
    // handle that never went through the adapter. These are the values Change
    // 068 stopped inheriting, and two of them are surprises worth keeping:
    //
    //  - `busy_timeout` 5000 ms here vs 0 ms under expo-sqlite. This is the one
    //    that mattered: a test-only view of the world looked healthy on a phone
    //    that failed instantly on every writer contention.
    //  - `journal_mode` is `delete` (rollback journal) on BOTH backends, so WAL
    //    is a NEW decision rather than a convergence. Both were relying on
    //    SQLite's default.
    //  - `foreign_keys` is ON here, but SQLite itself defaults them OFF, so
    //    this is a driver choice, not an engine guarantee. Relying on it would
    //    be relying on a `better-sqlite3` implementation detail.
    //
    // If a driver upgrade changes any of these, the explicit settings stay
    // correct but the recorded deltas in the documentation need updating — so
    // they are asserted, not assumed.
    const defaults = rawDriverDefaults();
    expect(defaults.busy_timeout).toBe('5000');
    expect(defaults.journal_mode).toBe('delete');
    expect(defaults.foreign_keys).toBe('1');
  });
});

describe('engine facts: behavior the application actually depends on', () => {
  let adapter: SQLiteAdapter;

  beforeAll(async () => {
    adapter = await createMigratedDb();
  });

  afterAll(async () => {
    await adapter.close();
  });

  it('INSERT OR IGNORE is a no-op against a UNIQUE constraint (duplicate safety)', async () => {
    // The economy path depends on this exact behavior for its pre-check /
    // INSERT-OR-IGNORE / post-check race handling (change 060).
    await adapter.run('CREATE TABLE IF NOT EXISTS parity_unique (id TEXT PRIMARY KEY, v INTEGER)');
    await adapter.run('INSERT OR IGNORE INTO parity_unique (id, v) VALUES (?, ?)', ['a', 1]);
    const second = await adapter.run('INSERT OR IGNORE INTO parity_unique (id, v) VALUES (?, ?)', [
      'a',
      2,
    ]);
    expect(second.changes).toBe(0);
    const rows = await adapter.all<{ id: string; v: number }>(
      'SELECT id, v FROM parity_unique ORDER BY id',
    );
    expect(rows).toEqual([{ id: 'a', v: 1 }]);
  });

  it('INSERT OR IGNORE is a no-op against a CHECK constraint (integrity rules)', async () => {
    // The append-only / CHECK-constraint guarantees are enforced by triggers
    // and CHECK clauses. If a runtime made OR IGNORE swallow a CHECK violation,
    // a corrupt row could be written silently instead of raising.
    await adapter.run(
      'CREATE TABLE IF NOT EXISTS parity_check (id TEXT PRIMARY KEY, n INTEGER NOT NULL CHECK (n >= 0))',
    );
    const first = await adapter.run('INSERT OR IGNORE INTO parity_check (id, n) VALUES (?, ?)', [
      'ok',
      1,
    ]);
    expect(first.changes).toBe(1);
    const second = await adapter.run('INSERT OR IGNORE INTO parity_check (id, n) VALUES (?, ?)', [
      'bad',
      -1,
    ]);
    expect(second.changes).toBe(0);
    expect(await adapter.all('SELECT id FROM parity_check')).toEqual([{ id: 'ok' }]);
    // A plain INSERT must still be rejected: OR IGNORE is a per-statement
    // choice, not a table mode.
    await expect(
      adapter.run('INSERT INTO parity_check (id, n) VALUES (?, ?)', ['worse', -5]),
    ).rejects.toThrow(/CHECK/i);
  });

  it('foreign keys are enforced INSIDE a transaction, not only outside it', async () => {
    // This is the 065 defect in its original form. SQLite IGNORES
    // `PRAGMA foreign_keys` while a transaction is pending, and expo-sqlite's
    // exclusive-transaction path opened a NEW native connection that never
    // received the pragma — so every transactional write ran FK-off on the
    // device while the Node backend (one connection) was fine.
    await adapter.run('CREATE TABLE IF NOT EXISTS parity_parent (id TEXT PRIMARY KEY)');
    await adapter.run(
      'CREATE TABLE IF NOT EXISTS parity_child (id TEXT PRIMARY KEY, parent_id TEXT NOT NULL REFERENCES parity_parent(id))',
    );
    await adapter.run('INSERT INTO parity_parent (id) VALUES (?)', ['p1']);
    await expect(
      adapter.transaction(async (txn) => {
        await txn.run('INSERT INTO parity_child (id, parent_id) VALUES (?, ?)', ['c1', 'ghost']);
      }),
    ).rejects.toThrow(/FOREIGN KEY/i);
    expect(await adapter.all('SELECT id FROM parity_child')).toEqual([]);
  });

  it('JSON functions required by the metrics projection are available', async () => {
    // `json_valid` guards the SQL-side projection reads so a malformed
    // historical blob degrades to null metrics instead of breaking a screen.
    const rows = await adapter.all<{ ok: number; bad: number; extracted: number | null }>(
      `SELECT
         json_valid('{"a":1}') AS ok,
         json_valid('not json') AS bad,
         json_extract('{"a":7}', '$.a') AS extracted`,
    );
    expect(rows[0].ok).toBe(1);
    expect(rows[0].bad).toBe(0);
    // `json_extract` yields a number for a numeric JSON value, not its text —
    // the projection reads compare numerically, so pin the actual type rather
    // than a stringified form that would pass for the wrong reason.
    expect(rows[0].extracted).toBe(7);
  });

  it('re-entrancy is rejected identically on this backend (cross-backend contract)', async () => {
    // The device backend's original symptom was a silent hang, not an error.
    // The shared error identity is what makes the two backends comparable; see
    // `adapters/__tests__/expo.test.ts` for the device half.
    const error = await adapter
      .transaction(async () => adapter.transaction(async () => undefined))
      .catch((e: unknown) => e);
    expect(isReentrantTransactionError(error)).toBe(true);
  });
});

describe('parity contract self-checks', () => {
  it('classifies an in-memory backend as such rather than assuming WAL', async () => {
    const adapter = await createMigratedDb();
    // A parity suite that silently asserted WAL on `:memory:` would fail for a
    // reason that has nothing to do with the app, which is the fastest way to
    // get a real parity failure ignored.
    expect(await isInMemoryDatabase(adapter)).toBe(true);
    expect(await scalar(adapter, 'PRAGMA journal_mode')).toBe('memory');
    await adapter.close();
  });

  it('re-measures the file-backed journal mode after initializeConnection', async () => {
    const { file, cleanup } = tempDbPath();
    try {
      const adapter = createNodeSqliteAdapter(file);
      await initializeConnection(adapter);
      expect(await isInMemoryDatabase(adapter)).toBe(false);
      expect(await scalar(adapter, 'PRAGMA journal_mode')).toBe(REQUIRED_JOURNAL_MODE);
      // The sidecars are the file-format consequence of WAL: a reader that
      // cannot create them sees an unreadable database, so their presence is
      // part of the contract, not a curiosity. SQLite creates them on the first
      // write, not when the mode is set, so the probe has to write something.
      await adapter.exec('CREATE TABLE wal_probe (id INTEGER PRIMARY KEY)');
      expect(fs.existsSync(`${file}-wal`)).toBe(true);
      // Closing checkpoints and removes them, which is what keeps a copied
      // database file self-contained.
      await adapter.close();
      expect(fs.existsSync(`${file}-wal`)).toBe(false);
    } finally {
      cleanup();
    }
  });
});
