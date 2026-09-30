# Lane L01 — Persistence core (`apps/mobile/src/db/**`)

## Scope covered

- **Deeply inspected (read in full, 18 non-test source files / 5,177 lines):**
  `adapter.ts`, `adapters/expo.ts`, `adapters/node.ts`, `index.ts`, `migrate.ts`,
  `schema.ts` (753 lines), `sessions.ts` (1,360), `workout.ts` (904), `quests.ts`,
  `rating.ts`, `economy.ts`, `ledger.ts`, `profile.ts`, `favorites.ts`,
  `achievements.ts`, `xp-awards.ts`, `tutorial.ts`, `query.ts`, `batch.ts`, `types.ts`.
  All 24 `__tests__` suites enumerated by test name; `adapters/__tests__/expo.test.ts`,
  `db/__tests__/helpers.ts`, `repository-correctness.test.ts` (nesting case),
  `schema-guards.test.ts`, `init-retry.test.ts` read in full.
- **Secondary inspected for callers / writers:** `data-portability/{apply,preview,serialize,
  deserialize,triggers,wipe,file-transport}.ts`, `progression/sync.ts`,
  `analytics/{projections,queries}.ts`, `streaks/actions.ts`, `quests/rewards.ts`,
  `achievements/rewards.ts`, `cosmetics/store.ts`, `rewards/inbox.ts`, `workout/use-workout.ts`,
  `workout/session-advance.ts`, `sync/engine.ts`, `app/data-management.tsx`,
  `hooks/use-db-data.ts`, `jest/setup.js`, `test-utils/{db,bootstrap-db}.ts`.
- **Structurally inspected (grep / symbol map / call trace):** every `transaction(` call site
  in the whole `src` tree (34 non-test occurrences) mapped caller-by-caller for `txn` threading;
  every `PRAGMA` in `src`; every SQL string interpolation; every `catch` in `db/**` and
  `data-portability/**`; `RAW_SELECT` export projections; the installed `expo-sqlite` 57.0.3
  and `better-sqlite3` 13.0.3 native sources (pragma/JOURNAL/build-flag defaults).
- **Diagnostics run:** `npx jest src/db` → **21/21 suites, 231/231 tests pass, 34.25 s**;
  `node -e` probes against `better-sqlite3` 3.53.4 (in-memory) for `INSERT OR IGNORE` ×
  trigger-`RAISE(ABORT)` vs `CHECK`, nested `BEGIN`, and cross-statement transaction membership;
  `/tmp/l01_queue_probe.js` (a faithful copy of the expo adapter's queue/transaction primitives
  with a fake native handle — nothing in the repo was written) for the re-entrancy scenarios.
- **Intentionally excluded:** iOS runtime behaviour, native Android/iOS build config
  (`plugins/*`, `android/**`) beyond the backup-domain rules, UI-layer rendering of DB errors,
  and any device/emulator execution (prohibited by the lane brief). `checksum.ts` /
  `canonical-json.ts` internals are L0x-other-lane material; I only used their contract.

## Flow map

```
open:   initDatabase() index.ts:195 → initializeDatabase() index.ts:214
          createAdapter()  = createExpoSqliteAdapter(openExpoDatabase('brain-training.db'))
                             adapters/expo.ts:49 / :121-122 (useNewConnection:true)
        → initializeConnection(adapter)      migrate.ts:120   [PRAGMA foreign_keys = ON — the only pragma]
        → runMigrations(adapter)             migrate.ts:26    (validate order/dup/gap, `current > target` reject,
                                                               per-migration adapter.transaction { up(); PRAGMA user_version = v })
        → ensureSchemaGuards(adapter)        migrate.ts:106   (re-create MISSING triggers from CANONICAL_TRIGGER_DDL)
        → deleteEmptyWorkoutInstances()      workout.ts:167   (janitor: rows whose game_ids_json yields 0 games)
        → new AppDatabase(adapter) + profile.ensureExists()  index.ts:229-230
write:  db.transaction(fn) index.ts:160 → adapters/expo.ts:84  (queue held; FK re-asserted; BEGIN/COMMIT/ROLLBACK)
        → repositories pass the `txn` adapter through every call (economy/claims/streaks/cosmetics/imports)
read:   repositories on the shared adapter → expo queue (serialized) / node backend (unserialized)
snapshot: readSnapshot() serialize.ts:115 → single read transaction → canonical text + SHA-256
cleanup:  wipeLocalData() / replace-import → captureTriggers → dropTriggers(rawExec, outside txn)
          → clear in one transaction → recreateTriggers (finally) → healed next boot by ensureSchemaGuards
```

## Findings

### L01-F01 — A nested `transaction()` (or any call routed to the outer adapter inside a transaction body) permanently deadlocks the whole persistence layer on device; the recorded "fails loudly at `BEGIN`" classification is false

- Severity: P1
- Confidence: confirmed (code trace + faithful reproduction; no live call site today)
- Category: concurrency | reliability
- Files: `apps/mobile/src/db/adapters/expo.ts:12-24` (`AsyncOperationQueue`), `:84-104`
  (`transaction`), `apps/mobile/src/db/index.ts:160-162` (`AppDatabase.transaction`),
  `:173-175` (`rawExec`), `apps/mobile/src/db/__tests__/repository-correctness.test.ts:227-243`,
  `docs/hardening/post067/PASS_B_RUNTIME.md:14`
- Evidence:
  - The transaction body runs **inside** the queue slot it holds:
    `adapters/expo.ts:87-93` → `return queue.enqueue(async () => { const txn = createExpoSqliteAdapter(db, new AsyncOperationQueue()); await txn.exec(SQL.foreignKeysOn); await db.execAsync('BEGIN'); …`
    `enqueue` (`:16-22`) chains every new operation on `this.tail`, and `this.tail` is exactly the
    promise of the in-flight transaction. A nested `queue.enqueue` therefore waits on the
    transaction that is waiting for it.
  - The Node test backend has no queue and passes the **root** adapter into the body
    (`adapters/node.ts:41-51`), so the same nesting *throws* there:
    `docs/hardening/post067/PASS_B_RUNTIME.md:14` records
    “Adapter does not pre-reject nested `transaction()` | Low (latent) | verified it fails loudly at
    `BEGIN` without corrupting the outer transaction; no product call site nests. Recorded, no code change”.
  - Reproduction of the adapter's exact primitives
    (`/tmp/l01_queue_probe.js`, fake native handle, read-only w.r.t. the repo):
    ```
    scenario=nested-transaction        -> DEADLOCK: pending after 1500ms
    scenario=outer-adapter-call-inside-txn -> DEADLOCK
    scenario=later-op-after-deadlock   -> DEADLOCK: every later DB op hangs forever
    ```
  - The node backend, by contrast, joins the caller's transaction silently:
    ```
    rows after ROLLBACK (outside call participated in txn): 0
    nested BEGIN on node backend throws: cannot start a transaction within a transaction
    ```
  - The test that pins this contract asserts the *node* symptom and its comment is doubly stale
    (`repository-correctness.test.ts:227-243`): it says “The expo backend
    (**withExclusiveTransactionAsync**) fails equivalently” — an API `adapters/expo.ts` stopped
    using in `5ef707d` (065, which introduced the `BEGIN`-on-main-connection design); the `BEGIN`
    in the device path is now only reachable *after* the queue slot is granted, so the nested call
    never reaches `BEGIN` at all.
