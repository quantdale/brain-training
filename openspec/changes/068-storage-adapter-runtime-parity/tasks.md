# Tasks — 068-storage-adapter-runtime-parity

## 1. Re-entrancy guard (Expo backend)

- [x] 1.1 Add a per-native-handle in-transaction flag to the registry that
      already owns the `AsyncOperationQueue` in
      `apps/mobile/src/db/adapters/expo.ts`; key it on the same handle identity
      the queue uses so multi-wrapper and test-double paths keep working.
- [x] 1.2 Reject with a descriptive, typed error (message naming nested
      transaction use and pointing at threading the transaction adapter) when
      `transaction()` is called on an adapter whose handle already has an open
      transaction.
- [x] 1.3 Apply the same rejection to the connection-level `exec()` entry point
      when it is reached from inside a transaction body, and to
      `AppDatabase.rawExec()` in `apps/mobile/src/db/index.ts`.
- [x] 1.4 Set the flag immediately before `BEGIN` and clear it in a `finally`
      that covers `COMMIT`, `ROLLBACK`, and a failed `BEGIN`.
- [x] 1.5 Keep the private inner queue behavior unchanged so `Promise.all`
      inside a transaction body still works and is not reported as re-entrancy.

## 2. Re-entrancy guard (Node backend parity)

- [x] 2.1 Add the equivalent precondition to
      `apps/mobile/src/db/adapters/node.ts` using the driver's own
      in-transaction state, raising the same descriptive error class.
- [x] 2.2 Confirm the legitimate pattern `txn ? write(txn) : transaction(write)`
      (`apps/mobile/src/db/profile.ts`) still resolves without tripping either
      guard; add a test for it.

## 3. Tests for the contract

- [x] 3.1 Replace the nesting assertion in
      `apps/mobile/src/db/__tests__/repository-correctness.test.ts` so it
      asserts the new explicit error and no longer claims the device backend
      "fails equivalently" via `withExclusiveTransactionAsync` (an API the
      adapter stopped using in Change 065).
- [x] 3.2 Add Expo-adapter tests (fake native handle) proving: nested
      `transaction()` rejects; a connection-level `exec()` from inside a
      transaction body rejects; a later independent statement on the same
      connection still completes after each rejection; the guard clears after
      both commit and rollback.
- [x] 3.3 Add a Node-adapter test asserting the same rejection, so both
      backends are proven to fail identically.
- [x] 3.4 Keep a jest timeout as a backstop so a future regression surfaces as
      a failing test rather than a hung run.

## 4. Connection-level invariants

- [x] 4.1 Add shared constants for the required connection-level settings and
      apply foreign keys, a non-zero busy timeout, and an explicit journal mode
      in `initializeConnection` (`apps/mobile/src/db/migrate.ts`).
- [x] 4.2 Apply the identical settings in the Node adapter at open time so both
      backends converge by construction.
- [x] 4.3 Read the settings back after initialization and throw a descriptive
      startup error naming the setting that did not take effect.
- [x] 4.4 Add tests asserting the effective values on both backends, including
      that the busy timeout is greater than zero.

## 5. Engine-fact parity contract

- [x] 5.1 Add a parity suite enumerating the engine facts the app depends on:
      engine version, effective connection settings, insert-or-ignore against a
      uniqueness constraint, insert-or-ignore against a check constraint,
      foreign-key enforcement inside a transaction, and JSON function
      availability.
- [x] 5.2 Make the suite report (not silently pass) any fact a backend cannot
      satisfy, and fail on a fact the application actually depends on.
- [x] 5.3 Record the residual engine delta as named, owned boundaries in
      `.agent/VALIDATION.md` with a device-validation note per boundary.

## 6. Documentation and durable state

- [x] 6.1 Amend the `PASS_B_RUNTIME.md` nested-transaction row: keep the
      original text and add the corrected mechanism (the device path blocks
      before reaching `BEGIN`, so the recorded "fails loudly at `BEGIN`" claim
      does not hold for the current adapter), with the evidence that
      invalidated it.
- [x] 6.2 Update `.agent/KNOWN_ISSUES.md` with the corrected severity and the
      remaining latent exposure (a future call site forgetting to thread `txn`).
- [x] 6.3 Note in the adapter's module documentation that the Node backend is
      a behavior model, not a device emulator, and list the known deltas.

## 7. Verification

- [x] 7.1 `npx jest src/db src/data-portability src/workout src/analytics` green.
- [x] 7.2 Full matrix green with no new skips; the jest signal validator passes
      with exact pinning.
- [x] 7.3 Opt-in perf probes (`PERF_PROBE=1`, `LARGE_BACKUP_PROBE=1`) re-run and
      compared against the committed baselines, specifically to confirm the
      journal-mode choice did not regress projection, snapshot, or export cost.
      **Executed 2026-09-30 — all 5 probes passed.** The numeric comparison is
      recorded as **NOT VALIDATED as a regression signal**: two consecutive runs of
      the identical tree 8 minutes apart differ by -77% to +451% per scenario, so
      this host cannot resolve the deltas. The journal-mode question is answered
      structurally instead — all five probes use `:memory:` databases, where a
      journal file cannot exist and the adapter never attempts the change, now
      pinned by an executable assertion. Evidence: `.agent/VALIDATION.md`, Change
      068 §7.3.
- [x] 7.4 `npm run typecheck` and `npm run lint` clean.
- [ ] 7.5 **NOT VALIDATED — device lane not available in this session.** On the
      dedicated AVD, run the three transactional journeys (complete a game, claim
      a reward, reroll a workout) and record the on-device
      `PRAGMA foreign_keys / busy_timeout / journal_mode / synchronous` and
      `sqlite_version()` snapshot as the device half of the parity contract, plus
      confirmation that an existing install (created in rollback-journal mode)
      transitions to WAL on next open without data loss and that the
      `-wal`/`-shm` sidecars are present. No emulator was launched; the task is
      left unchecked rather than reported as done. Tracked in
      `.agent/KNOWN_ISSUES.md` (Change 068) and `.agent/VALIDATION.md`.
