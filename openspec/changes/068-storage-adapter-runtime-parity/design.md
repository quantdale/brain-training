# Design — 068-storage-adapter-runtime-parity

## Context

See `proposal.md` — Why.

The current shape, in the two adapters that implement one
`SQLiteAdapter` interface (`apps/mobile/src/db/adapter.ts`):

- **Expo backend (device).** `AsyncOperationQueue` chains every statement on a
  promise tail keyed by the native handle. `transaction()` enqueues *one* slot
  and runs `BEGIN` … callback … `COMMIT` inside that slot, handing the
  callback a **freshly constructed adapter over a private queue** over the same
  handle. Anything the callback reaches through the *outer* adapter enqueues
  onto the same tail the in-flight transaction is occupying.
- **Node backend (tests).** No queue at all. `transaction()` executes
  `BEGIN IMMEDIATE` and passes the **root** adapter to the callback, so a
  forgotten `txn` silently executes inside the transaction and is rolled back
  with it.

The interface comment (`adapter.ts`) states "Transactions do not nest". Nothing
enforces that statement on either backend, and the two backends enforce
different — and in the device case absent — behavior.

Measured engine differences behind the adapters (measured during this audit):
SQLite 3.53.4 in `better-sqlite3` 13.0.3 vs 3.50.3 in `expo-sqlite` 57.0.3;
`busy_timeout` 5000 ms (Node default) vs 0 (device, no pragma anywhere in
`src/`); `SQLITE_DBCONFIG_DEFENSIVE` on (Node) vs off (device).

## Goals / Non-Goals

**Goals**

- Re-entrancy is a deterministic, typed failure on every backend.
- The connection-level invariants the app relies on are applied by code that
  runs on every backend, and are asserted rather than assumed.
- The engine behaviors the app depends on are pinned by an executable contract.
- The two recorded claims that are currently wrong are corrected.

**Non-Goals**

- Emulating `expo-sqlite` inside Jest. The Node backend stays the fast,
  deterministic test path; the goal is convergence of *invariants*, not of the
  engine.
- Changing which backend tests use, or any repository call site that already
  threads `txn` correctly (verified: all 31 non-test `transaction(` sites take
  `(txn)`).
- Schema changes, data migrations, or user-visible behavior changes.
- A device/emulator lane inside this change; that is recorded as the validation
  requirement in `tasks.md` for the implementing agent.

## Decisions

**D1 — Guard by explicit state, not by the mutex.** The deadlock is not a
locking bug; a mutex cannot report re-entrancy, because the caller *is* the
lock holder. The fix is to record, per native handle, that a transaction is
open, and to reject re-entry explicitly.

- Chosen: a per-handle `inTransaction` flag alongside the existing
  `databaseQueues` WeakMap registry, checked in `transaction()` and in the
  connection-level `exec()` entry point, cleared in a `finally`.
- Rejected: `isInTransactionAsync()` / `isInTransactionSync()` probing. It reads
  the truth from SQLite and is attractive, but it cannot distinguish "my own
  transaction body" from "a concurrent call that has not been granted the queue
  yet", so it would produce false negatives exactly where the flag also cannot —
  and it adds a native call to the hottest path. The flag is authoritative
  because the queue guarantees only one transaction body runs at a time.
- Rejected: a `try/catch` around the body. The failing call never rejects; it
  waits.

**D2 — Keep the private inner queue.** The transaction body must remain able to
run statements concurrently (`Promise.all` inside a body is legitimate and used
by the import path), which is why `transaction()` builds a second adapter with
its own queue. The guard therefore keys on the *handle*, not on the queue
instance: two adapters over one handle are one transaction scope.

**D3 — Mirror the precondition on the Node backend.** The Node backend gains
the same explicit rejection using `better-sqlite3`'s own `db.inTransaction`
flag. Keeping the native error as the only signal would preserve exactly the
divergence this change exists to remove: the test suite would keep reporting
`cannot start a transaction within a transaction` while the device reports
nothing.

