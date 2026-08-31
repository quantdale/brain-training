# Portability and Rollback — Delta Spec

## ADDED Requirements

### Requirement: Backup scope is canonical

An export MUST serialize only the canonical local profile and its related data;
an arbitrary profile selector MUST NOT export another profile's state.

#### Scenario: Foreign profile exists

- GIVEN more than one profile row exists
- WHEN the local export runs
- THEN only the canonical local profile is included.

### Requirement: Replacement is atomic

Replace import MUST preserve the pre-import dataset when validation or mutation
fails, including after append-only guards are temporarily removed for the
narrow replace operation.

#### Scenario: Replacement fails after clearing begins

- GIVEN a valid existing dataset and a valid-looking replacement
- WHEN a write fails during replacement
- THEN the original dataset is recoverable and all append-only guards are
  active again.

### Requirement: One-shot reward identity is source-aware

Merge import MUST deduplicate logical one-shot rewards by their stable source
identity while retaining legitimate generic awards with identical payloads.

#### Scenario: Two generic awards have the same fields

- GIVEN two independent generic XP awards with equal amount/reason/time
- WHEN they are merged
- THEN both remain represented.
