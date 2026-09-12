# Reliability Tests — Delta Spec

## ADDED Requirements

### Requirement: R1 Session save failure is contracted

A failed session persistence MUST surface to the user, keep results visible,
and never double-write; the contract MUST be pinned by automated coverage.

#### Scenario: Save rejected

- GIVEN a game session that completes
- WHEN the persistence write rejects
- THEN the results view shows the failure state and a retry/next action, and
  the session row count stays consistent with the attempted writes.

### Requirement: R2 Route failure paths are covered

Rewards claims, profile purchases, workout advance, data-management wipe and
export write failures MUST have route-level tests that inject the failure and
assert user-visible handling and state consistency.

#### Scenario: Claim failure

- GIVEN the Rewards route with a claimable item
- WHEN the claim throws
- THEN the user sees an error state and the item remains unclaimed.

### Requirement: R3 Recovery paths are covered

A storage-unavailable retry that succeeds MUST mount the application; a
successful re-initialisation MUST clear the boundary.

#### Scenario: Retry succeeds

- GIVEN the storage-error boundary
- WHEN retry re-initialises the database successfully
- THEN the app renders its normal shell.

### Requirement: R4 Every registered game has a screen test

Every game in the registry MUST have a screen-level test that performs at
least one interaction and asserts persisted/exactly-once behavior.

#### Scenario: Registry sweep

- GIVEN the registered game catalog
- WHEN screen test files are enumerated
- THEN every game id has one, including `math-value-ordering`.
