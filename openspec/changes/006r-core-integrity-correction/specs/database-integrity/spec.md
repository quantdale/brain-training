# Database Integrity — Delta Spec

## ADDED Requirements

### Requirement: Canonical constraints
SQLite MUST enforce cheap canonical invariants including normalized performance in `[0,1]`, nonnegative session XP, and nonnegative domain ratings. Equivalent constraints may be implemented with CHECKs/triggers where SQLite migration limitations require table rebuilds.

### Requirement: Newer-schema rejection
If `PRAGMA user_version` is greater than the running code's supported schema version, normal initialization MUST fail with an explicit compatibility error. The app MUST NOT proceed as if the unknown newer schema is supported.

### Requirement: Semantic version storage
Persistent provenance MUST retain full semantic version information for game, generator, scoring, and content where applicable. Legacy integer columns MAY be retained during migration but cannot be the only source if they collapse distinct versions.

### Requirement: Storage initialization failure is visible
Failure to initialize the canonical local DB MUST produce a recoverable storage-unavailable app state with retry/diagnostic options. The root MUST NOT silently render a normal-looking app that will later fail only on save.

### Requirement: Migration safety
The migration from the pre-006R schema MUST preserve existing sessions, ledger, profile, ratings/history, quests/achievements, and settings. Migration steps MUST be transactional where supported and repeatedly initializing an already-migrated DB MUST be a no-op.

### Requirement: Historical timestamps remain evidence-correct
Data import/rebuild MUST distinguish event/evidence timestamps from processing timestamps when their semantics differ.