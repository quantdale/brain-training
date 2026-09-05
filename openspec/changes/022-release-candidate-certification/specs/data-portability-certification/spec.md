# Data Portability Certification — Delta Spec

## ADDED Requirements

### Requirement: Restore equivalence is proven against authoritative state

A backup created from meaningful device state, restored onto a wiped install,
MUST reproduce the pre-backup authoritative state (sessions, ratings, XP,
achievements, quests/rewards, workout state, portable preferences) with
recorded comparison evidence, and SQLite `PRAGMA integrity_check` MUST pass
after restore.

#### Scenario: Round-trip equivalence

- GIVEN populated campaign-controlled state
- WHEN export → wipe → restore completes
- THEN compared row sets match and integrity_check reports ok.

### Requirement: Adversarial archives fail safely

Truncated, malformed, incompatible-version, duplicate, and interrupted
restore inputs MUST be rejected or rolled back without corrupting or
partially overwriting the existing authoritative database.

#### Scenario: Interrupted restore

- GIVEN a restore interrupted mid-apply
- WHEN the app next opens the database
- THEN the pre-restore state is intact and no partial-restore state is
  observable.
