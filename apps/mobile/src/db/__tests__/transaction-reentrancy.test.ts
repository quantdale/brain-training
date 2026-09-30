/**
 * Change 068 §1/§2/§3 — the re-entrancy contract on BOTH backends.
 *
 * Why this suite exists as its own file: the defect it pins is the single most
 * dangerous one the audit found, and it is invisible to ordinary usage tests.
 *
 * On the DEVICE backend the original symptom was not an error at all. A nested
 * `transaction()` (or a connection-level `exec()`) reached through the outer
 * adapter waited on the single per-connection operation queue slot that the
 * very transaction calling it was holding — a permanent, silent, error-free
 * application freeze with no recovery short of killing the process. On the
 * NODE backend the same mistake silently joined the outer transaction and was
 * rolled back with it, which reads as a green test suite. So neither backend
 * could be trusted to report this, and a test that merely asserted "it throws
 * somewhere" would not have distinguished a real fix from luck.
 *
 * Each case therefore pins three things: the typed error identity, that the
 * connection is still usable afterwards, and that the scope is released on
 * BOTH the commit and the rollback path.
 */
import { describe, expect, it } from '@jest/globals';

import type { SQLiteAdapter } from '../adapter';
import {
  REENTRANT_SQLITE_ERROR_NAME,
  TransactionScopeRegistry,
  connectionKeyOf,
  isReentrantTransactionError,
  reentrantTransactionError,
  runInTransactionScope,
} from '../transaction-scope';
import { createMigratedDb as createMigrated } from './helpers';

/** The legitimate shape the guard is meant to protect (see `db/profile.ts`). */
async function writeThroughTxn(adapter: SQLiteAdapter, id: string): Promise<void> {
  await adapter.transaction(async (txn) => {
    await txn.run("INSERT INTO game_favorites (game_id, created_at) VALUES (?, ?)", [id, 1]);
  });
}

/**
 * The legitimate `txn ? write(txn) : transaction(write)` shape (task 2.2).
 *
 * Faithful to `db/profile.ts:106`: a repository method that is sometimes called
 * inside a transaction and sometimes on its own. BOTH branches must stay
 * reachable — the guard exists to catch a MISSING `txn`, not to forbid the
 * pattern that makes the codebase transactional at all.
 */
async function saveMaybeInTransaction(
  adapter: SQLiteAdapter,
  id: string,
  txn?: SQLiteAdapter,
): Promise<void> {
  const write = async (target: SQLiteAdapter): Promise<void> => {
    await target.run("INSERT INTO game_favorites (game_id, created_at) VALUES (?, ?)", [id, 1]);
  };
  return txn ? write(txn) : adapter.transaction(write);
}

/** Capture the rejection from an async call without relying on message text. */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected the call to reject, but it resolved');
}

