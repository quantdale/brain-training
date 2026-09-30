/**
 * Change 068 §4 — connection-level invariants, asserted rather than assumed.
 *
 * `initializeConnection` applies `foreign_keys`, `busy_timeout`, and
 * `journal_mode`, then reads each one back and throws if the engine reports
 * something other than what the app requires. This suite proves the read-back
 * is real: the positive cases show the values hold on both the in-memory and
 * the file-backed path, and the negative cases inject a connection that
 * silently drops each setting, which is exactly the failure the assertion
 * exists to catch and which the pre-068 code could not have detected at all
 * (the device opened with `busy_timeout = 0` and nothing looked).
 */
import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createNodeSqliteAdapter } from '../adapters/node';
import type { SQLiteAdapter, SQLiteRunResult } from '../adapter';
import {
  CONNECTION_INVARIANTS,
  initializeConnection,
  invariantSatisfied,
  isInMemoryDatabase,
} from '../migrate';
import { REQUIRED_BUSY_TIMEOUT_MS, REQUIRED_JOURNAL_MODE, SQL } from '../schema';
import { createMigratedDb } from './helpers';

async function probeNumber(adapter: SQLiteAdapter, sql: string): Promise<number | null> {
  const row = await adapter.get<Record<string, unknown>>(sql);
  if (row === null) return null;
  return Number(Object.values(row)[0]);
}

async function probeText(adapter: SQLiteAdapter, sql: string): Promise<string | null> {
  const row = await adapter.get<Record<string, unknown>>(sql);
  if (row === null) return null;
  return String(Object.values(row)[0]).toLowerCase();
}

/**
 * A file-backed database in a throwaway temp directory.
 *
 * Cleanup uses Node's built-in retry options rather than a hand-rolled loop:
 * on Windows a just-closed SQLite file can hold a transient handle, and
 * `maxRetries`/`retryDelay` is the platform-aware mechanism for exactly that. A
 * temp-directory removal failure must never be reported as an invariant or
 * parity failure — that would teach an on-call engineer to ignore these suites,
 * which is the opposite of their purpose.
 */
function tempDbPath(): { file: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-invariants-'));
  const file = path.join(dir, 'invariants.db');
  return {
    file,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
      } catch {
        // A temp-directory removal failure is harness noise, never an invariant
        // result, and — critically — it must not be thrown from a `finally`:
        // that would replace the real assertion failure with EPERM and hide
        // the defect this suite exists to find.
      }
    },
  };
}

describe('connection invariants on the in-memory backend', () => {
  it('satisfies every declared invariant', async () => {
    const adapter = await createMigratedDb();
    expect(await probeNumber(adapter, SQL.foreignKeysProbe)).toBe(1);
    const busy = await probeNumber(adapter, SQL.busyTimeoutProbe);
    expect(busy).toBeGreaterThan(0);
    expect(busy).toBe(REQUIRED_BUSY_TIMEOUT_MS);
    // A `:memory:` database has no file, so `memory` is the only journal mode
    // it can report; the invariant allows exactly that and nothing else.
    expect(await probeText(adapter, SQL.journalModeProbe)).toBe('memory');
    // 1 = NORMAL, the standard WAL companion; asserted, not assumed.
    expect(await probeNumber(adapter, SQL.synchronousProbe)).toBe(1);
    await expect(initializeConnection(adapter)).resolves.toBeUndefined();
    await adapter.close();
  });

  it('classifies an in-memory database from the engine, not from a guess', async () => {
    const memory = await createMigratedDb();
    expect(await isInMemoryDatabase(memory)).toBe(true);
    await memory.close();

    const { file, cleanup } = tempDbPath();
    try {
      const onDisk = createNodeSqliteAdapter(file);
      expect(await isInMemoryDatabase(onDisk)).toBe(false);
      await onDisk.close();
    } finally {
      cleanup();
    }
  });

  it('leaves an in-memory database on its own journal mode at open time', async () => {
    // Load-bearing for interpreting the perf probes: all five build their
    // database through `createMigratedDb()`, i.e. `:memory:`, where a journal
    // file cannot exist. The adapter therefore never attempts a journal-mode
    // change there, so the WAL decision cannot have moved any probe number —
    // which is what makes "the probes show no journal-mode regression" a
    // structural fact rather than a coincidence. The device lane, not the
    // probes, is where WAL is actually measured.
    const adapter = createNodeSqliteAdapter(':memory:');
    expect(await probeText(adapter, SQL.journalModeProbe)).toBe('memory');
    await expect(initializeConnection(adapter)).resolves.toBeUndefined();
    expect(await probeText(adapter, SQL.journalModeProbe)).toBe('memory');
    await adapter.close();
  });
});

