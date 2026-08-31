# Temporal Read Boundaries — Delta Spec

## ADDED Requirements

### Requirement: User-facing snapshots are as-of reads

Progression and user-facing history reads MUST exclude rows later than the
captured safe-integer clock boundary, applying the filter before ordering and
limiting.

#### Scenario: Future imported session exists

- GIVEN a session, XP award, workout completion, or rating row dated after the
  current clock
- WHEN a snapshot is loaded
- THEN the future row contributes neither visible history nor progression.

### Requirement: Maintenance reads retain their explicit contract

Export/repair APIs that intentionally request all history MUST remain
unbounded; adding a user-facing bound MUST be explicit at the call site.

#### Scenario: Export requests all history

- GIVEN a future-dated legacy row
- WHEN an all-history export runs without `throughMs`
- THEN the row is preserved for portability rather than silently discarded.
