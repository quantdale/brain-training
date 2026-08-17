# 009 — Database Integrity, Version Compatibility, and Future Sync Readiness

**Priority:** P2 / platform integrity  
**Depends on:** 001; coordinate migrations with 006–008  
**Primary surfaces:** `apps/mobile/src/db/**`, migrations, DB tests, provenance columns  
**Shared-file owner:** orchestrator

## Problems to correct

- `game_sessions.normalized_result` is not DB-constrained to `[0,1]`.
- session XP and domain ratings lack cheap nonnegative constraints in the canonical schema.
- migration startup does not explicitly reject a DB whose `PRAGMA user_version` is newer than the code supports.
- structured version columns store only integer projections while real game/generator/scoring versions are semantic strings.
- current local AUTOINCREMENT identities are insufficient as the only future merge identity for append-only economy/history objects.

## Migration discipline

All schema changes in this campaign must be additive/migration-safe and covered by both fresh-create and upgrade-path tests. Never patch an already-shipped migration entry in place. Add a new migration version.

The migration must preserve:

- profile/settings;
- all game sessions and raw JSON;
- ledger amounts/order/reasons;
- rating history/current ratings;
- quests/achievements;
- existing indexes/triggers/invariants.

## Required schema integrity

### A. Session checks

Canonical DB constraints should enforce inexpensive invariants at rest:

- `normalized_result >= 0 AND normalized_result <= 1`;
- `xp >= 0`;
- `duration_ms >= 0` (already present; preserve);
- `completed_at >= started_at` (already present; preserve);
- non-empty session/game ids where practical without breaking legacy data.

If SQLite table rebuild is required to add CHECK constraints, write explicit migration tests proving row preservation.

### B. Rating checks

- stored domain rating must be >= configured floor;
- `sessions >= 0`;
- history rows preserve append-only behavior;
- if `applied_delta`/policy version fields are added by Spec 010, enforce basic sanity without blocking legitimate negative deltas.

### C. Full semantic version persistence

Structured session storage must expose full semantic version strings for:

- game version;
- generator version where applicable;
- scoring version;
- content pack id/version where a single principal pack applies, or an extensible provenance JSON field if multiple packs are possible.

Recommended migration approach:

- add TEXT columns (`game_version_text`, `generator_version_text`, `scoring_version_text`) and optional provenance JSON/pack columns;
- preserve legacy integer columns temporarily if removing them would create unnecessary migration risk;
- switch all new writes/reads to the full semantic fields;
- backfill legacy rows from raw result metadata when safely parseable; otherwise preserve an explicit legacy/unknown representation rather than inventing false patch/minor versions.

Do not claim `1` means `1.0.0` if the raw result says otherwise.

### D. Unsupported future schema guard

At initialization:

```text
current user_version > SCHEMA_VERSION
  => refuse normal DB operation
  => surface explicit unsupported-newer-schema error
```

Do not run an older app against a schema it does not understand.

The app shell should distinguish this from optional progression/bootstrap failure. See startup behavior requirements below.

### E. Connection pragmas

Audit every adapter/connection path for required pragmas, especially foreign keys. Add tests proving production adapter initialization applies them. Consider transaction mode/concurrency settings only if supported consistently by Expo SQLite and test adapter.

### F. Stable identities for mergeable append-only objects

Coordinate with Spec 008 to add globally stable identities/idempotency keys to ledger/reward records. Evaluate rating-history identity as well if future merge/rebuild requires it.

The project is still local-first; this does **not** implement cloud sync. It ensures future sync does not require redefining the identity of every historical transaction.

## Startup failure behavior

Not every initialization error is equivalent.

Required classification:

- **canonical DB unavailable/corrupt/unsupported version:** app must show a recoverable storage/startup error surface rather than silently rendering as if persistence works;
- **optional quest/theme/progression seeding failure:** may degrade gracefully, with diagnostics;
- **known migration failure:** transaction rollback leaves previous schema intact and startup reports the failure honestly.

Provide user-safe actions such as Retry. Any destructive reset/clear-data action requires explicit confirmation and should offer backup/export once that product surface exists; do not automatically wipe DB on migration error.

## Required tests

### Fresh schema

- new DB reaches current version;
- all new constraints/indexes/triggers exist;
- invalid normalized result rejected;
- negative XP/rating/session count rejected where contract says so;
- valid rows accepted.

### Upgrade migration

Seed a v1/v2/v3 (and any later pre-006R schema) DB with representative rows, migrate to new version, then assert exact preservation of values and foreign-key relationships.

### Failure rollback

Inject failure midway through new migration and assert user_version/data remain at prior valid state.

### Future-version rejection

Set `PRAGMA user_version = SCHEMA_VERSION + 1`; initialize; assert explicit unsupported-schema error before application repositories proceed.

### Provenance backfill

- rows with complete raw semantic metadata backfill correctly;
- ambiguous/legacy rows get explicit legacy representation;
- new session writes round-trip full semantic versions exactly.

### Startup surface

Component/integration test proves a hard DB initialization failure does not render normal gameplay as if persistence is healthy.

## MUST acceptance criteria

- New migration is forward-only and tested from prior supported schema versions.
- Cheap canonical integrity constraints are enforced in SQLite.
- Newer-than-supported DB is explicitly rejected.
- Full semantic provenance is available in structured new session rows.
- Existing data survives migration.
- Hard storage failure has an honest recoverable app state.
- Stable transaction identities required by Spec 008 are represented safely.
- Full DB tests, typecheck, full suite pass.

## Forbidden shortcuts

- Editing old migration definitions instead of adding a migration.
- Dropping/recreating the DB to simplify migration.
- Backfilling unknown versions with invented semantic strings.
- Catching unsupported schema and continuing with empty-state UI.
- Adding constraints that reject valid legacy rows without a deterministic migration strategy.