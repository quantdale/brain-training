# Persistence, Migration, Backup/Restore & Corruption Resilience

## ADDED Requirements

### Requirement: Durable-state validation must preserve identity and integrity

The persistence validation campaign MUST exercise fresh initialization,
supported migrations through the current schema, repeated relaunch, and
concurrent-looking writes while checking SQLite integrity, foreign keys,
session identity, workout identity, unique operation keys, and versioned game
metadata.

#### Scenario: Existing v12 data survives a relaunch batch

- **WHEN** the app is force-stopped and relaunched repeatedly against an
  existing v12 database
- **THEN** the app MUST reach its normal start surface without a fatal startup
  error and MUST retain the same durable identities and invariant-clean rows.

### Requirement: Backup previews and imports must be explicit about risk

The data-management flow MUST validate backup manifests and MUST distinguish
non-destructive merge behavior from destructive replace behavior before any
durable write is applied.

#### Scenario: Replaying an identical backup in merge mode

- **WHEN** a valid backup is loaded whose session and ledger identities already
  exist locally
- **THEN** merge preview MUST be valid, MUST report zero new session and ledger
  rows, and MUST NOT mutate the local database until an explicit import action.

#### Scenario: A replace preview is requested

- **WHEN** a valid backup is previewed in replace mode
- **THEN** the preview MUST disclose that current local data will be erased and
  the destructive operation MUST remain separate from preview generation.

### Requirement: Invalid or corrupt backup input must fail safely

The portability boundary MUST reject invalid or corrupt backup input without
leaving partial durable state behind, and its tests MUST cover rollback and
duplicate replay behavior.

#### Scenario: Corrupt backup input is supplied

- **WHEN** import receives malformed JSON, an invalid manifest, or a supported
  schema mismatch
- **THEN** the import MUST report a validation failure and MUST preserve the
  pre-import database contents and integrity state.
