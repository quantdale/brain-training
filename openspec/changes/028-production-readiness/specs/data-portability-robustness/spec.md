# Data-Portability Robustness — Delta Spec

## ADDED Requirements

### Requirement: P1 Export is single-pass

The production backup export MUST serialize the canonical payload exactly
once, producing byte-identical output to the prior two-pass path, proven by
the existing byte-identity suites.

#### Scenario: Byte identity

- GIVEN a database snapshot
- WHEN the production export runs
- THEN the emitted text equals the canonical serialization and its checksum
  matches, from one canonicalization walk.

### Requirement: P2 Import rejects cross-FK-invalid backups early

Import validation MUST cross-check `questProgress.questId` and
`achievementUnlocks.achievementId` against the backup's own `quests` and
`achievements` id sets and reject with the typed data-validation error before
any mutation.

#### Scenario: Unknown quest id

- GIVEN a structurally valid backup whose quest progress references an absent
  quest id
- WHEN validation runs
- THEN the import is rejected with the typed validation error and no data is
  mutated.

### Requirement: P3 Oversized picked files are rejected before read

File picking MUST reject documents whose declared size exceeds the backup
text cap before the file content is read into memory when the size is
available.

#### Scenario: Oversized document

- GIVEN a picked document larger than the cap with a declared size
- WHEN the picker result is processed
- THEN the import reports the size rejection without reading the document.

### Requirement: P4 Export/import interactions are re-entrancy safe

Preview MUST NOT run concurrently with itself; repeated exports MUST NOT
silently overwrite a previous backup file.

#### Scenario: Double preview tap

- GIVEN a preview already running
- WHEN the user activates preview again
- THEN the second activation is ignored while busy.

#### Scenario: Same-second repeated export

- GIVEN an export that produced a backup file name
- WHEN another export occurs within the same second
- THEN the new file does not overwrite the previous backup.
