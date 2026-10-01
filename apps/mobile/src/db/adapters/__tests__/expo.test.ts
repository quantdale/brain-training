import { describe, expect, it, jest } from '@jest/globals';

// The normal Jest setup routes this module to the Node adapter. This suite
// deliberately exercises the production wrapper with a mocked native DB.
jest.unmock('@/db/adapters/expo');
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(),
}));

// Keep these production imports after the mock/unmock declarations so the test
// exercises the real Expo adapter against the mocked native module.
// eslint-disable-next-line import/first
import { createExpoSqliteAdapter, openExpoDatabase } from '../expo';
// eslint-disable-next-line import/first
import {
  REENTRANT_SQLITE_ERROR_NAME,
  isReentrantTransactionError,
} from '../../transaction-scope';

type DatabaseMetrics = {
  active: number;
  maxActive: number;
};

type FakeDatabase = {
  nativeDatabase: object;
  execAsync: jest.Mock;
  runAsync: jest.Mock;
  getFirstAsync: jest.Mock;
  getAllAsync: jest.Mock;
  closeAsync: jest.Mock;
  metrics: DatabaseMetrics;
};

function pauseForNativeTurn(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createFakeDatabase(
  nativeDatabase: object = {},
  metrics: DatabaseMetrics = { active: 0, maxActive: 0 },
): FakeDatabase {
  const nativeCall = (result: unknown) =>
    jest.fn(async () => {
      metrics.active += 1;
      metrics.maxActive = Math.max(metrics.maxActive, metrics.active);
      await pauseForNativeTurn();
      metrics.active -= 1;
      return result;
    });

  return {
    nativeDatabase,
    execAsync: nativeCall(undefined),
    runAsync: nativeCall({ changes: 1, lastInsertRowId: 7 }),
    getFirstAsync: nativeCall({ id: 1 }),
    getAllAsync: nativeCall([{ id: 1 }]),
    closeAsync: nativeCall(undefined),
    metrics,
  };
}

describe('Expo SQLite adapter serialization', () => {
  it('serializes concurrent calls on one database handle', async () => {
    const db = createFakeDatabase();
    const adapter = createExpoSqliteAdapter(db as never);

    await Promise.all([
      adapter.get('SELECT 1'),
      adapter.run('UPDATE sample SET value = ?', [1]),
      adapter.all('SELECT * FROM sample'),
      adapter.exec('PRAGMA foreign_keys = ON'),
    ]);

    expect(db.metrics.maxActive).toBe(1);
  });

  it('shares serialization across JS wrappers for one native database', async () => {
    const nativeDatabase = {};
    const metrics: DatabaseMetrics = { active: 0, maxActive: 0 };
    const first = createFakeDatabase(nativeDatabase, metrics);
    const second = createFakeDatabase(nativeDatabase, metrics);
    const firstAdapter = createExpoSqliteAdapter(first as never);
    const secondAdapter = createExpoSqliteAdapter(second as never);

    await Promise.all([
      firstAdapter.get('SELECT 1'),
      secondAdapter.get('SELECT 2'),
    ]);

    expect(metrics.maxActive).toBe(1);
  });

  it('serializes concurrent calls inside a transaction and outside it', async () => {
    const db = createFakeDatabase();
    const adapter = createExpoSqliteAdapter(db as never);

    // The outside read starts first; the transaction (and the two concurrent
    // calls inside it) must not overlap it or each other on the connection.
    const [, result] = await Promise.all([
      adapter.get<{ id: number }>('SELECT outside'),
      adapter.transaction(async (txn) => {
        const [row, write] = await Promise.all([
          txn.get<{ id: number }>('SELECT id FROM sample'),
          txn.run('UPDATE sample SET value = ?', [2]),
        ]);
        return { id: row?.id, changes: write.changes };
      }),
    ]);

    expect(result).toEqual({ id: 1, changes: 1 });
    expect(db.metrics.maxActive).toBe(1);
  });

  it('enforces foreign keys on the transaction connection before the body runs', async () => {
    const db = createFakeDatabase();
    const adapter = createExpoSqliteAdapter(db as never);

    // 065 invariant: expo-sqlite's exclusive transaction used to run on a NEW
    // native connection where FK enforcement defaulted off, and SQLite ignores
    // `PRAGMA foreign_keys` once a transaction is pending — so the pragma must
    // reach the connection BEFORE `BEGIN`, ahead of the callback body.
    let statementsBeforeBody: string[] = [];
    const result = await adapter.transaction(async (txn) => {
      statementsBeforeBody = db.execAsync.mock.calls.map((call) => String(call[0]));
      const row = await txn.get<{ id: number }>('SELECT id FROM sample');
      return row?.id ?? -1;
    });

    expect(statementsBeforeBody).toEqual(['PRAGMA foreign_keys = ON', 'BEGIN']);
    expect(db.execAsync.mock.calls.map((call) => String(call[0]))).toEqual([
      'PRAGMA foreign_keys = ON',
      'BEGIN',
      'COMMIT',
    ]);
    expect(result).toBe(1);
  });

  it('rolls back and propagates the failure when the transaction body rejects', async () => {
    const db = createFakeDatabase();
    const adapter = createExpoSqliteAdapter(db as never);

    await expect(
      adapter.transaction(async () => {
        throw new Error('transaction body failed');
      }),
    ).rejects.toThrow('transaction body failed');

    expect(db.execAsync.mock.calls.map((call) => String(call[0]))).toEqual([
      'PRAGMA foreign_keys = ON',
      'BEGIN',
      'ROLLBACK',
    ]);
  });

  it('continues draining the queue after an operation rejects', async () => {
    const db = createFakeDatabase();
    db.getFirstAsync
      .mockImplementationOnce(async () => {
        throw new Error('native operation failed');
      })
      .mockImplementationOnce(async () => ({ id: 2 }));
    const adapter = createExpoSqliteAdapter(db as never);

    await expect(adapter.get('SELECT broken')).rejects.toThrow('native operation failed');
    await expect(adapter.get('SELECT recovered')).resolves.toEqual({ id: 2 });
  });

  it('opens the app database with a fresh native connection', () => {
    const sqliteMock = jest.requireMock('expo-sqlite') as {
      openDatabaseSync: jest.Mock;
    };
    const db = createFakeDatabase();
    sqliteMock.openDatabaseSync.mockReturnValueOnce(db);

    expect(openExpoDatabase('brain-training.db')).toBe(db);
    expect(sqliteMock.openDatabaseSync).toHaveBeenCalledWith('brain-training.db', {
      useNewConnection: true,
    });
  });

  // ——— Change 068: the device half of the re-entrancy contract ———
  //
  // These cases are the reason the guard exists. On the DEVICE backend the
  // pre-068 behavior was not an error: a nested `transaction()` reached through
  // the outer adapter waited on the single per-connection operation queue slot
  // that the very transaction calling it was holding. The call never settled,
  // nothing was logged, and the app froze permanently. The Node backend cannot
  // reproduce that, so these assertions run against the real Expo adapter with a
  // fake native handle, and the jest timeout below is the backstop that turns
  // any future regression into a failing test instead of a hung suite.
  describe('re-entrancy guard (Change 068)', () => {
    // A regression here is a HANG, not a failure: without this the suite would
    // sit until the global timeout with no diagnosis. 5 s is far above the
    // queue turn cost of the fake handle and far below the 15 s global timeout.
    const HANG_BACKSTOP_MS = 5000;

    async function rejection(promise: Promise<unknown>): Promise<unknown> {
      try {
        await promise;
      } catch (error) {
        return error;
      }
      throw new Error('expected the call to reject, but it resolved');
    }

    it(
      'rejects a nested transaction() instead of deadlocking on the held queue',
      async () => {
        const db = createFakeDatabase();
        const adapter = createExpoSqliteAdapter(db as never);

        const error = await rejection(
          adapter.transaction(async () => {
            // Pre-068 this promise NEVER settled: the nested call enqueued
            // behind the outer call's own queue slot.
            return adapter.transaction(async () => undefined);
          }),
        );

        expect(isReentrantTransactionError(error)).toBe(true);
        expect((error as Error).name).toBe(REENTRANT_SQLITE_ERROR_NAME);
        // The rollback ran, so the frozen state is released rather than left
        // holding the connection open.
        expect(db.execAsync.mock.calls.map((call) => String(call[0]))).toEqual([
          'PRAGMA foreign_keys = ON',
          'BEGIN',
          'ROLLBACK',
        ]);
      },
      HANG_BACKSTOP_MS,
    );

    it(
      'rejects a connection-level exec() from inside a transaction body',
      async () => {
        const db = createFakeDatabase();
        const adapter = createExpoSqliteAdapter(db as never);

        const error = await rejection(
          adapter.transaction(async () => {
            return adapter.exec('PRAGMA user_version = 99');
          }),
        );

        expect(isReentrantTransactionError(error)).toBe(true);
        expect((error as Error).message).toMatch(/exec\(\) was called/);
        // The statement was never enqueued: the guard rejects before the queue,
        // which is the difference between failing and freezing.
        expect(db.execAsync.mock.calls.map((call) => String(call[0]))).not.toContain(
          'PRAGMA user_version = 99',
        );
      },
      HANG_BACKSTOP_MS,
    );

    it(
      'rejects root-adapter run() from inside a transaction body',
      async () => {
        // A forgotten `txn` reaches the outer adapter through `run` far more
        // often than through `exec`, and a write that silently becomes part of
        // someone else's transaction vanishes on its rollback — silent data
        // loss. The rejection is pre-enqueue, so the failure is loud instead
        // of a freeze or a phantom write.
        const db = createFakeDatabase();
        const adapter = createExpoSqliteAdapter(db as never);

        const error = await rejection(
          adapter.transaction(async () => adapter.run('INSERT INTO t VALUES (1)')),
        );
        expect(isReentrantTransactionError(error)).toBe(true);
        expect((error as Error).message).toContain('run() was called');
        // The write never reached the native handle.
        expect(db.runAsync).not.toHaveBeenCalled();
      },
      HANG_BACKSTOP_MS,
    );

    it(
      'lets root-adapter get()/all() PARTICIPATE instead of blocking or rejecting',
      async () => {
        // Reads must never freeze and must never be refused: a body reading
        // through the root adapter wants its OWN uncommitted view, and an
        // independent concurrent reader is advisory. Refusing reads is what
        // stranded a claim-all racing a single claim (one refused read lost
        // every remaining reward). The hang backstop below is the real
        // assertion — before the queue stopped holding the body's slot, these
        // calls enqueued behind the transaction and never settled.
        const db = createFakeDatabase();
        const adapter = createExpoSqliteAdapter(db as never);

        await expect(
          adapter.transaction(async () => {
            await adapter.get('SELECT 1');
            await adapter.all('SELECT 1');
          }),
        ).resolves.toBeUndefined();
        expect(db.getFirstAsync).toHaveBeenCalledTimes(1);
        expect(db.getAllAsync).toHaveBeenCalledTimes(1);
      },
      HANG_BACKSTOP_MS,
    );

    it(
      'keeps the transaction adapter usable for run/get/all inside a body',
      async () => {
        const db = createFakeDatabase();
        const adapter = createExpoSqliteAdapter(db as never);

        await expect(
          adapter.transaction(async (txn) => {
            await txn.run('INSERT INTO t VALUES (1)');
            await txn.get('SELECT 1');
            await txn.all('SELECT 1');
          }),
        ).resolves.toBeUndefined();
        expect(db.runAsync).toHaveBeenCalledTimes(1);
        expect(db.getFirstAsync).toHaveBeenCalledTimes(1);
        expect(db.getAllAsync).toHaveBeenCalledTimes(1);
      },
      HANG_BACKSTOP_MS,
    );

    it(
      'keeps the transaction adapter usable for exec inside a body',
      async () => {
        const db = createFakeDatabase();
        const adapter = createExpoSqliteAdapter(db as never);

        await expect(
          adapter.transaction(async (txn) => {
            await txn.exec('CREATE TABLE probe (id INTEGER PRIMARY KEY)');
          }),
        ).resolves.toBeUndefined();
        expect(db.execAsync.mock.calls.map((call) => String(call[0]))).toEqual([
          'PRAGMA foreign_keys = ON',
          'BEGIN',
          'CREATE TABLE probe (id INTEGER PRIMARY KEY)',
          'COMMIT',
        ]);
      },
      HANG_BACKSTOP_MS,
    );

    it(
      'releases the guard after commit and after rollback, so later work proceeds',
      async () => {
        const db = createFakeDatabase();
        const adapter = createExpoSqliteAdapter(db as never);

        await adapter.transaction(async () => undefined);
        await expect(
          adapter.transaction(async () => {
            throw new Error('rollback path');
          }),
        ).rejects.toThrow('rollback path');
        // A leaked scope would make this a false re-entrancy rejection. A
        // separate handle proves the registry is per-connection, not global.
        await expect(adapter.transaction(async () => undefined)).resolves.toBeUndefined();
        await expect(
          adapter.transaction(async (txn) => txn.get<{ id: number }>('SELECT 1')),
        ).resolves.toEqual({ id: 1 });
        expect(db.metrics.maxActive).toBe(1);
      },
      HANG_BACKSTOP_MS,
    );

    it(
      'does not reject a DIFFERENT connection that happens to overlap in time',
      async () => {
        const first = createFakeDatabase();
        const second = createFakeDatabase();
        const firstAdapter = createExpoSqliteAdapter(first as never);
        const secondAdapter = createExpoSqliteAdapter(second as never);

        // Two adapters over two native handles are two transaction scopes. A
        // registry keyed on anything coarser would make the second one a false
        // positive and serialize independent databases behind each other.
        await expect(
          Promise.all([
            firstAdapter.transaction(async (txn) => txn.get<{ id: number }>('SELECT 1')),
            secondAdapter.transaction(async (txn) => txn.get<{ id: number }>('SELECT 1')),
          ]),
        ).resolves.toEqual([
          { id: 1 },
          { id: 1 },
        ]);
      },
      HANG_BACKSTOP_MS,
    );

    it(
      'keys the guard on the NATIVE handle, not the JS wrapper (task 1.1)',
      async () => {
        const sharedNativeHandle = {};
        const wrapperA = createFakeDatabase(sharedNativeHandle);
        const wrapperB = createFakeDatabase(sharedNativeHandle);
        const adapterA = createExpoSqliteAdapter(wrapperA as never);
        const adapterB = createExpoSqliteAdapter(wrapperB as never);

        // Two JS wrappers, one native handle — exactly what Expo produces
        // across a fast-refresh/runtime remount. They share one connection, so
        // a transaction through A must be visible to B. Keying the guard on the
        // wrapper would let B open a second transaction on the same handle,
        // which is the defect.
        const error = await rejection(
          adapterA.transaction(async () => adapterB.transaction(async () => undefined)),
        );
        expect(isReentrantTransactionError(error)).toBe(true);
      },
      HANG_BACKSTOP_MS,
    );
  });
});
