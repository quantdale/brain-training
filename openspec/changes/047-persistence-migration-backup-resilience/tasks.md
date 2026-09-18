# Tasks — Campaign 047

- [x] Run fresh/v12 initialization, migration matrix, robustness, and v10
      hardening fixtures.
- [x] Run portability round-trip, rollback, corrupt/invalid input, duplicate
      import, idempotency, settings, session, and workout tests.
- [x] Run the focused repository persistence suite: 28 suites, 312 tests
      passed, 1 skipped.
- [x] Execute device export and saved-backup load on `emulator-5554`.
- [x] Execute non-destructive merge and replace previews; verify the retained
      database remains unchanged and integrity-clean.
- [x] Run repeated release force-stop/relaunch checks and filtered app logcat.
- [ ] Apply an import to a disposable database, if a safe disposable fixture
      can be created without weakening the retained catalog evidence.
- [ ] Write the Campaign 047 evidence packet, validate the OpenSpec change,
      update durable state, commit, and push a coherent checkpoint.

The unapplied destructive/import task is intentionally explicit. The current
device previews are valid and non-destructive; no data-loss risk is justified
by applying Replace Import to the retained catalog database.