describe('Node adapter re-entrancy contract (Change 068)', () => {
  it('rejects a nested transaction() with the shared typed error', async () => {
    const adapter = await createMigrated();
    const error = await rejection(
      adapter.transaction(async () => {
        await adapter.transaction(async () => {
          /* never reached */
        });
      }),
    );
    expect(isReentrantTransactionError(error)).toBe(true);
    expect((error as Error).name).toBe(REENTRANT_SQLITE_ERROR_NAME);
    // The message must name the fix, not just the symptom: this error is
    // surfaced to an on-call engineer during a freeze-adjacent incident.
    expect((error as Error).message).toMatch(/Thread the `txn` adapter/);
    await adapter.close();
  });

  it('rejects a connection-level exec() reached through the root adapter', async () => {
    const adapter = await createMigrated();
    const error = await rejection(
      adapter.transaction(async () => {
        await adapter.exec('PRAGMA user_version = 99');
      }),
    );
    expect(isReentrantTransactionError(error)).toBe(true);
    expect((error as Error).message).toMatch(/exec\(\) was called/);
    // Nothing was applied: the guard rejects before the statement is issued.
    const version = await adapter.get<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).not.toBe(99);
    await adapter.close();
  });

  it('still allows connection-level exec() through the transaction adapter', async () => {
    const adapter = await createMigrated();
    // DDL and PRAGMA inside a body is legitimate and used by the migration
    // runner; the guard must not make the transaction body unusable.
    await expect(
      adapter.transaction(async (txn) => {
        await txn.exec('CREATE TABLE IF NOT EXISTS reentrant_probe (id INTEGER PRIMARY KEY)');
        await txn.exec('PRAGMA user_version = 12');
      }),
    ).resolves.toBeUndefined();
    await adapter.close();
  });

  it('releases the scope after COMMIT so a later transaction succeeds', async () => {
    const adapter = await createMigrated();
    await writeThroughTxn(adapter, 'after-commit');
    // A leaked flag would make this second transaction a false re-entrancy
    // rejection, which is the failure mode a refcount would introduce.
    await writeThroughTxn(adapter, 'after-commit-2');
    expect(await adapter.all('SELECT game_id FROM game_favorites ORDER BY game_id')).toEqual([
      { game_id: 'after-commit' },
      { game_id: 'after-commit-2' },
    ]);
    await adapter.close();
  });

  it('releases the scope after ROLLBACK so a later transaction succeeds', async () => {
    const adapter = await createMigrated();
    await expect(
      adapter.transaction(async () => {
        throw new Error('body failed');
      }),
    ).rejects.toThrow('body failed');
    // The rollback path is the one a `finally` can silently skip, so it gets
    // its own assertion rather than being inferred from the commit case.
    await writeThroughTxn(adapter, 'after-rollback');
    expect(await adapter.all('SELECT game_id FROM game_favorites')).toEqual([
      { game_id: 'after-rollback' },
    ]);
    await adapter.close();
  });

  it('releases the scope when BEGIN itself fails', async () => {
    // Driven through `runInTransactionScope` directly: a real adapter cannot
    // easily be made to fail only at BEGIN, and this is precisely the case a
    // `try { ... } catch { rollback }` without a `finally` gets wrong — the
    // claim is made before BEGIN, so a failed BEGIN must still release it.
    const registry = new TransactionScopeRegistry();
    const key = connectionKeyOf({});
    const fake: SQLiteAdapter = {
      exec: async () => {},
      run: async () => ({ changes: 0, lastInsertRowId: 0 }),
      get: async () => null,
      all: async () => [],
      transaction: async <T,>(_fn: (txn: SQLiteAdapter) => Promise<T>): Promise<T> =>
        undefined as T,
      close: async () => {},
    };
    await expect(
      runInTransactionScope(
        registry,
        key,
        fake,
        async () => {
          throw new Error('BEGIN failed: database is locked');
        },
        async () => undefined,
        {
          commit: async () => {},
          rollback: async () => {},
        },
      ),
    ).rejects.toThrow('BEGIN failed');
    expect(registry.isOpen(key)).toBe(false);

    // And the real adapter is unaffected afterwards, proving no cross-adapter
    // leakage: a genuine transaction still commits.
    const adapter = await createMigrated();
    await writeThroughTxn(adapter, 'still-usable');
    await adapter.close();
  });

  it('releases the scope when COMMIT fails', async () => {
    const registry = new TransactionScopeRegistry();
    const key = connectionKeyOf({});
    const fake: SQLiteAdapter = {
      exec: async () => {},
      run: async () => ({ changes: 0, lastInsertRowId: 0 }),
      get: async () => null,
      all: async () => [],
      transaction: async <T,>(_fn: (txn: SQLiteAdapter) => Promise<T>): Promise<T> =>
        undefined as T,
      close: async () => {},
    };
    await expect(
      runInTransactionScope(
        registry,
        key,
        fake,
        async () => {},
        async () => 'body result',
        {
          commit: async () => {
            throw new Error('COMMIT failed');
          },
          rollback: async () => {
            throw new Error('ROLLBACK failed after a failed COMMIT');
          },
        },
      ),
    ).rejects.toThrow('COMMIT failed');
    expect(registry.isOpen(key)).toBe(false);
  });

  it('preserves the body error when ROLLBACK also fails (task 1.4)', async () => {
    const registry = new TransactionScopeRegistry();
    const key = connectionKeyOf({});
    const fake: SQLiteAdapter = {
      exec: async () => {},
      run: async () => ({ changes: 0, lastInsertRowId: 0 }),
      get: async () => null,
      all: async () => [],
      transaction: async <T,>(_fn: (txn: SQLiteAdapter) => Promise<T>): Promise<T> =>
        undefined as T,
      close: async () => {},
    };
    // A connection-level failure during ROLLBACK must not replace the body's
    // error, or the diagnosis an on-call engineer sees becomes the wrong one.
    await expect(
      runInTransactionScope(
        registry,
        key,
        fake,
        async () => {},
        async () => {
          throw new Error('original body failure');
        },
        {
          commit: async () => {},
          rollback: async () => {
            throw new Error('rollback failure');
          },
        },
      ),
    ).rejects.toThrow('original body failure');
    expect(registry.isOpen(key)).toBe(false);
  });

  it('keeps the connection usable after each rejection', async () => {
    const adapter = await createMigrated();
    await rejection(
      adapter.transaction(async () => {
        await adapter.transaction(async () => {});
      }),
    );
    await rejection(
      adapter.transaction(async () => {
        await adapter.exec('SELECT 1');
      }),
    );
    // Two rejections in a row, then real work: a guard that only cleared on
    // the happy path would surface here.
    await writeThroughTxn(adapter, 'usable');
    expect(await adapter.all('SELECT game_id FROM game_favorites')).toEqual([
      { game_id: 'usable' },
    ]);
    await adapter.close();
  });

  it('does not report Promise.all inside a body as re-entrancy (private queue preserved)', async () => {
    const adapter = await createMigrated();
    const result = await adapter.transaction(async (txn) => {
      const writes = await Promise.all([
        txn.run("INSERT INTO game_favorites (game_id, created_at) VALUES ('p1', 1)"),
        txn.run("INSERT INTO game_favorites (game_id, created_at) VALUES ('p2', 1)"),
        txn.get<{ n: number }>('SELECT COUNT(*) AS n FROM game_favorites'),
      ]);
      return writes[2];
    });
    // The count is read concurrently with the two writes, so only the ORDER
    // guarantee matters: nothing rejected, and both writes committed.
    expect(result === null || typeof result?.n === 'number').toBe(true);
    expect(await adapter.all('SELECT game_id FROM game_favorites ORDER BY game_id')).toEqual([
      { game_id: 'p1' },
      { game_id: 'p2' },
    ]);
    await adapter.close();
  });

  it('leaves the legitimate txn-or-transaction pattern working (task 2.2)', async () => {
    const adapter = await createMigrated();
    // Outside a transaction: the method opens its own, and commits.
    await saveMaybeInTransaction(adapter, 'pattern-outside');
    // Inside a transaction: the method joins the open one via `txn`, and must
    // NOT try to nest — this is the path the guard protects.
    await adapter.transaction(async (txn) => {
      await saveMaybeInTransaction(adapter, 'pattern-inside', txn);
    });
    expect(
      (
        await adapter.all<{ game_id: string }>(
          'SELECT game_id FROM game_favorites ORDER BY game_id',
        )
      ).map((r) => r.game_id),
    ).toEqual(['pattern-inside', 'pattern-outside']);
    await adapter.close();
  });

  it('rejects the FORGOTTEN-txn form of that same pattern', async () => {
    const adapter = await createMigrated();
    // Exactly the defect the guard exists for: the `txn` argument is simply not
    // forwarded, so the method opens its own transaction from inside one.
    const error = await rejection(
      adapter.transaction(async () => {
        await saveMaybeInTransaction(adapter, 'forgotten-txn');
      }),
    );
    expect(isReentrantTransactionError(error)).toBe(true);
    expect(await adapter.all('SELECT game_id FROM game_favorites')).toHaveLength(0);
    await adapter.close();
  });
});