- Problem: on device, re-entering the adapter from inside a transaction does not raise the
  documented “Transactions do not nest” error (`adapter.ts:36-37`); it blocks forever. There is no
  timeout, no watchdog and no error boundary on the queue, so once triggered the promise chain is
  wedged for the life of the process: the in-flight statement never commits, `COMMIT`/`ROLLBACK`
  never run, and **every** later read/write (session completion, ledger, profile, screens) hangs.
- Why it matters: the realistic failure scenario is an app that freezes permanently with no error
  surfaced (Android ANR-class, no recovery but process kill), and the frozen write is the user’s
  just-finished session/claim. Today no product call site nests (I verified all 34 non-test
  `transaction(` sites thread `txn`), so this is latent — but the guard against it is a single
  convention that the test harness actively *rewards violating*: on the Node backend a forgotten
  `txn` argument silently works and is even rolled back with the transaction, so CI stays green
  while the device path is a hang. `rawExec()` (`index.ts:173-175`) has the same shape
  (`DROP TRIGGER` inside a transaction would hang, not error), and the module doc for
  `listProgressProjection` (`sessions.ts:935-946`) explicitly claims the repository primitives “keep
  working when called inside an outer transaction (where `db.transaction()` would refuse to nest)” —
  on device that call would hang.
- Root cause: the queue is used as an implicit re-entrancy guard, but a mutex cannot report
  re-entrancy; the adapter never asks SQLite whether a transaction is already open
  (`expo-sqlite` exposes `isInTransactionAsync()`/`isInTransactionSync()`, implemented natively as
  `sqlite3_get_autocommit() == 0` — `expo-sqlite/android/.../SQLiteModule.kt:146-152`).
- Recommended solution: make re-entrancy an explicit, loud failure instead of an accidental hang:
  (a) track an in-transaction flag alongside the queue in `queueForDatabase`'s registry (keyed on the
  same native handle) and have `transaction()`, `rawExec()`/`exec()` throw a descriptive
  `Error('nested database transaction — pass the txn adapter')` when it is set; or
  (b) query `db.isInTransactionAsync()`/`isInTransactionSync()` before `BEGIN` and throw on
  `true`; and (c) optionally bound the queue with a diagnostic timeout in `__DEV__` so a wedged
  chain surfaces instead of hanging silently. Update `repository-correctness.test.ts:227-243` to
  assert the new explicit error, and fix the stale `withExclusiveTransactionAsync` comment.
- Implementation considerations: the flag must live in the **per-native-handle** registry
  (`adapters/expo.ts:26-40`) so the fake-database/multi-wrapper tests keep passing; it must be
  cleared in a `finally` around `BEGIN…COMMIT/ROLLBACK`; the node backend should get the equivalent
  precondition so both runtimes fail identically (better-sqlite3 can report `db.inTransaction`);
  keep the existing behavior for the *documented* legitimate nesting pattern
  (`db.transaction(txn => db.profile.update(x, txn))`) which never re-enters `transaction()`.
- Dependencies: none (self-contained adapter change). Lane brief §3 “accepted debt” does **not**
  cover this item; `PASS_B_RUNTIME.md:14` does, and this finding is reported under the explicit
  “materially new evidence that the accepted debt is worse than recorded” exception — the recorded
  claim (“fails loudly at `BEGIN`”) is factually wrong for the current adapter.
- Risks: adding the precondition could surface a currently-tolerated nesting call site as a hard
  error — that is the intended outcome, but it must be checked against the integration suites
  (`npx jest src/db src/__tests__/cross-screen-consistency.test.ts src/__tests__/repeated-use-simulation.test.ts`)
  and the results screen/claim flows before convergence.
- Validation required: a fake-native expo-adapter unit test that a nested `transaction()` (and a
  `rawExec()` from inside a transaction body) rejects instead of hanging, with a jest timeout as the
  backstop; plus a device journey on the dedicated AVD exercising “complete a game → claim reward →
  reroll workout” (the three transactional flows) to prove no regression.
- Completion criteria: nested/queued re-entry raises a typed error on both backends within one
  event-loop turn; `npx jest src/db` green; no product call site changes behavior; the stale
  `withExclusiveTransactionAsync` comment is corrected.

### L01-F02 — The test harness substitutes a different SQLite engine and connection model for the production adapter; the resulting divergence demonstrably hid L01-F01 and hides the whole class

- Severity: P1 (per lane-brief rule: divergence that can hide defects)
- Confidence: confirmed
- Category: testing | data-integrity | concurrency
- Files: `apps/mobile/jest/setup.js:21-27`, `apps/mobile/src/test-utils/db.ts:15-21`,
  `apps/mobile/src/db/adapters/node.ts:10-51`, `apps/mobile/src/db/adapters/__tests__/expo.test.ts:1-186`,
  `apps/mobile/src/test-utils/bootstrap-db.ts:24-90`
