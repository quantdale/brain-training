# Campaign 047 Persistence and Migration Validation

## Focused command

The Campaign 047 focused command ran from `apps/mobile`:

```text
npm run test:ci -- src/data-portability src/db/__tests__/migration-matrix.test.ts src/db/__tests__/migration-robustness.test.ts src/db/__tests__/migration-v10-hardening.test.ts src/db/__tests__/migrations.test.ts src/db/__tests__/integrity-hardening.test.ts src/db/__tests__/invariants.test.ts src/db/__tests__/sessions.test.ts src/db/__tests__/workout.test.ts src/db/__tests__/workout-v2.test.ts src/db/__tests__/repository-correctness.test.ts src/app/__tests__/data-management.test.tsx src/app/__tests__/settings-persist-concurrency.test.tsx src/components/game-host/__tests__/persistence-failure.test.tsx src/components/game-host/__tests__/session-identity.test
```

Result: **28 passed, 1 skipped, 29 total suites; 312 passed, 1 skipped, 313
tests.**

## Covered adversarial cases

The passing suite includes:

- fresh database creation and repeated initialization;
- supported migration matrix and robustness through schema v12;
- duplicate legacy rows, corrupt/negative `user_version`, invalid JSON, and
  corrupt persisted rows;
- migration rollback and no partial writes after a mid-import failure;
- export/serialize/parse/round-trip and checksum validation;
- duplicate backup replay, merge/replace application in disposable fixtures,
  and idempotent wipes/imports;
- duplicate session completion and currency operation replay;
- profile/settings merge and corrupt settings recovery;
- favorites, tutorial, quest/achievement/reward persistence; and
- workout creation, resume-after-interruption, corrupted rows, repair, and
  completion identity.

Existing React/Expo test warnings and deprecated two-argument `findBy*`
timeout warnings were emitted, but no test failed.
