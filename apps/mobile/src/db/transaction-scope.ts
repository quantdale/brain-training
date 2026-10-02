import type { SQLiteAdapter } from './adapter';

/**
 * Re-entrancy detection for the storage seam (Change 068).
 *
 * The interface contract in `adapter.ts` says "Transactions do not nest", but
 * nothing enforced it, and the two backends enforced different — and on the
 * device, absent — behavior. On the device backend a forgotten `txn` argument
 * was a **permanent, silent, error-free application freeze**:
 * `transaction()` holds the single per-connection operation queue for the whole
 * body, so a statement issued through the outer adapter waits on a queue slot
 * that the waiting call itself is occupying, forever.
 *
 * The failure is not a lock bug and cannot be fixed with a lock: the caller *is*
 * the lock holder. It is a precondition violation, so the fix is to state the
 * precondition and reject re-entry explicitly.
 *
 * ONE FLAG, not two. "A transaction is open" and "a transaction body is
 * executing" are different questions, but the first strictly contains the
 * second, so a single scope flag covers both — and a second flag could only
 * create a window where one of them is wrong. The scope is claimed by the
 * backend once it owns the connection, BEFORE `BEGIN`, and released after
 * `COMMIT`/`ROLLBACK`.
 *
 * The claim must be visible at the CALL SITE, not only inside the queued slot:
 * on the Expo backend a nested call that is enqueued first is already deadlocked
 * the moment it is enqueued, because it is queued behind the very slot its own
 * transaction is holding. Checking after enqueueing would be correct and
 * useless — that ordering IS the pre-068 permanent hang. The claim is set
 * synchronously by the same adapter instance that will run the body, so the
 * check below is never stale.
 *
 * KNOWN, DOCUMENTED NARROWING. Because the scope is a property of the
 * connection rather than of the call stack, an independent caller that opens a
 * transaction *while another transaction's body is awaiting* is now rejected
 * instead of being queued behind it. Both are correct serializations; the
 * rejection is louder and cannot deadlock. Verified that no production call
 * site issues concurrent transactions on one adapter (31 `transaction(` sites,
 * all sequential, all threading `txn`). `Promise.all` INSIDE a body is
 * unaffected — that runs on the private scope queue and is the supported
 * pattern.
 *
 * Kept in its own module so BOTH backends raise the identical error and the
 * Node test backend cannot drift back into a different (silent) behavior — the
 * divergence this change exists to remove.
 */

declare const CONNECTION_IDENTITY: unique symbol;

/**
 * Opaque identity of one underlying database connection.
 *
 * This is a nominal type on purpose: nothing may *use* a connection identity,
 * it may only be *derived* from a connection object and used as a registry
 * key. Modeling it structurally would invite callers to reach for a property
 * that does not exist; the brand makes the only legal operation (compare by
 * identity) explicit and keeps the guard's keying un-guessable from outside.
 */
export type ConnectionIdentity = { readonly [CONNECTION_IDENTITY]: true };

/** Derive a registry key from any object that represents a connection. */
export function connectionKeyOf(connection: unknown): ConnectionIdentity {
  return connection as ConnectionIdentity;
}

/**
 * Error name used for every backend's re-entrancy rejection. Callers and tests
 * match on this rather than on message text, so the guidance can evolve
 * without silently un-matching a real check.
 */
export const REENTRANT_SQLITE_ERROR_NAME = 'SQLiteReentrantTransactionError';

/**
 * Which entry point was reached from inside a transaction.
 * Every STATE-CHANGING connection-level entry point is listed: `run` was the
 * gap that left the original freeze reachable — it was unguarded because the
 * first pass only closed `transaction()` and `exec()`, but a forgotten `txn`
 * argument reaches the outer adapter through it too, and a DML write that
 * silently joins another transaction and vanishes on its rollback is silent
 * data loss. Reads (`get`/`all`) are deliberately NOT here: they PARTICIPATE
 * in the connection's current transaction instead of rejecting (refusing reads
 * stranded a claim-all racing a single claim). The body's own adapter is
 * scope-local and bypasses this check; the ROOT adapter never does.
 */
