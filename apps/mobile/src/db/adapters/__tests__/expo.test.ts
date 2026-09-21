import { describe, expect, it, jest } from '@jest/globals';

// The normal Jest setup routes this module to the Node adapter. This suite
// deliberately exercises the production wrapper with a mocked native DB.
jest.unmock('@/db/adapters/expo');
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(),
}));

// Keep this production import after the mock/unmock declarations so the test
// exercises the real Expo adapter against the mocked native module.
// eslint-disable-next-line import/first
import { createExpoSqliteAdapter, openExpoDatabase } from '../expo';

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
});