describe('connection invariants on the file-backed backend (the device shape)', () => {
  it('applies and asserts WAL plus a non-zero busy timeout', async () => {
    const { file, cleanup } = tempDbPath();
    try {
      const adapter = createNodeSqliteAdapter(file);
      // The values are applied at OPEN time (task 4.2), so they are already in
      // force before a single repository call is made.
      expect(await probeText(adapter, SQL.journalModeProbe)).toBe(REQUIRED_JOURNAL_MODE);
      expect(await probeNumber(adapter, SQL.busyTimeoutProbe)).toBe(REQUIRED_BUSY_TIMEOUT_MS);
      expect(await probeNumber(adapter, SQL.foreignKeysProbe)).toBe(1);
      expect(await probeNumber(adapter, SQL.synchronousProbe)).toBe(1);
      // ...and re-applying through the shared initializer is idempotent.
      await expect(initializeConnection(adapter)).resolves.toBeUndefined();
      expect(await probeText(adapter, SQL.journalModeProbe)).toBe(REQUIRED_JOURNAL_MODE);
      await adapter.close();
    } finally {
      cleanup();
    }
  });
});

describe('initializeConnection fails closed on a connection that drops an invariant', () => {
  /**
   * Wrap a healthy adapter so one `exec` swallows a specific statement. This
   * is the exact shape of the real defect: a runtime that accepts a PRAGMA and
   * does nothing with it. Without the read-back assertion this is invisible —
   * the app would simply run with foreign keys off or lock timeout zero.
   */
  function adapterSilentlyDropping(adapter: SQLiteAdapter, dropped: string): SQLiteAdapter {
    return {
      ...adapter,
      exec: async (sql: string): Promise<void> => {
        if (sql.trim() === dropped.trim()) return;
        await adapter.exec(sql);
      },
    };
  }

  /**
   * Force one pragma probe to report a fixed value, modelling a runtime that
   * accepted the PRAGMA and did nothing with it. The `as unknown as T` is the
   * point: the adapter's `get` is generic, and a fake row genuinely is not a
   * `T` — that cast is confined here so the tests that use it stay readable.
   */
  function withProbeValue(
    adapter: SQLiteAdapter,
    sql: string,
    value: unknown,
  ): SQLiteAdapter {
    return {
      ...adapter,
      get: async <T,>(statement: string): Promise<T | null> =>
        statement === sql ? (value as T) : adapter.get<T>(statement),
    };
  }

  it('rejects a connection whose journal_mode pragma is ignored', async () => {
    const { file, cleanup } = tempDbPath();
    try {
      const healthy = createNodeSqliteAdapter(file);
      const sabotaged = adapterSilentlyDropping(healthy, SQL.journalModeWal);
      // Force the observed value to be something other than the requirement, the
      // way a runtime that ignores the pragma would.
      const wrong = withProbeValue(sabotaged, SQL.journalModeProbe, { journal_mode: 'delete' });
      await expect(initializeConnection(wrong)).rejects.toThrow(/journal_mode/);
      await expect(initializeConnection(wrong)).rejects.toThrow(/delete/);
      await healthy.close();
    } finally {
      cleanup();
    }
  });

  it('rejects a connection whose busy_timeout stays at zero (the device default)', async () => {
    const adapter = await createMigratedDb();
    // The device opened with busy_timeout = 0 — the exact inherited default
    // that made every writer contention an instant SQLITE_BUSY.
    const wrong = withProbeValue(adapter, SQL.busyTimeoutProbe, { timeout: 0 });
    await expect(initializeConnection(wrong)).rejects.toThrow(/busy_timeout/);
    await expect(initializeConnection(wrong)).rejects.toThrow(/greater than zero/);
    await adapter.close();
  });

  it('rejects a connection with foreign keys disabled', async () => {
    const adapter = await createMigratedDb();
    const wrong = withProbeValue(adapter, SQL.foreignKeysProbe, { foreign_keys: 0 });
    await expect(initializeConnection(wrong)).rejects.toThrow(/foreign_keys/);
    await adapter.close();
  });

  it('rejects a connection whose invariant statement itself throws', async () => {
    const adapter = await createMigratedDb();
    const wrong: SQLiteAdapter = {
      ...adapter,
      exec: async (sql: string): Promise<void> => {
        if (sql.trim() === SQL.busyTimeout.trim()) throw new Error('unsupported by this runtime');
        await adapter.exec(sql);
      },
    };
    await expect(initializeConnection(wrong)).rejects.toThrow(/it threw: unsupported by this runtime/);
    await adapter.close();
  });

  it('rejects a connection whose probe returns no row', async () => {
    const adapter = await createMigratedDb();
    const wrong = withProbeValue(adapter, SQL.journalModeProbe, null);
    await expect(initializeConnection(wrong)).rejects.toThrow(/probe returned no row/);
    await adapter.close();
  });

  it('names EVERY unsatisfied invariant in one error, not just the first', async () => {
    const adapter = await createMigratedDb();
    const wrong = withProbeValue(
      withProbeValue(
        withProbeValue(withProbeValue(adapter, SQL.foreignKeysProbe, { foreign_keys: 0 }),
          SQL.busyTimeoutProbe, { timeout: 0 }),
        SQL.journalModeProbe, { journal_mode: 'delete' },
      ),
      SQL.synchronousProbe, { synchronous: 2 },
    );
    // An engineer fixing startup must see the whole list; discovering one
    // missing invariant per run is a worse failure than the original one.
    const error = await initializeConnection(wrong).catch((e: unknown) => e);
    const message = (error as Error).message;
    for (const invariant of CONNECTION_INVARIANTS) {
      expect(message).toContain(invariant.name);
    }
    await adapter.close();
  });
});

