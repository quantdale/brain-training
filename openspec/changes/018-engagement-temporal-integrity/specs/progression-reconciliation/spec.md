# Progression Reconciliation — Delta Spec

## ADDED Requirements

### Requirement: Engagement projections converge on bounded SQLite truth

Home, Rewards, workout, and progression projections MUST recompute from the
same bounded canonical rows after date rollover, catalog changes, or a stale
screen snapshot.

#### Scenario: Catalog changes after a completed workout

- GIVEN a persisted completed workout result and a changed current catalog
- WHEN progression is synchronized or the workout screen reloads
- THEN the result advances the matching persisted instance or is reported as a
  deterministic reconciliation outcome, never silently stranded.

### Requirement: Rollover does not leak future state

Changing the local day MUST not make a future-dated session, quest completion,
or reward visible before its captured as-of clock.

#### Scenario: Day boundary read

- GIVEN rows on both sides of a local date boundary
- WHEN the user-facing projections load
- THEN only rows visible at the projection's captured clock contribute.