describe('scope registry semantics (unit)', () => {
  it('throws the same error class from every entry point', () => {
    const txnError = reentrantTransactionError('transaction');
    const execError = reentrantTransactionError('exec');
    expect(txnError.name).toBe(execError.name);
    expect(isReentrantTransactionError(txnError)).toBe(true);
    expect(isReentrantTransactionError(execError)).toBe(true);
    expect(isReentrantTransactionError(new Error('other'))).toBe(false);
    expect(isReentrantTransactionError('not an error')).toBe(false);
    expect(isReentrantTransactionError(null)).toBe(false);
    expect(txnError.message).toMatch(/transaction\(\) was called/);
    expect(execError.message).toMatch(/exec\(\) was called/);
  });

  it('rejects a second claim and accepts a re-claim after release', () => {
    const registry = new TransactionScopeRegistry();
    const key = connectionKeyOf({});
    expect(registry.isOpen(key)).toBe(false);
    const release = registry.claim(key);
    expect(registry.isOpen(key)).toBe(true);
    expect(() => registry.claim(key)).toThrow(/SQLite re-entrancy/);
    release();
    expect(registry.isOpen(key)).toBe(false);
    // The second claim after release must work: a leaked flag would reject
    // every later transaction on the connection.
    const releaseAgain = registry.claim(key);
    expect(registry.isOpen(key)).toBe(true);
    releaseAgain();
  });

  it('ignores a double release so it cannot clear a later transaction scope', () => {
    const registry = new TransactionScopeRegistry();
    const key = connectionKeyOf({});
    const first = registry.claim(key);
    first();
    first();
    const second = registry.claim(key);
    // The stale release from the first scope must not unlock the second.
    expect(registry.isOpen(key)).toBe(true);
    second();
    expect(registry.isOpen(key)).toBe(false);
  });

  it('keeps scopes independent per connection', () => {
    const registry = new TransactionScopeRegistry();
    const a = connectionKeyOf({ id: 'a' });
    const b = connectionKeyOf({ id: 'b' });
    const release = registry.claim(a);
    expect(registry.isOpen(a)).toBe(true);
    expect(registry.isOpen(b)).toBe(false);
    expect(() => registry.claim(b)).not.toThrow();
    release();
  });
});
