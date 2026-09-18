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
- [x] Apply merge/replace imports to disposable test databases, including a
      mid-import rollback case; do not apply Replace Import to the retained
      catalog device database.
- [x] Write the Campaign 047 evidence packet, validate the OpenSpec change,
      update durable state, commit, and push a coherent checkpoint.

The retained device database was never used as a destructive target. Its
merge/replace previews were valid and non-destructive; the applied destructive
coverage comes from disposable repository fixtures.
