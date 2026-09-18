# Persistence, Migration, Backup, and Restore Audit

## Fresh-state and current database

`[OBSERVED_RUNTIME]` On the dedicated AVD (`emulator-5554`, `braintraining-ui35`, Android API 35), the app was cleared and relaunched from a fresh state. Home rendered with the daily plan, no sessions existed, and the active workout index was 0. A first game was started and later completed through the real workout path.

`[VERIFIED_PERSISTED_STATE]` The current database is at schema/user version 12. Direct SQLite inspection used the app’s actual database at `files/SQLite/brain-training.db` (not the conventional `databases/` directory). `PRAGMA integrity_check` returned `ok` after fresh state, interruption/resume, full completion, wipe, and restore. The device state included the expected profile and quest catalog/progress rows without fabricated gameplay rows.

The workout completion snapshot contained:

| Invariant | Observed value |
|---|---:|
| Workout status | `completed` |
| Selected games | 4 |
| Completed games | 4 |
| Active index after completion | 4 |
| Game sessions | 4 |
| Session XP total | 200 |
| Currency ledger rows | 4 |
| Currency amount per game | +10 |
| Rating history rows | 8 |
| Duplicate gameplay operation IDs | 0 |
| `xp_awards` rows | 0; current path stores authoritative XP on `game_sessions.xp` |

The separate interrupted/resumed state contained one completed session, one +10 currency ledger row, two rating-history rows, and active workout index 1 after force-stop/relaunch. This was inspected before the export/import exercise.

## Schema and migration audit

`[VERIFIED_TEST]` The migration-focused suites passed 13 suites / 172 tests in 14.169s. They cover disposable `better-sqlite3` `:memory:` databases starting at every supported version v1 through v11 and upgrading to v12, populated key rows, v8 duplicate-gameplay backfill behavior, indexes/triggers/views, foreign-key behavior, append-only update/delete guards, idempotency, and future/negative/duplicate migration guards. The robustness suite also checks v1→v8 preservation and v9→v10 metadata.

`[VERIFIED_PERSISTED_STATE]` Current file-backed device databases passed `PRAGMA integrity_check` after real flows. `schema_migrations`/schema version was v12 and the current uniqueness/index/trigger behavior was also exercised by the migration and portability tests.

Bounded coverage gap: `[INFERRED]` the repository migration matrix creates disposable in-memory fixtures rather than maintaining a separate historical on-disk database artifact for every start version. The migration logic and representative rows are exercised, but the exact SQLite file-header/page layout and every historical file-origin quirk are not independently represented. This is a documented non-blocking gap for the current local schema, not proof that every arbitrary historical file is safe.

## Native export/import round trip

`[OBSERVED_RUNTIME]` From the current Data Management route, the app exported a real backup to:

`/files/backups/brain-training-backup_2026-09-18_07-11-16.json`

The pulled artifact was inspected outside the app. It had format `brain-training-backup`, version 1, schema 12, data-portability version 3, and these sections: achievements 37, unlocks 3, currency 1, domain ratings 2, favorites 0, sessions 1, profile, quest definitions 16, quest progress 9, rating history 2, tutorial 1, workout 1, and XP awards 0; total records 74. The claimed canonical checksum and independently recomputed checksum both matched:

`b82d5ed9b4902f28f342dbd46422c90f8ac5d0c2d3594a311c930b608fa038d`

The following sequence was executed on disposable current state:

1. Exported the artifact and pulled it from the emulator.
2. Force-stopped/relaunched and confirmed the backup remained available.
3. Entered the destructive-delete flow and confirmed the database was wiped; integrity remained `ok`, with gameplay sessions, ratings, ledger, workouts, and achievements at 0 while profile/catalog quest rows remained as designed.
4. Loaded the saved artifact. The app displayed a valid replace preview: “Would add 1 sessions and 1 ledger entries after erasing current data.”
5. Applied the two-step confirmation. The restored database had integrity `ok`, one session, two rating rows, one ledger row, one workout, three achievements, and nine quest-progress rows.

`[VERIFIED_TEST]` Portability tests additionally cover canonical checksum, adversarial malformed input, rollback, wipe audit, round-trip, apply, and duplicate/replay behavior. The current native path therefore has both executable and real-artifact evidence.

## Boundaries

`[MANUAL/EXTERNAL_PENDING]` The native test did not claim human validation of Android system document pickers, share sheets, cancellation UX, or external-file-provider behavior. The app-level export/import and rollback path was exercised; system-surface usability remains a handoff item.

