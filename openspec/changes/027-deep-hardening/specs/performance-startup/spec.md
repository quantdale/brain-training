# Performance and Startup — Delta Spec

## ADDED Requirements

### Requirement: R1 Hot UI paths do not rescan unbounded history

Profile and Progress loads MUST NOT evaluate unbounded session history on
every focus without a documented bound or reuse strategy.

#### Scenario: Profile focus with long history

- GIVEN a long session history
- WHEN the Profile screen regains focus
- THEN quest evaluation uses a bounded/windowed sample (or a documented
  deliberate bound) and the screen does not perform two separate full scans.

### Requirement: R2 Bounds are explicit and restoreable

Any production cap on scanned history MUST be a named, documented constant
with its rationale, not an inscrutable `MAX_SAFE_INTEGER` bypass.

#### Scenario: Quest sample bound

- GIVEN `syncQuestProgress` production inputs
- WHEN the bound is inspected
- THEN it resolves to a named constant (or a documented deliberate full read)
  and the progression suites pin identical quest/achievement outcomes.

### Requirement: R3 Steady-state bootstrap is version-gated

Database schema guards and progression definition seeding MUST be
version-gated so a steady-state boot does not repeat full DDL/upsert work;
first-run and version-mismatch paths MUST still run the full sequence.

#### Scenario: Second boot

- GIVEN a database already at the current guard/seeding version
- WHEN the app initialises
- THEN definition upserts and trigger re-creation are skipped, and a
  fresh/legacy database still receives the full path (fail-closed).

### Requirement: R4 Hot-load latency is attributable

Startup phases and the first Progress snapshot load MUST emit marks on the
existing dev-only perf channel so latency can be attributed; the channel MUST
remain a no-op in release builds.

#### Scenario: Dev boot

- GIVEN a dev build
- WHEN the app boots and Progress first loads
- THEN `[perf]` records cover database init, seeding and the snapshot load.

### Requirement: R5 Export canonicalizes once

Backup export MUST NOT perform two full canonicalization passes when a single
pass preserves the exact envelope bytes and checksum.

#### Scenario: Export

- GIVEN N sessions
- WHEN the backup is exported
- THEN the serialized envelope and checksum are byte-identical to the
  pre-change output and only one canonicalization pass runs (or the deferral
  is recorded with its blocker).