- Evidence: the production adapter module is replaced wholesale for the entire Jest run:
  ```js
  jest.mock('@/db/adapters/expo', () => {
    const node = jest.requireActual('@/db/adapters/node');
    return { createExpoSqliteAdapter: () => node.createNodeSqliteAdapter(':memory:'), openExpoDatabase: () => ({}) };
  });
  ```
  Measured divergences between the two runtimes:
  | Property | Node tests (`better-sqlite3` 13.0.3) | Device (`expo-sqlite` 57.0.3) |
  |---|---|---|
  | SQLite version | 3.53.4 (`node_modules/better-sqlite3/deps/sqlite3/sqlite3.h:149`) | 3.50.3 (`node_modules/expo-sqlite/vendor/sqlite3/sqlite3.c:468`) |
  | Busy timeout | **5000 ms** (`better-sqlite3/lib/database.js:33`, applied at `src/objects/database.cpp:167`) | **0** — no `busy_timeout` anywhere in `src`, and expo-sqlite sets none (grep of `expo-sqlite/android/**` finds no `PRAGMA`) |
  | `SQLITE_DBCONFIG_DEFENSIVE` | **on** (`src/objects/database.cpp:172`) | off (never set) |
  | Serialization | none: every statement runs immediately on the shared connection | `AsyncOperationQueue` per native handle (`adapters/expo.ts:12-40`) |
  | Transaction isolation | none: `await` in a body yields to other DB calls, which share the connection | queue holds all other callers for the whole transaction |
  | Nested `transaction()` | throws `cannot start a transaction within a transaction` | **hangs** (L01-F01) |
  | Root-adapter call inside a body | silently executes inside the transaction (proved: `rows after ROLLBACK: 0`) | **hangs** (L01-F01) |
  The only suite that executes the real wrapper uses a fake native DB that models none of this
  (`adapters/__tests__/expo.test.ts` asserts statement ordering/serialization only); screen tests
  additionally bypass the repositories entirely (`test-utils/bootstrap-db.ts`).
  `campaign011/W11.md:59` already records “Real on-device SQLite behavior … (JSON1 functions,
  transaction nesting, trigger errors) NOT validated”.
- Problem: the harness is not a faithful model of the production storage engine, and its
  divergences are all in the *lenient* direction (retrying locks, isolating transactions, turning
  hangs into errors). A test can pass while the device hangs, errors, or corrupts; conversely a
  device-only success can never be proven by the suite.
- Why it matters: this lane found one live consequence (L01-F01 = a future call site’s forgotten
  `txn` = an app-wide hang that CI cannot see), and the same mechanism will keep hiding its class:
  any new repository call that forgets to thread `txn`, any transient second connection (dev
  fast-refresh always opens a fresh handle because `openExpoDatabase` sets `useNewConnection: true`,
  `adapters/expo.ts:121-122`), and any `BEGIN`-upgrade `SQLITE_BUSY` path all behave differently on
  device than in the suite that is supposed to certify them.
