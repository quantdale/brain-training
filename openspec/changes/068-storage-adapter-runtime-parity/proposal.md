# Change 068 — Storage Adapter Re-entrancy Guard and Runtime Parity

## Why

The production SQLite adapter serializes every call through a per-connection
promise queue, and a transaction body runs *inside* the queue slot it holds.
Any repository call made from inside a transaction body that is routed to the
**outer** adapter — the shape produced by forgetting to thread the `txn`
argument — therefore enqueues behind the transaction that is itself awaiting
it. The promise chain wedges for the life of the process: no error, no
rejection, no `COMMIT`/`ROLLBACK`, and every later read or write (session
completion, ledger, profile, every screen) hangs forever.

The Node test backend cannot express this: it passes the **root** adapter into
the transaction body, so the same mistake silently succeeds there (and is even
rolled back with the outer transaction). CI therefore stays green on a defect
that permanently freezes the app on device. The recorded post-067 classification
of this exact case ("verified it fails loudly at `BEGIN`") is factually wrong
for the current adapter, so the risk is also recorded as low-latent.

## What Changes

- **BREAKING (internal contract, no product behavior change on healthy paths):**
  re-entering the outer adapter from inside a transaction body becomes an
  explicit, typed error on **both** backends instead of a silent hang on device
  and a silent success in tests.
- Add an explicit in-transaction guard to the Expo adapter, keyed on the native
  handle, cleared in a `finally` around `BEGIN…COMMIT/ROLLBACK`.
- Give the Node backend the equivalent precondition so both runtimes fail the
  same way.
- Converge the connection-level pragmas the app depends on. `initializeConnection`
  currently asserts only `foreign_keys`; the device connection runs with a
  **0 ms busy timeout** and the SQLite default rollback journal, while the test
  backend gets **5000 ms** and `SQLITE_DBCONFIG_DEFENSIVE` on. Pin
  `busy_timeout` and an explicit `journal_mode` in code that runs on both
  backends, and assert the resulting pragma set at initialization.
- Add a runtime-parity contract suite that pins the *engine facts* the code
  relies on (foreign keys enforced inside a transaction, `INSERT OR IGNORE`
  semantics against triggers and `CHECK` constraints, JSON1 availability) so a
  backend swap can no longer silently change behavior.
- Correct the stale test comment and the stale
  `docs/hardening/post067/PASS_B_RUNTIME.md` classification.

## Capabilities

### New Capabilities

- `storage-adapter-concurrency`: the observable contract of the SQLite adapter
  with respect to transaction re-entrancy, statement serialization, and
  connection-level invariants.

### Modified Capabilities

None. No existing capability spec exists under `openspec/specs/`.

## Impact

- `apps/mobile/src/db/adapters/expo.ts` — queue/transaction guard, pragma set.
- `apps/mobile/src/db/adapters/node.ts` — matching precondition.
- `apps/mobile/src/db/migrate.ts` — `initializeConnection` pragma convergence.
- `apps/mobile/src/db/schema.ts` — shared connection-level pragma DDL.
- `apps/mobile/src/db/__tests__/repository-correctness.test.ts` — replace the
  stale nesting assertion.
- `apps/mobile/jest/setup.js`, `apps/mobile/src/test-utils/*` — parity suite
  wiring; no change to the "tests use the Node backend" decision.
- `docs/hardening/post067/PASS_B_RUNTIME.md`, `.agent/KNOWN_ISSUES.md` — record
  the corrected classification.
- No schema change, no data migration, no user-visible behavior change on
  healthy paths.
