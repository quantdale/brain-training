# Backup Transport Durability

## Purpose

Define the guarantees the application provides when writing, listing, reading,
and replacing backup files: that a crash during a write cannot destroy the
previous backup, that hostile or oversized input cannot exhaust memory, that
every saved backup is discoverable, and that data the application does not
understand is never silently discarded.

## ADDED Requirements

### Requirement: Replacing a backup cannot destroy the previous backup

When a backup with an existing name is replaced, the previous backup SHALL
remain readable until the replacement is fully in place. At no point between
the start and the end of the replacement SHALL the backup name exist with no
readable content, and a termination of the process at any point SHALL leave at
least one complete, readable backup under that name.

The implementation SHALL NOT rely on a destination-replacing rename alone when
the platform's overwrite behavior removes the destination first.

#### Scenario: Successful replacement

- **GIVEN** a backup named `B` exists and is readable
- **WHEN** a new backup is written under the name `B`
- **THEN** exactly one backup is present under that name
- **AND** its content is the new content
- **AND** no temporary artifact remains visible to the user

#### Scenario: Termination during the replacement

- **GIVEN** a backup named `B` exists and is readable
- **WHEN** a new backup is written under the name `B`
- **AND** the process is terminated at an arbitrary point during that write
- **THEN** a subsequent read of `B` yields either the complete previous content
  or the complete new content
- **AND** it never yields a missing, empty, or truncated file

#### Scenario: Failed write leaves the previous backup

- **GIVEN** a backup named `B` exists and is readable
- **WHEN** writing a replacement for `B` fails
- **THEN** `B` still reads as the complete previous content
- **AND** the failure is reported to the caller
- **AND** the reported failure is not masked by cleanup of the temporary file

### Requirement: Temporary write artifacts are not user-visible and are bounded

Partial files created while writing SHALL be identifiable as internal artifacts
and SHALL NOT appear in the user-facing backup listing. A backup name that the
listing would hide as an internal artifact SHALL be rejected before the file is
written, with an actionable message.

#### Scenario: A hidden-by-rule name is chosen

- **GIVEN** a backup name that the listing excludes as an internal artifact
- **WHEN** the user saves a backup under that name
- **THEN** the save is rejected
- **AND** the message states why the name cannot be used
- **AND** no file is created under that name

#### Scenario: Interrupted write leaves an artifact

- **GIVEN** a write that is terminated after the temporary file is created
- **WHEN** the user lists backups
- **THEN** the interrupted artifact is not listed
- **AND** the previously saved backups are listed unchanged

### Requirement: Import diagnostics are bounded in aggregate

Validation of an imported backup SHALL bound the total size of the diagnostics it
accumulates, independent of the number of problems found. When the bound is
reached, the system SHALL report a summary of the remaining problems — including
the total number detected — rather than continuing to accumulate.

The system SHALL NOT convert a size-legal input into an unbounded memory or
storage requirement by the way it reports problems.

#### Scenario: A backup with many invalid entries

- **GIVEN** an imported backup within the accepted size bound that contains a
  very large number of invalid entries
- **WHEN** it is validated
- **THEN** the process completes within a bounded memory footprint
- **AND** the result reports the total number of problems found
- **AND** the result reports that the detailed list was truncated

#### Scenario: A single oversized field

- **GIVEN** an imported backup containing one field far larger than any valid
  field
- **WHEN** it is validated
- **THEN** the offending field is rejected by name
- **AND** the rejection does not embed the full field value in the message

#### Scenario: A valid backup

- **GIVEN** a well-formed imported backup
- **WHEN** it is validated
- **THEN** the complete diagnostic output is produced
- **AND** no truncation notice appears

### Requirement: Content this version does not understand is never silently discarded

When an imported backup contains fields, versions, or structures that the
importing version does not understand, the application SHALL preserve or
explicitly report them, and SHALL inform the user before the import proceeds.
It SHALL NOT complete an import that has silently dropped content the
application previously wrote.

#### Scenario: Importing a backup from a newer version

- **GIVEN** a backup written by a version that recorded a field or structure this
  version does not understand
- **WHEN** the user previews the import
- **THEN** the preview reports that unrecognized content is present
- **AND** the user is given the choice to proceed or to cancel
- **AND** proceeding is recorded as a known-lossy import

#### Scenario: Importing a backup from the same or an older version

- **GIVEN** a backup written by this version or an earlier one
- **WHEN** the user previews the import
- **THEN** no unrecognized-content notice is shown
- **AND** the import proceeds normally
