# Database Integrity — Delta Spec

## ADDED Requirements

### Requirement: Canonical constraints
SQLite MUST enforce cheap canonical invariants including normalized performance in `[0,1]`, nonnegative session XP, and nonnegative domain ratings. Equivalent constraints may be implemented with CHECKs/triggers where SQLite migration limitations require table rebuilds.

#### Scenario: Invalid performance rejected
- GIVEN a persisted session attempt with performance outside `[0,1]`
- WHEN the write is attempted
- THEN SQLite rejects it via the canonical invariant (CHECK/trigger) rather than storing an out-of-range value.

### Requirement: Newer-schema rejection
If `PRAGMA user_version` is greater than the running code's supported schema version, normal initialization MUST fail with an explicit compatibility error. The app MUST NOT proceed as if the unknown newer schema is supported.

#### Scenario: Unknown newer schema fails init
- GIVEN a DB whose `PRAGMA user_version` exceeds the running code's supported version
- WHEN normal initialization runs
- THEN it fails with an explicit compatibility error and does not proceed as if supported.

### Requirement: Semantic version storage
Persistent provenance MUST retain full semantic version information for game, generator, scoring, and content where applicable. Legacy integer columns MAY be retained during migration but cannot be the only source if they collapse distinct versions.

#### Scenario: Distinct versions remain distinguishable
- GIVEN provenance for `1.0.0` and `1.1.0` of the same game
- WHEN stored and later read back
- THEN full semantic versions remain distinguishable and integer columns are not the sole source if they collapse them.

### Requirement: Storage initialization failure is visible
Failure to initialize the canonical local DB MUST produce a recoverable storage-unavailable app state with retry/diagnostic options. The root MUST NOT silently render a normal-looking app that will later fail only on save.

#### Scenario: Init failure shows recoverable state
- GIVEN canonical DB initialization fails
- WHEN the app starts
- THEN it shows a recoverable storage-unavailable state with retry/diagnostic options instead of a silently normal app that fails only on save.

### Requirement: Migration safety
The migration from the pre-006R schema MUST preserve existing sessions, ledger, profile, ratings/history, quests/achievements, and settings. Migration steps MUST be transactional where supported and repeatedly initializing an already-migrated DB MUST be a no-op.

#### Scenario: Pre-006R data preserved
- GIVEN a pre-006R DB with sessions, ledger, profile, ratings, quests, and settings
- WHEN migration runs and is then re-run
- THEN all existing data is preserved and re-initializing is a no-op.

### Requirement: Historical timestamps remain evidence-correct
Data import/rebuild MUST distinguish event/evidence timestamps from processing timestamps when their semantics differ.

#### Scenario: Evidence time separated from processing time
- GIVEN an imported record whose event time differs from import time
- WHEN the rebuild stores timestamps
- THEN event/evidence timestamps are kept distinct from processing timestamps.