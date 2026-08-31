# Deterministic Synchronization — Delta Spec

## ADDED Requirements

### Requirement: Conflict resolution is symmetric

Equal-timestamp conflict resolution MUST produce the same winner regardless of
which side is passed as local or incoming, using stable id/payload tie-breaks.

#### Scenario: Same id and timestamp conflict

- GIVEN two semantically different payloads with equal id and timestamp
- WHEN conflict resolution is called in either argument order
- THEN the same canonical payload wins.

### Requirement: A no-op pull preserves the cursor

When a pull returns no page, the sync engine MUST return the supplied cursor
unchanged rather than rewinding it or returning an ambiguous null.

#### Scenario: Empty page after the current cursor

- GIVEN a caller's current cursor
- WHEN the remote page contains no changes
- THEN the returned cursor equals the supplied cursor exactly.