- Root cause: a single “write once, run on both backends” adapter (`adapter.ts:20-42`) whose
  *engine* differences are documented informally in comments (065's FK note) but neither asserted
  nor emulated; there is no device-parity test and no recorded engine-difference contract.
- Recommended solution: (1) make the divergences explicit and testable — a single
  `initializeConnection()` that sets every connection-level pragma the app depends on
  (`foreign_keys`, `busy_timeout`, and an explicit `journal_mode`, see L01-F03) so both backends
  converge by construction rather than by luck; (2) have the Node adapter mirror the device's
  failure modes where cheap (`db.inTransaction` guard, no busier-than-device retry semantics) so a
  test cannot pass on a behavior the device rejects; (3) add a parity assertion test that pins the
  *engine facts* the code relies on (JSON1 present, trigger `RAISE(ABORT)` not swallowed by
  `INSERT OR IGNORE`, `CHECK` violated by `OR IGNORE` yields `changes === 0`, FK enforced inside a
  transaction) against whichever backend is active, and run the same file against a device/ARTEMIS
  journey at least once per release; (4) record the engine matrix (versions/prgamas) in
  `.agent/VALIDATION.md` so the divergence is a known, monitored boundary rather than an implicit
  assumption.
- Implementation considerations: do not attempt to emulate expo-sqlite in Jest; the goal is
  *convergence of the invariants the app relies on* plus an explicit, documented residual boundary.
  Keep `test-utils/db.ts` on the node backend (it is the fast, deterministic path) but stop
  pretending it is the device.
- Dependencies: L01-F03 (pragma convergence) is the concrete fix for the busy-timeout/journal part;
  L01-F01 is the concrete defect already hidden.
- Risks: pinning engine facts may expose existing tests that rely on lenient behavior (e.g. nested
  `BEGIN` throwing vs hanging) — that is the point; do it in the same wave as L01-F01.
- Validation required: `npx jest src/db src/data-portability`; a new parity/engine-facts suite;
  one ARTEMIS device journey that runs the same facts on-device and records the resulting pragma
  snapshot (`PRAGMA foreign_keys/busy_timeout/journal_mode/synchronous`, `sqlite_version()`).
- Completion criteria: the app's required connection-level invariants are asserted at init on both
  backends; every known divergence is either converged or documented with an owner and a
  device-validation note; the harness no longer reports green for a case that hangs on device.

### L01-F03 — `initializeConnection` asserts only `foreign_keys`; the device connection runs with a 0 ms busy timeout and rollback-journal mode while the test backend gets 5 s

- Severity: P2
- Confidence: confirmed (pragma absence + engine defaults), risk scenario strongly indicated
- Category: reliability | concurrency | config
- Files: `apps/mobile/src/db/migrate.ts:120-122`, `apps/mobile/src/db/index.ts:214-231`,
  `apps/mobile/src/db/adapters/expo.ts:84-104`, `apps/mobile/src/db/adapters/node.ts:14`
- Evidence: `initializeConnection` is the single connection setup hook and contains one statement:
  ```ts
  export async function initializeConnection(adapter: SQLiteAdapter): Promise<void> {
    await adapter.exec(SQL.foreignKeysOn);
  }
  ```
  `git grep -n "journal_mode\|busy_timeout\|synchronous\|wal_checkpoint" -- apps/mobile/src` returns
  **no product hits**. Neither engine sets them for us: the vendored expo-sqlite amalgamation has no
  `SQLITE_DEFAULT_WAL`/`SQLITE_DEFAULT_BUSY_TIMEOUT`/`SQLITE_DEFAULT_FOREIGN_KEYS` define and the
  Android build flags (`expo-sqlite/android/build.gradle:27-38`) add only
  `SQLITE_ENABLE_* / SQLITE_TEMP_STORE`, so the device runs SQLite defaults
  (`journal_mode=delete`, `synchronous=FULL`, `busy_timeout=0`, deferred `BEGIN` from
  `adapters/expo.ts:93`). `better-sqlite3` deliberately sets `sqlite3_busy_timeout(db_handle, timeout)`
  with `timeout` defaulting to **5000 ms** and uses `BEGIN IMMEDIATE` (`adapters/node.ts:42`).
- Problem: on device there is no lock-wait tolerance at all and the write transaction begins
  deferred, so the first write inside a transaction can fail instantly with `SQLITE_BUSY`/“database
  is locked” *after* work has been done, and (worse) a deferred `BEGIN` cannot be rescued by a busy
  handler once it must upgrade its lock. The test suite cannot reproduce either because it has a
  5 s retry window, `BEGIN IMMEDIATE`, and a different engine.
- Why it matters: any path where a second connection to `brain-training.db` exists turns every
  write into a coin-flip failure instead of a short wait. Concrete, non-hypothetical sources of a
  second handle: (a) `openExpoDatabase(databaseName)` is hard-coded to `{ useNewConnection: true }`
  (`adapters/expo.ts:121-122`), so each init pass necessarily opens a NEW native connection instead
  of the cached one — a failed pass whose `close()` does not physically close (the Android module
  only closes when the handle is still in its cache with refcount 0:
  `expo-sqlite/android/.../SQLiteModule.kt:517-524, 575-590`) leaves a live handle behind while
  `initDatabase` retry opens another; (b) every JS fast-refresh/runtime remount re-evaluates the
  module registry (`instance` lives in module scope, `index.ts:178-180`) and therefore opens a fresh
  handle without closing the previous one (`adapters/expo.ts:26-40` explicitly acknowledges the
  remount case), and both handles write the same file. (The one-pass-per-process guarantee is
  otherwise well tested: `init-retry.test.ts:73-101`.) With `busy_timeout = 0` the loser of a
  concurrent write gets an immediate error, which the repository layer surfaces as a failed
  completion (the user loses the just-played session) rather than a retried write.
- Root cause: connection-level invariants were assumed rather than asserted; the 065 investigation
  (FK-off on a new connection) fixed exactly one instance of this class and left the rest at engine
  defaults.
- Recommended solution: extend `initializeConnection` (single source of truth for both backends) to
  assert the full required pragma set — `PRAGMA foreign_keys = ON`,
  `PRAGMA busy_timeout = <ms>` (mirroring the test backend's effective 5000), and an explicit,
  intentional `PRAGMA journal_mode` choice (document the reason either way: WAL is a deliberate
  non-goal if the team prefers `delete`+`synchronous=FULL` for durability and single-connection
  simplicity) — and switch the device transaction to `BEGIN IMMEDIATE` so a write transaction takes
  its lock up front exactly like the test backend. Optionally expose an `assertPragmas()` used at
  init and by a diagnostics screen/QA artifact.
- Implementation considerations: `journal_mode=WAL` is persistent in the DB header and creates
  `-wal`/`-shm` sidecars — the Android backup-domain exclusion
  (`plugins/with-android-backup-rules.js`, database domain excluded) means no file-copy restore
  hazard, and the app never copies the DB file (see “Checked clean”); `busy_timeout` is per
  connection, so it must be set on every new handle (init is the only open site) and must not be
  attempted while a transaction is pending (SQLite ignores pragmas then); `journal_mode=WAL` also
  changes `synchronous` semantics — set both explicitly if you go that way.
- Dependencies: L01-F01 (same file, same wave); device evidence needed via the ARTEMIS lane.
- Risks: changing `journal_mode` on existing installs is a one-time header rewrite (safe, atomic);
  `BEGIN IMMEDIATE` on device is strictly safer here because the queue already serializes all
  callers, but it will surface a queued nested transaction differently — cover with L01-F01's test.
- Validation required: assert the effective pragma values on device
  (`SELECT * FROM pragma_foreign_keys()` etc. or plain PRAGMAs) at boot and in the QA diagnostics;
  `npx jest src/db`; an ARTEMIS journey that completes a session and imports a backup after a
  deliberate second-handle scenario (dev-only) to prove lock tolerance.
- Completion criteria: `initializeConnection` sets and (in tests) asserts `foreign_keys`,
  `busy_timeout`, `journal_mode`; the device and test backends report the same values for the
  invariants the code relies on; the divergence is recorded in `.agent/VALIDATION.md`.

### L01-F04 — Schema-guard heal is name-only and trigger-only: it cannot restore a weakened same-name guard, an index, a view, or a dropped table

- Severity: P3
- Confidence: confirmed (mechanism + test), impact requires tampering or a divergent duplicate edit
- Category: data-integrity | reliability
- Files: `apps/mobile/src/db/migrate.ts:106-118`, `apps/mobile/src/db/schema.ts:589-596`,
  `apps/mobile/src/db/schema.ts:331-336` vs the copy inside `SQL.createRatingHistory` (`:152-156`),
  `apps/mobile/src/db/schema.ts:389-394` vs the copy inside `SQL.createCurrencyLedger` (`:91-95`),
  `apps/mobile/src/db/__tests__/schema-guards.test.ts:25-42`
- Evidence:
  ```ts
  // migrate.ts:106-118
  const present = await adapter.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'trigger'");
  const existing = new Set(present.map((r) => r.name));
  for (const ddl of CANONICAL_TRIGGER_DDL) {
    const name = /IF NOT EXISTS (\w+)/.exec(ddl)?.[1];
    if (name && !existing.has(name)) { await adapter.exec(ddl); }
  }
  ```
  The canonical set is derived by *first-name-wins* dedup (`schema.ts:589-596`
  `if (name && !byName.has(name)) byName.set(name, ddl)`); two trigger names are declared twice in
  `SQL` (`trg_currency_ledger_no_update`, `trg_rating_history_no_delete` — the drop/recreate twins),
  and the guard test compares **names only** (`expect([...migrated].sort()).toEqual([...derived].sort())`).
- Problem: healing is “does a trigger with this name exist?”, not “is the guard the canonical one?”.
  Consequences: (a) if the two copies of a duplicated trigger ever diverge (one is strengthened —
  e.g. a widened column list in the rating-history guard — and the twin is not), the heal restores
  whichever copy appears first in `Object.values(SQL)` order, silently choosing a definition nobody
  verified; (b) a guard that was replaced under the same name (hand-edited/rolled-back DB, a future
  migration that drops and recreates with a weaker body) is never re-canonalized; (c) the crash
  window that motivated the heal also drops *nothing else*, but the same class of loss for the one
  UNIQUE index that carries a natural-key invariant (`idx_rating_history_session_domain`, v12), the
  `currency_balance` view, or a missing table/column is not detected or repaired at all — and
  migrations never re-run because `user_version` is already current.
- Why it matters: the append-only/INTEGER/range guarantees are the product's data-integrity floor
  (constitution §17). A silently weaker or absent guard is invisible: writes keep succeeding and no
  test or runtime check notices until export/restore or a device audit does. The heal raises false
  confidence precisely where it was introduced to remove a crash window.
- Root cause: the heal was scoped to “re-create what is missing” and the canonical set is derived
  from prose SQL with a name-only dedup, so there is no authoritative shape to compare against.
- Recommended solution: (1) make the duplicated trigger definitions single-sourced (export the DDL
  string once and reference it in both places) or add a module-load assertion that duplicate names
  carry byte-identical DDL; (2) extend `ensureSchemaGuards` to compare `sqlite_master.sql` of each
  canonical trigger against the canonical text (normalizing whitespace) and re-create on mismatch,
  not just on absence; (3) add an inventory check for the invariants that live outside triggers —
  the v12 unique index and the `currency_balance` view — and either heal or fail loudly with a
  specific diagnostic.
- Implementation considerations: keep the heal cheap (one `sqlite_master` row scan, as today);
  a mismatch-heal must not run inside a transaction that also drops triggers (the import/wipe path
  owns that window); preserve `IF NOT EXISTS` DDL text so the same strings remain the source of
  truth; keep the existing test's intent (derived == migrated) and add the textual-equality case.
- Dependencies: none; interacts with the data-portability drop/recreate path (`triggers.ts`).
- Risks: re-creating a trigger on mismatch performs DDL at boot — if a future schema change
  intentionally alters a guard, the canonical constant must be updated in the same commit, which
  the byte-equality assertion will enforce.
- Validation required: extend `schema-guards.test.ts` with (i) duplicate-definition equality,
  (ii) a same-name/weaker-body case that gets restored, (iii) a dropped `idx_rating_history_session_domain`
  case; `npx jest src/db`.
- Completion criteria: guard heal is shape-aware, duplicates are provably identical, and the
  index/view inventory is covered by a test.

### L01-F05 — The largest production read path is deliberately exempt from `MAX_READ_LIMIT`; several repository reads remain unbounded

- Severity: P3
- Confidence: confirmed
- Category: performance
- Files: `apps/mobile/src/db/query.ts:27` (`MAX_READ_LIMIT = 10_000`),
  `apps/mobile/src/db/sessions.ts:943-946` and `:953` (`listProgressProjection` “passed through
  unclamped”), `apps/mobile/src/analytics/queries.ts:32,51-52,64,77`,
  `apps/mobile/src/db/workout.ts:821-846` (`sessionsForInstances`, no `LIMIT`),
  `apps/mobile/src/db/workout.ts:167-200` (`deleteEmptyWorkoutInstances` scans every row at boot),
  `apps/mobile/src/db/quests.ts:221` (`listAllProgress`)
- Evidence: `analytics/queries.ts:32` `export const ALL_SESSIONS_LIMIT = 1_000_000;` is used for the
  session projection **and** the full rating history on every Progress load
  (`:51 db.ratings.getHistory(ALL_SESSIONS_LIMIT, throughMs)`,
  `:52 tryLoadProjectedSessionRows(db, null, ALL_SESSIONS_LIMIT, throughMs)`), and the repository
  documents that this limit is intentionally not clamped (`sessions.ts:943-946`). Measured scale
  evidence exists for 20k sessions only (`scripts/perf/baselines/perf-baseline-2026-09-18…json`:
  `loadProgressSnapshot_20000_ms: 103.5`); nothing bounds the cost for 10× that, and `listRecent`
  gets the same 1e6 limit as the legacy fallback (`:64`).
- Problem: the “bounded reads” policy that `MAX_READ_LIMIT` implements for new APIs does not apply
  to the biggest existing one, so the rule is documentation rather than an enforced invariant.
  Three smaller reads are unbounded outright: `sessionsForInstances` (no `LIMIT`; in practice
  bounded by the 14-instance history page, but `getWorkoutSummary(key)` for an old key would scan
  every session since that key's `createdAt`), the boot janitor (every workout row, every launch),
  and `listAllProgress` (every quest-progress row ever; currently no production caller).
- Why it matters: the Progress tab materialises the entire session history (narrow rows, so ~15 ms
  per 20k) plus the entire rating history into JS objects on every focus. With a multi-year history
  this becomes visible jank/GC pressure on a mid-range Android device, and memory scales linearly
  with history on a platform where OOM is fatal — while every other read in the layer is capped at
  10k.
- Root cause: the projection (“narrow columns, no blob parse”) fixed the measured cost problem
  without introducing pagination; the unclamped limit was kept deliberately to preserve output
  parity with the legacy full-row path.
- Recommended solution: keep the parity contract but bound the work: return a paged/`limit`-capped
  projection plus an explicit `truncated`/cursor flag that analytics surfaces honestly (the
  screen already has an `ALL`-history notion), or compute the lifetime aggregates the screen needs
  via the existing one-statement pushdowns (`getSessionWindowAggregate`, `getDailySessionCounts`)
  instead of materialising rows. Add `LIMIT` to `sessionsForInstances` (one row per
  instance-leg is enough for the summary contract) and count-based pruning to the boot janitor.
- Implementation considerations: `listProgressProjection` is load-bearing for the Progress parity
  tests (`analytics/__tests__/projections-differential.test.ts`) — any cap must be observable and
  tested; keep `getHistory`/`listByGame` unclamped for export/repair callers (they are documented
  all-history APIs) and cap only the screen-facing loaders.
- Dependencies: analytics lanes own the screen-facing contract; coordinate before changing output.
- Risks: silently truncating history would corrupt “lifetime” numbers — the cap must be explicit in
  the return shape, never implicit.
- Validation required: perf probe at 20k/50k against the committed baselines
  (`npm run perf:probe`, `scripts/perf/baselines/*`) plus the analytics differential suite; a device
  journey measuring Progress-tab load time on a seeded large DB.
- Completion criteria: every screen-facing read is bounded by an explicit, tested cap or a
  pushdown; the exemption is removed from the repository docs; no parity test changes behavior.

### L01-F06 — Progression sync performs N independent row writes without a surrounding transaction

- Severity: P3
- Confidence: confirmed; impact self-healing
- Category: data-integrity | reliability
- Files: `apps/mobile/src/progression/sync.ts:100-107` (`syncQuestProgress`),
  `:205-207` (`syncAchievements`), `apps/mobile/src/db/quests.ts:169-200` (`recordProgress`),
  `apps/mobile/src/db/achievements.ts:104-107` (`unlock`)
- Evidence:
  ```ts
  for (const evaluation of evaluations) {
    await db.quests.recordProgress({ questId: …, period: …, progress: …, completedAt: … });
  }
  ```
  and `for (const id of evaluateAchievements(…)) { await db.achievements.unlock(id); }`.
  `QuestRepository.recordProgress` itself is three statements (`SELECT` → UPSERT → `SELECT`) with no
  transaction.
- Problem: a kill/failure mid-loop leaves a partially updated period (some quests/achievements
  synced, others not), and `recordProgress`'s read-modify-write is not atomic. The SQL is
  race-safe by construction (`MAX(quest_progress.progress, excluded.progress)` and
  `COALESCE(...)` in `UPSERT_PROGRESS`), so the concurrency half is fine; the partial-completion half
  is not, though it self-heals.
- Why it matters: today the damage is bounded — both syncs recompute their full snapshot from
  history on the next pass and every write is monotonic/`INSERT OR IGNORE` — so the observable effect
  is a delayed quest/achievement update, not lost progress. It is reported because the invariant
  “multi-row progression writes commit together” is claimed nowhere and tested nowhere, and because
  a future incremental (non-recomputing) sync would silently inherit the hole.
- Root cause: the loops were written as simple `await` sequences and the repository APIs take no
  `txn` parameter for these two methods (unlike their siblings), so wrapping them requires a seam
  that does not exist yet.
- Recommended solution: give `recordProgress`/`unlock` the same optional `txn` seam the other
  repositories have, and wrap each sync loop in one `db.transaction(txn => …)`; the transactions are
  short (single-digit milliseconds) and the queue already serializes callers.
- Implementation considerations: `recordProgress` returns the persisted row — inside a transaction
  that is the `txn` read; keep the existing idempotency (a retried sync must remain a no-op);
  `syncQuestProgress` returns its snapshot to callers (Profile reuse) — do not change that contract.
- Dependencies: `progression` lane owns `sync.ts` call semantics.
- Risks: a longer transaction holds the shared queue for the whole evaluation loop — evaluate
  *before* opening the transaction (as today) and only wrap the writes.
- Validation required: fault-injection test (throw after the first write) proving the loop is
  all-or-nothing; `npx jest src/progression src/db`.
- Completion criteria: both loops commit as one unit; existing progression tests stay green.

### L01-F07 — Trigger identifiers are interpolated into connection-level DDL without escaping

- Severity: P3
- Confidence: confirmed (code), requires an attacker-controlled database file to exploit
- Category: security | data-integrity
- Files: `apps/mobile/src/data-portability/triggers.ts:36`, `:47-48`
- Evidence:
  ```ts
  export async function dropTriggers(db: AppDatabase, triggers: TriggerDef[]): Promise<void> {
    for (const t of triggers) { await db.rawExec(`DROP TRIGGER IF EXISTS "${t.name}"`); }
  }
  ```
  `t.name` comes from `sqlite_master.name` (`captureTriggers`, `:28-30`) and is never validated;
  `rawExec` → `execAsync`, which executes **multiple** statements per call
  (`adapters/expo.ts:54-56`). A trigger named `x"; DROP TABLE game_sessions; --` therefore turns the
  drop into two statements. Everything else in the layer is parameterized (see “Checked clean”).
- Problem: identifier interpolation into a multi-statement exec is an injection primitive whose
  input is database content, not user input. Reachability requires a tampered DB file (the Android
  auto-backup rules exclude the `database` domain — `plugins/with-android-backup-rules.js` — and the
  import format carries no trigger DDL, so the app itself can never create such a name), which is why
  this is P3 and not higher.
- Why it matters: defense-in-depth for a component whose whole job is “never leave the append-only
  guards off”: if it ever failed this way it would delete the very tables it protects, while the
  finally-block recreate would then fail too.
- Root cause: SQLite has no bind parameters for identifiers and the code assumed
  `sqlite_master` content is trustworthy.
- Recommended solution: validate `t.name` against `/^[A-Za-z_][A-Za-z0-9_]*$/` and skip/throw
  otherwise, or escape by doubling quotes (`.replace(/"/g, '""')`); both are one-liners.
- Implementation considerations: keep tolerating partially-dropped states (the current `IF EXISTS`
  + recreate-from-captured-`sql` behavior); `t.sql` is re-executed verbatim by design and comes from
  the same source — the same validation argument applies to it, so prefer “validate the name and
  refuse anything outside SQLite's identifier grammar” over escaping alone.
- Dependencies: none.
- Risks: rejecting a non-identifier trigger name would make a corrupted DB fail the wipe/import
  path loudly instead of silently — acceptable and preferable.
- Validation required: unit test with a hostile trigger name in an in-memory DB asserting the drop
  path refuses (or escapes) it and the other tables survive.
- Completion criteria: no unescaped identifier reaches `exec` in `data-portability/**` or `db/**`.

### L01-F08 — `buildDatabaseFromBackup` is a public, unused export whose docstring describes a production file-swap path the singleton connection cannot support

- Severity: P3
- Confidence: confirmed
- Category: architecture | api-contract | docs-dx
- Files: `apps/mobile/src/data-portability/apply.ts:901-920`,
  `apps/mobile/src/data-portability/index.ts:24`, `apps/mobile/src/db/index.ts:178-183, 195-257`
- Evidence: `buildDatabaseFromBackup(parsed, makeAdapter)` is exported from the portability barrel
  and referenced only by `apps/mobile/src/data-portability/__tests__/apply.test.ts:6,335-345`
  (grep over the whole `src` tree). Its comment claims: “Intended for the production ‘replace’ path
  where the transport swaps the physical database file: … the file swap is an atomic OS rename.”
  The production replace path is the in-place transactional one (`applyImport`, `apply.ts:861-898`,
  called from `app/data-management.tsx:352`).
- Problem: the only in-place DB file “swap” design in the tree is incompatible with the rest of the
  persistence layer: `initDatabase` memoizes one adapter/connection (`index.ts:178-183, 195-215`)
  and `getDb()` hands it out everywhere, so after an OS-level rename the app would keep writing to
  the old (now unlinked) inode while all reads served the old snapshot — silent divergence with no
  error. `initializeConnection` + `runMigrations` in that helper also skip `ensureSchemaGuards`,
  the boot janitor and `profile.ensureExists`, i.e. it would produce a database in a slightly
  different boot state than the real startup path.
- Why it matters: it is a loaded gun documented as the production direction. Anyone wiring it later
  (the docstring invites exactly that) gets an app that appears to work and silently loses every
  write made after the swap.
- Root cause: a design that was implemented and tested but never integrated, with a docstring that
  still describes the intent rather than the status.
- Recommended solution: either delete `buildDatabaseFromBackup` (the in-place transactional path is
  the shipped design), or keep it as an explicitly-labelled test/utility helper and document the
  required integration (reset the `initDatabase` singleton, re-run the full boot sequence, and
  prevent any concurrent handle) plus a guard that fails if the singleton is already initialized.
- Implementation considerations: if retained, it should call `ensureSchemaGuards` and the janitor so
  a swapped file starts in the same state as a fresh boot; the app-level integration also has to
  handle the open handle on the old file (close before rename).
- Dependencies: `data-portability` lane; `db` boot sequence.
- Risks: removing an exported symbol — check `index.ts` barrel consumers and tests only (already
  verified: tests only).
- Validation required: `npx jest src/data-portability` after removal, or a guard test asserting the
  helper refuses to run once `initDatabase()` has succeeded.
- Completion criteria: no production-documented file-swap path that bypasses the boot sequence;
  the surviving helper is either removed or explicitly guarded.

### L01-F09 — The export path never validates its own output against the import contract

- Severity: P3
- Confidence: confirmed; exploitability limited to legacy rows outside the current write paths
- Category: data-integrity | api-contract
- Files: `apps/mobile/src/data-portability/serialize.ts:542-551`,
  `apps/mobile/src/app/data-management.tsx:161-186`,
  `apps/mobile/src/data-portability/deserialize.ts:92-141` (validator),
  `apps/mobile/src/data-portability/apply.ts:289-294` (`durationMs` rounding note)
- Evidence: `exportLocalDataBundle` = `readSnapshot` → `buildExportPayload` →
  `serializeEnvelopeWithChecksum`; the UI then writes the text to the transport and reports
  “Exported N sessions …” without ever calling `parseAndValidateBackup` on it. The import validator
  is stricter than the schema for some columns — it requires
  `isSafeInteger(s.xp | startedAt | completedAt | seed | …)` and
  `isSafeInteger(Math.round(s.durationMs))` — while v1…v10 databases were never guarded against
  REALs in those columns (the INTEGER-storage triggers only arrived in v11 and only for new writes).
  The authors clearly hit one instance: `apply.ts:289-294` rounds `durationMs` with the comment
  “Older app versions briefly persisted the monotonic-clock fraction in this INTEGER-declared
  column”, and the validator accepts exactly that one fractional field.
- Problem: the app can produce — and store in its own durable backup directory, presented as the
  user's safety net — a file that its own importer will later refuse wholesale
  (`BackupDataValidationError` is all-or-nothing, `deserialize.ts:445-446`). Any legacy row with a
  fractional `xp`/`seed`/timestamp (the same class of historical deviation that had to be patched
  for `durationMs`) has this effect, and nothing detects it at export time.
- Why it matters: the only recovery path for a lost/replaced device silently refuses the only
  backup the user was told to keep, and the failure is discovered at the worst possible moment.
- Root cause: export and import share types but not a gate; the round trip is assumed, not tested.
- Recommended solution: run `parseAndValidateBackup(text)` (or at least `validateData`-equivalent
  checks) on the produced export before reporting success, and either normalize/round the known
  legacy deviations the way `writeSessions` already does, or surface a specific, actionable warning
  (“N legacy rows would not restore: …”) instead of a green success message. Add a round-trip test:
  export a seeded DB containing legacy-shaped rows → import → expect success.
- Implementation considerations: validation costs one parse of the produced text (already
  materialized); do it after the snapshot, not in the canonicalization walk; keep the export
  deterministic (do not mutate the payload during normalization — normalize the DB read, as
  `writeSessions` does on import).
- Dependencies: `data-portability` lane owns the envelope; UI copy needs updating.
- Risks: a stricter export gate could refuse to export a store that currently exports fine —
  prefer warn-and-report over hard failure, or fix the read-side rounding.
- Validation required: round-trip test with legacy-shaped fixtures; `npx jest src/data-portability`.
- Completion criteria: every export the app reports as successful is one its own importer accepts,
  or the user is told exactly which rows would not restore.

## Checked and found clean

- **Migration engine**: version validation (unique, `> 0`, contiguous pending range, fail-fast before
  any write — `migrate.ts:33-83`), `current > target` rejection and non-integer/negative
  `user_version` rejection, per-migration transaction with `PRAGMA user_version` **inside** it, no
  mutation of the frozen `MIGRATIONS` array, `ALTER TABLE` idempotency guards (v6/v10), v8
  drop-trigger/backfill/recreate inside one transaction, v12 duplicate repair + unique index. All
  covered by 5 migration suites (v1→v12 matrix, failure injection, downgrade, gaps, duplicate sets).
- **ROLLBACK discipline**: both adapters roll back on body failure; the device path preserves the
  body's error if ROLLBACK itself fails (`expo.ts:98-102`); a failing `BEGIN` raises rather than
  silently continuing; `COMMIT` failure is caught by the same handler.
- **FK enforcement**: `foreign_keys=ON` at init for both backends, re-asserted *before* `BEGIN` on
  device (the 065 fix), proven by statement-order test (`adapters/__tests__/expo.test.ts:110-129`),
  and by real FK assertions in `integrity-hardening.test.ts:313-334` / `invariants.test.ts:114-118`.
  No FK enforcement path exists on a second connection because the app never uses
  `withExclusiveTransactionAsync`. `FK_DELETE_ORDER` (`apply.ts:47-62`) is the single source of truth
  for both destructive paths and matches the FK graph (children first, parents after; inserts in
  reverse).
- **Parameterization**: every repository statement binds values positionally; the only `${…}` SQL is
  fixed fragments (`joinAnd`, `buildInPlaceholders`, `chunk`, table-name constants) or the
  integer-validated `PRAGMA user_version`/`LIMIT`/`OFFSET`. `L01-F07` is the sole identifier
  interpolation and comes from `sqlite_master`.
- **Constraint/trigger coverage**: append-only UPDATE/DELETE guards for `currency_ledger`,
  `rating_history`, `xp_awards`; range checks for `normalized_result`, `xp`, `rating`; INTEGER-storage
  triggers for `game_sessions`, `currency_ledger`, `rating_history`, `domain_ratings`, `xp_awards`;
  partial UNIQUE on `operation_id`; UNIQUE (`session_id`,`domain`) on `rating_history`. Empirically
  verified with better-sqlite3 3.53.4 that `INSERT OR IGNORE` does **not** swallow a trigger
  `RAISE(ABORT)` (it throws), while a `CHECK` violation under `OR IGNORE` yields `changes === 0` —
  the only `OR IGNORE` sites with CHECKed columns (`game_sessions`) pre-validate every value in JS
  (`canonicalInteger` / `canonicalNormalizedResult` / `safeInteger`), so the silent-ignore path is
  unreachable there.
- **Invalid-input hardening**: `requireFiniteNumber` (NaN/Infinity rejected), `canonicalInteger`
  (round + safe-integer), `safeInteger`, `requireCurrencyAmount`, `requireLedgerInteger`,
  `isValidSessionCursor`, and an import validator that requires safe integers/ranges per section,
  enforces relational integrity (FK targets present in the same backup), bounds the workout
  game-id list, and rejects the *whole* backup on any issue (no silent row dropping) — all mirrored
  by tests.
- **Idempotency**: session replay (`INSERT OR IGNORE` + pre/post re-read, no double award),
  ledger `operationId` (pre-check + winner re-select on the unique-index race), quest/achievement
  claim gates, streak milestone set, cosmetics `operationId`, workout create/advance/reroll
  compare-and-swap — each with fault-injection tests (`economy.test.ts`, `sessions.test.ts`,
  `workout-repair-cas.test.ts`).
- **All writes through a transaction where it matters**: every multi-statement write path threads the
  `txn` adapter (verified for all 34 non-test `transaction(` sites); single-statement writes are
  inherently atomic. `L01-F06` is the only multi-row write outside a transaction.
- **Corrupt-data degradation**: `fromJson` (sessions), `parseSettings` (profile), `parseJsonOrNull`
  (quests/achievements), metadata parsing, and the projection loader all degrade to null/empty rather
  than throwing, and are tested (`integrity-hardening.test.ts:190-283`,
  `repository-correctness.test.ts:453-…`).
- **Boot idempotence/leak hygiene**: `initDatabase` coalesces concurrent passes, caches the live
  singleton, only closes on a failed pass, and re-asserts idempotence (`init-retry.test.ts:51-101`);
  `getDb()` throws before init, and screens degrade through `useDbData`.
- **Post-wipe recovery**: the profile and versioned catalogs are restored in-process after a wipe
  (`progression/seeding.ts:77,108` via `refreshProgression`), with a user-visible message if that
  fails; the workout consumers are notified.
- **Backup/restore of the DB file itself**: the app never copies the SQLite file (no file-swap path
  wired); the Android `database` domain is excluded from cloud backup/device transfer
  (`plugins/with-android-backup-rules.js`), so no `-wal`/`-shm` or stale-file hazard exists; the
  durable backup is the versioned JSON envelope, whose checksum, format version, size cap and
  cross-section FK references are all gated before any write.
- **Date/time**: all persisted timestamps are Unix epoch **milliseconds** in INTEGER columns, with
  `completed_at >= started_at` and `duration_ms >= 0` as table CHECKs; day keys are documented per
  convention (`'localtime'` for streaks/`getDistinctActivityDates`, `utcDateKey` for analytics), and
  the only UTC-day repository API (`getDailySessionCounts`, `sessions.ts:905-928`) has no production
  caller, so no user-visible split exists today.
- **`PRAGMA integrity_check` / `foreign_key_check`**: never run by the app; device QA evidence is
  produced by external tooling (`.agent/VALIDATION.md` records `integrity_check=ok`, `schema v12`,
  `0 FK`), and the code-side guards make in-app corruption repairable rather than detected. No
  defect found, but the divergence detection is external-only — worth knowing when reading device
  evidence.
- **Test suite state**: `npx jest src/db` → 21 suites / 231 tests pass (34.25 s).

## Not covered / could not verify

- **The deadlock on real hardware/simulator** (L01-F01): the evidence is a faithful re-implementation
  of the adapter primitives, not a device run (device execution is out of scope for this lane). A
  single ARTEMIS journey or an on-device nested-transaction probe would confirm it end-to-end.
- **The effective device pragma values** (`journal_mode`, `busy_timeout`, `synchronous`) were derived
  from the vendored amalgamation + Android build flags, not read from a device; L01-F03's fix should
  be accompanied by an on-device pragma snapshot.
- **Native `close()` refcount semantics** (`SQLiteModule.kt:517-590`): whether a failed init pass can
  leave a live handle open on device (and therefore create the two-connection scenario in L01-F03)
  requires device instrumentation.
- **Whether any row in a real user store actually violates the import validator** (L01-F09):
  reachability is inferred from the historical `durationMs` deviation that the team already had to
  patch; no legacy DB sample was available to confirm a second violating field.
- **`JSON1` availability on the shipped expo-sqlite build**: core since SQLite 3.38 and the app's SQL
  uses only `json_valid/json_type/json_extract`, but I did not verify the compiled feature set on
  device (the analytics loader already treats it as a runtime capability and falls back).
- **`sync/**` writers**: the sync engine is a no-op seam with no DB writes; its change-log is
  in-memory. Nothing in this lane depends on it.
- **iOS**: `expo-sqlite`'s iOS build flags/pragmas were not inspected (Android-first audit).

## Contradictions with existing documentation

1. **`docs/hardening/post067/PASS_B_RUNTIME.md:14` is wrong for the current adapter.** It records the
   nested-`transaction()` case as “Low (latent) … verified it fails loudly at `BEGIN` without
   corrupting the outer transaction”. With the 065 adapter (commit `5ef707d`), the nested call never
   reaches `BEGIN`: it deadlocks in the queue and wedges every subsequent DB operation (L01-F01).
   This is the explicit “materially new evidence that the accepted debt is worse than recorded” case
   permitted by the lane brief.
2. **`apps/mobile/src/db/__tests__/repository-correctness.test.ts:227-243` pins a contract the device
   does not implement** and explains it with a stale API reference
   (“The expo backend (withExclusiveTransactionAsync) fails equivalently”) that the adapter stopped
   using in 065.
3. **`apps/mobile/src/analytics/projections.ts:97-99`** asserts the repository projection primitives
   “keep working when called inside an outer transaction (where `db.transaction()` would refuse to
   nest)” — true on the Node backend, false on device (a hang, not a refusal).
4. **`apps/mobile/src/db/sessions.ts:943-946` documents the unclamped projection limit as deliberate**
   while `db/query.ts:20-28` documents `MAX_READ_LIMIT` as the policy that “bounds a single page even
   when a caller passes an ‘everything’ number”. Both are true only because the projection is exempt;
   the two statements should be reconciled in one place (L01-F05).
5. **Schema documentation cross-check**: `docs/ARCHITECTURE.md` documents no table-level schema (it
   is explicitly “higher-level than implementation code”), so there is nothing to contradict;
   `openspec/project.md` invariants (SQLite authoritative, append-only currency, atomic session
   completion) are satisfied by the code as written; `.agent/VALIDATION.md`'s repeated “schema v12”
   claims match `SCHEMA_VERSION = 12` and `MIGRATIONS` versions 1…12 exactly. However
   `ARCHITECTURE.md` does **not** document the single-connection + serialized-queue model, which is
   the most consequential concurrency decision in the persistence layer and the source of L01-F01/F03
   — that documentation gap is what let a false “fails loudly” claim survive review.
