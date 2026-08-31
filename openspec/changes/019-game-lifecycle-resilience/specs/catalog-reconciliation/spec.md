# Catalog Reconciliation — Delta Spec

## ADDED Requirements

### Requirement: Drift repair is deterministic and idempotent

Persisted workout game lists MUST be repaired against the current eligible
catalog without launching retired ids, duplicating games, or propagating a
non-finite resume index.

#### Scenario: Corrupt index and retired current game

- GIVEN a workout with a retired current game and a `NaN`/out-of-range index
- WHEN it is reconciled
- THEN the result is a playable deterministic position or a completed/regenerate
  outcome, and repeating reconciliation makes no further change.
