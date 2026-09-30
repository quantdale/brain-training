# Screen State Honesty

## Purpose

Define that every data-driven screen distinguishes loading, loaded, empty, and
failed, and never presents a placeholder or a zeroed fallback to the user as if
it were real data.

## ADDED Requirements

### Requirement: A screen's data state is observable and distinct

A screen that reads persisted data SHALL distinguish four states: the data is
still loading, the data loaded and is non-empty, the data loaded and is empty,
and the read failed. These states SHALL be independently observable by the screen
and SHALL render differently.

A screen SHALL NOT render a zeroed, defaulted, or placeholder representation of
its data while the read is in progress or after the read has failed.

#### Scenario: Read in progress

- **GIVEN** a screen whose data read has not completed
- **WHEN** the screen renders
- **THEN** it renders a loading state
- **AND** it does not render a zeroed or empty-looking data representation

#### Scenario: Read failed

- **GIVEN** a screen whose data read has failed
- **WHEN** the screen renders
- **THEN** it renders an explicit failure state
- **AND** it does not present the absence of data as an empty collection
- **AND** it offers the user a way to recover, such as retrying the read

#### Scenario: Read succeeded with no records

- **GIVEN** a screen whose data read completed successfully with no records
- **WHEN** the screen renders
- **THEN** it renders an empty state
- **AND** that state is distinguishable from the failure state

#### Scenario: Read succeeded with records

- **GIVEN** a screen whose data read completed successfully with records
- **WHEN** the screen renders
- **THEN** it renders the records
- **AND** no loading or failure affordance is shown

#### Scenario: A failing read does not look like "no data yet"

- **GIVEN** a screen that would show an empty-state message when it has no
  records
- **WHEN** its read fails
- **THEN** that empty-state message is not shown

### Requirement: A data-access seam reports its failures

The shared data-access hook used by screens SHALL report loading, success, and
failure distinctly, and SHALL NOT report success when the underlying read
failed. Its returned state SHALL make each of the four states derivable.

A failure SHALL be logged or otherwise made diagnosable, since a screen that
degrades to an empty state is otherwise indistinguishable from a healthy
empty state in production.

#### Scenario: Consumer reads the seam's state

- **GIVEN** a screen consuming the shared data-access hook
- **WHEN** the screen inspects the hook's state
- **THEN** it can determine whether the read is in progress, succeeded,
  succeeded with no records, or failed
- **AND** a failure is never reported as success

#### Scenario: Generation guard still applies

- **GIVEN** a read that completes after its consumer has begun a newer read
- **WHEN** the older read resolves
- **THEN** the newer read's state is not overwritten by the older one