**D4 — Converge pragmas in `initializeConnection`, then assert them.** Add
`busy_timeout` and an explicit `journal_mode` to the shared SQL constants and
apply them in `initializeConnection` for both backends, then read the values
back and throw if any is wrong. Declaring them without asserting them would
leave the same class of assumption in place; the audit exists because such
assumptions were never checked.

**D5 — A parity contract, not a coverage threshold.** The parity suite pins
*engine facts* (insert-or-ignore vs unique, insert-or-ignore vs check, foreign
keys inside a transaction, JSON function availability, engine version, effective
pragmas) and reports them. This is deliberately not a coverage gate: coverage
thresholds are already recorded as deferred owner debt, and a coverage number
would not have caught any finding in this change.

## Risks / Trade-offs

- **A currently tolerated nesting site becomes a hard error.** Intended, but
  it must be validated against the integration suites and the
  result/claim/reroll flows before convergence, not asserted.
  → Mitigation: run `src/db`, `src/workout`, `src/data-portability`,
  `src/analytics` and the cross-screen/repeated-use suites; the error is typed
  and self-describing, so a hit is diagnosable rather than mysterious.
- **Asserting pragmas can fail on a runtime that silently ignores them.**
  → Mitigation: the assertion is a startup check with a clear error; the
  per-handle queue already prevents intra-app writer races, so a busy timeout
  is defense against *external* writers, not a load-bearing mechanism.
- **A `journal_mode` change is a persistent database property**, so it applies
  to existing installs on next open.
  → Mitigation: choose a mode already implied by current operation and confirm
  the choice against the perf probes before landing; document the resulting
  file-format consequence.
- **Fixing the stale test comment/classification could be read as rewriting
  history.**
  → Mitigation: the correction is additive — keep the original row, amend it
  with the corrected mechanism and the evidence that invalidated it.

## Migration Plan

1. Land the guard and its tests with no pragma change; green matrix.
2. Land pragma convergence + the startup assertion; green matrix + perf probes
   (the probes are the regression signal for journal-mode choice).
3. Land the parity contract; it is expected to *report* the residual engine
   delta, not to fail it — each residual is recorded as a named boundary.
4. Correct the documentation and durable state.
5. No data migration; no rollback hazard. Reverting any step leaves the previous
   behavior, which is the current (defective) behavior.

## Open Questions

None. Every choice above is settled by repository evidence; the residual
device-parity boundary is a validation task, not a design decision.

## Post-review refinement (gap closure wave)

The first pass guarded **every** root entry point (`transaction`/`exec`/`run`/
`get`/`all`) with pre-enqueue rejection. That closed the freeze but broke
legitimate **independent concurrency**: a claim-all racing a single claim lost
every remaining reward when its advisory read was refused, and screen loads
could fail transiently while a write transaction was open. Re-entrancy and
concurrency are the same call shape on a single connection, and the app's
runtime (Hermes) has no async-context primitive to tell them apart.

Final semantics, pinned by `transaction-reentrancy.test.ts` /
`adapters/__tests__/expo.test.ts` / `rewards/__tests__/claim-all-attacks.test.ts`:

- **`transaction()` and connection-level `exec()` reject** while a scope is
  open — the two cases the requirement enumerates (nested transaction; DDL /
  `PRAGMA`). A DML `run` is also rejected: a write that silently becomes part of
  another transaction and vanishes on its rollback is silent data loss.
- **`get`/`all` participate** in the connection's current transaction instead
  of rejecting: side-effect-free, a body's own root reads return exactly the
  view it wants, and independent concurrent readers are advisory (every claim
  path re-validates inside its own transaction).
- **The transaction body no longer holds the statement queue.** Statements
  serialize one at a time (preserving the `ERR_USING_RELEASED_SHARED_OBJECT`
  contract), so nothing can queue behind a slot its own transaction occupies —
  the freeze is now structurally impossible for reads, not merely guarded.
- The claim batch driver (`rewards/inbox.ts`) additionally continues past a
  refused item, so one pass still claims everything claimable under contention
  (the 060 exactly-once totals hold in every interleaving).
