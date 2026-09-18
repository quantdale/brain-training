# Campaign 042 — Persistence Revalidation

**Status:** `[PASS]` for the changed SQLite startup path and representative
release persistence flows
**Date:** 2026-09-18

## Native database checks

The post-repair combined database
`D:\Temp\campaign042\game\brain-training-after-three.sqlite` returned:

```text
PRAGMA integrity_check       ok
user_version                 12
schema_version               48
completed sessions           3
canonical XP                 138
currency credits / debits   27 / 0
duplicate IDs/operations     none
```

The changed adapter tests cover fresh connection opening, concurrent calls,
transaction ordering, shared native-handle wrappers, and queue recovery after
rejection. Full Jest covers supported migrations, result idempotency, reward
ledger uniqueness, profile/settings persistence, backup/import portability,
and session identity contracts.

## Release observations

- `[PASS]` Favorite: Memory was favorited, force-stopped, relaunched, and its
  detail screen still exposed `Remove from favorites`.
- `[PASS]` Theme: Profile was set to Dark, force-stopped, relaunched, and the
  settings surface still showed `Theme Dark, active`; it was restored to Light.
- `[PASS]` Pause/resume: Sequence Memory gameplay opened the pause overlay and
  Resume returned to gameplay.
- `[PASS]` Offline relaunch: two final release runs with connectivity disabled
  returned to healthy Home without target app-error markers.
- `[PASS]` Three completed sessions remained present in the direct SQLite
  inspection after the release game journeys.

## Fresh/migration/backup boundary

The fresh native connection behavior is validated by the focused adapter suite;
the final runtime device retained its existing evidence database rather than
being destructively wiped. Migration and backup/import paths are covered by
the full repository test suite and repository portability checks. A separate
fresh-install release migration/backup journey was not rerun in this closure
and is therefore not claimed as a new device-level observation.
