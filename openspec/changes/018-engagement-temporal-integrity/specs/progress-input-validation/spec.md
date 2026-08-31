# Engagement Progress Input Validation — Delta Spec

## ADDED Requirements

### Requirement: Quest progress writes have a strict numeric boundary

Quest progress writes MUST reject non-finite, fractional, unsafe, negative, or
otherwise malformed progress and completion timestamps before SQLite mutation.

#### Scenario: Malformed progress delivery

- GIVEN a quest progress update containing `NaN`, a fraction, or an unsafe
  integer
- WHEN the repository records it
- THEN the call fails before mutation and the prior progress row is unchanged.

### Requirement: Quest identities and periods are explicit

Quest and period identifiers MUST be non-empty strings at repository boundaries
so malformed imported or stale callers cannot create ambiguous rows.

#### Scenario: Empty period

- GIVEN an update with an empty quest id or period
- WHEN it is recorded or claimed
- THEN the call fails without writing a progress or claim marker.