describe('invariant predicate semantics (unit)', () => {
  const journal = CONNECTION_INVARIANTS.find((i) => i.name === 'journal_mode')!;
  const busy = CONNECTION_INVARIANTS.find((i) => i.name === 'busy_timeout')!;
  const fk = CONNECTION_INVARIANTS.find((i) => i.name === 'foreign_keys')!;

  it('accepts WAL on a file-backed database and memory only in memory', () => {
    expect(invariantSatisfied(journal, 'wal')).toBe(true);
    expect(invariantSatisfied(journal, 'wal', true)).toBe(true);
    expect(invariantSatisfied(journal, 'memory')).toBe(false);
    expect(invariantSatisfied(journal, 'memory', true)).toBe(true);
    // A near-miss must not pass: `wal2` is a different thing entirely.
    expect(invariantSatisfied(journal, 'wal2')).toBe(false);
    expect(invariantSatisfied(journal, 'wal2', true)).toBe(false);
    expect(invariantSatisfied(journal, 'delete', true)).toBe(false);
  });

  it('accepts any positive busy timeout, never zero or a non-number', () => {
    expect(invariantSatisfied(busy, '1')).toBe(true);
    expect(invariantSatisfied(busy, '5000')).toBe(true);
    expect(invariantSatisfied(busy, '0')).toBe(false);
    expect(invariantSatisfied(busy, '-1')).toBe(false);
    expect(invariantSatisfied(busy, 'none')).toBe(false);
    expect(invariantSatisfied(busy, '')).toBe(false);
    // The in-memory allowance must NOT relax this invariant.
    expect(invariantSatisfied(busy, '0', true)).toBe(false);
  });

  it('requires foreign keys to be exactly on, in memory or not', () => {
    expect(invariantSatisfied(fk, '1')).toBe(true);
    expect(invariantSatisfied(fk, '1', true)).toBe(true);
    expect(invariantSatisfied(fk, '0')).toBe(false);
    expect(invariantSatisfied(fk, '0', true)).toBe(false);
    expect(invariantSatisfied(fk, 'true')).toBe(false);
  });
});

describe('declared invariants are complete and self-consistent', () => {
  it('covers exactly the three settings the audit found unasserted', () => {
    expect(CONNECTION_INVARIANTS.map((i) => i.name)).toEqual([
      'foreign_keys',
      'busy_timeout',
      'journal_mode',
      'synchronous',
    ]);
  });

  it('gives every invariant a distinct apply statement, probe and name', () => {
    const applies = new Set(CONNECTION_INVARIANTS.map((i) => i.apply));
    const probes = new Set(CONNECTION_INVARIANTS.map((i) => i.probe));
    expect(applies.size).toBe(CONNECTION_INVARIANTS.length);
    expect(probes.size).toBe(CONNECTION_INVARIANTS.length);
  });

  it('keeps the shared constants and the applied SQL in agreement', async () => {
    // The device path reads the constants from `schema.ts`; if an invariant
    // hardcoded its own value instead, the two would silently diverge — which
    // is exactly the class of bug this file was written to remove.
    expect(SQL.busyTimeout).toBe(`PRAGMA busy_timeout = ${REQUIRED_BUSY_TIMEOUT_MS}`);
    const adapter = await createMigratedDb();
    const runResult: Promise<SQLiteRunResult> = adapter.run(SQL.busyTimeout);
    await expect(runResult).resolves.toMatchObject({ changes: 0 });
    expect(await probeNumber(adapter, SQL.busyTimeoutProbe)).toBe(REQUIRED_BUSY_TIMEOUT_MS);
    await adapter.close();
  });
});
