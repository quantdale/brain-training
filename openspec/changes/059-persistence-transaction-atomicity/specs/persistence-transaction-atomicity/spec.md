# Spec — persistence-transaction-atomicity

## ADDED Requirements

### Requirement: Reroll transitions are compare-and-swap

`applyReroll` SHALL apply only when the row still carries the
`reroll_attempt` observed at read time. A concurrent advance or reroll
SHALL surface as a `WorkoutWriteConflictError` (never a silent overwrite
that resurrects played legs). The paid path SHALL roll back the debit with
the conflicted transition (existing atomicity); the hook SHALL refresh and
propagate so existing error surfacing applies.

#### Scenario: Stale reroll loses loudly

- GIVEN instance at `rerollAttempt=0`, two overlapping rerolls read from it
- WHEN both apply
- THEN exactly one commits; the other throws
  `WorkoutWriteConflictError`.

#### Scenario: Honest retry succeeds

- GIVEN a conflicted reroll
- WHEN the caller re-reads and re-applies
- THEN it commits normally.

### Requirement: Failed init passes close what they opened

`initializeDatabase` SHALL close a pass's adapter when that pass fails, so
bootstrap retries never stack native connections. Success-path behavior
SHALL be byte-identical.

#### Scenario: Retry after migration failure leaks nothing

- GIVEN a first pass that opens an adapter then fails
- WHEN a retry runs
- THEN the failed pass's adapter was closed and the retry opens fresh.

### Requirement: Gappy migration sets fail fast over the applied range

`runMigrations` SHALL reject when any version inside the range the run
would apply — `(current, maxApplicable]` — is missing from the set,
naming the missing version, before touching the database.
Single-migration custom sets over a matching database (e.g. lone v6 over
v5) and partial targets remain valid: only the applied range must be
contiguous.

#### Scenario: Gap detected

- GIVEN custom migrations `[1, 2, 4]`
- WHEN running
- THEN it throws naming version 3, with no writes applied.

### Requirement: Boot heals corrupt empty workout rows

Startup SHALL delete `workout_instances` rows whose `game_ids_json`
parses to an empty list (including corrupt JSON and non-arrays), of any
status, in one transaction, reporting the deleted count. Healthy rows
SHALL be untouched.

#### Scenario: Empty rows purged, history preserved

- GIVEN active + completed empty rows plus healthy rows
- WHEN the janitor runs
- THEN empties are gone (count reported), healthy rows byte-identical,
  and `countCompleted` no longer includes the corrupt completed row.

## MODIFIED Requirements

None. All changes are additive guards and healing.

## REMOVED Requirements

None.