export type ReentrantEntryPoint = 'transaction' | 'exec' | 'run';

/**
 * Build the one error both backends throw when a statement or a second
 * transaction is requested on a connection that already has one open.
 *
 * The message names the three things an on-call engineer needs: what happened,
 * that it is a programming error rather than a database condition, and the fix.
 */
export function reentrantTransactionError(entryPoint: ReentrantEntryPoint): Error {
  const error = new Error(
    `SQLite re-entrancy: ${entryPoint}() was called on a connection that is already inside a ` +
      'transaction. This is a programming error, not a database condition. ' +
      'Thread the `txn` adapter through every call inside a transaction body ' +
      '(`txn ? write(txn) : transaction(write)`) and use only that adapter until the ' +
      'body resolves. Statements issued through the outer adapter would otherwise wait ' +
      'on the queue slot the transaction itself is holding, which hangs the app.',
  );
  error.name = REENTRANT_SQLITE_ERROR_NAME;
  return error;
}

/** True when `error` is the re-entrancy rejection raised by either backend. */
export function isReentrantTransactionError(error: unknown): boolean {
  return (
    error instanceof Error && (error as { name?: string }).name === REENTRANT_SQLITE_ERROR_NAME
  );
}

/**
 * Per-connection transaction state.
 *
 * Both maps are `WeakMap`s keyed on the connection, so state disappears with
 * the connection and can never leak between two databases. Plain booleans are
 * authoritative here rather than a depth counter: the operation queue (Expo)
 * and the single driver handle (Node) each guarantee at most one transaction
 * scope at a time, so a refcount could only add ways to get stuck.
 */
export class TransactionScopeRegistry {
  private readonly openScopes = new WeakMap<ConnectionIdentity, boolean>();

  /**
   * Claim the connection's transaction scope. Throws the shared re-entrancy
   * error when the scope is already held.
   *
   * @returns an idempotent release function that must be called from a
   *   `finally` covering BEGIN, COMMIT, ROLLBACK and any failure in between.
   */
  claim(key: ConnectionIdentity, entryPoint: ReentrantEntryPoint = 'transaction'): () => void {
    if (this.openScopes.get(key) === true) {
      throw reentrantTransactionError(entryPoint);
    }
    this.openScopes.set(key, true);
    let released = false;
    return () => {
      // Idempotent: a stale double release must not clear a scope a LATER
      // transaction has already claimed. A silent unlock is far worse than a
      // redundant write.
      if (released) return;
      released = true;
      this.openScopes.delete(key);
    };
  }

  /**
   * True when this connection currently has an open transaction scope.
   *
   * On the Expo backend this is the pre-enqueue guard. A nested call cannot be
   * detected after enqueueing, because by then it is queued behind the slot its
   * own transaction is holding.
   */
  isOpen(key: ConnectionIdentity): boolean {
    return this.openScopes.get(key) === true;
  }
}

/** Callbacks that end a transaction, kept separate so the scope code reads as one story. */
export interface TransactionEnd {
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
}

/**
 * Run `begin` / `body` / `commit` under a claimed scope.
 *
 * The claim happens BEFORE `begin` so a failed BEGIN still leaves the scope
 * owned until the `finally` runs, and the body always receives the scope-local
 * adapter rather than the outer one. Rollback failures are swallowed on purpose:
 * a connection-level failure must not mask the body's error, which is the one
 * that describes what actually went wrong.
 */
export async function runInTransactionScope<T>(
  scopes: TransactionScopeRegistry,
  key: ConnectionIdentity,
  adapter: SQLiteAdapter,
  begin: () => Promise<void>,
  body: (txn: SQLiteAdapter) => Promise<T>,
  end: TransactionEnd,
): Promise<T> {
  const releaseScope = scopes.claim(key, 'transaction');
  try {
    await begin();
    const result = await body(adapter);
    await end.commit();
    return result;
  } catch (error) {
    await end.rollback().catch(() => {});
    throw error;
  } finally {
    releaseScope();
  }
}
