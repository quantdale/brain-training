# Release-candidate certification

## ADDED Requirements

### Requirement: Integrated readiness is evidence-backed

The release candidate MUST be evaluated as an integrated product using current
repository gates and a dedicated supported Android runtime before a readiness
label is assigned.

#### Scenario: The candidate is certified conditionally

- **WHEN** local/native evidence is strong but human, iOS, physical-device,
  signing, or external evidence is unavailable
- **THEN** the result is labelled conditional or partial and each unavailable
  evidence class is listed as NOT VALIDATED rather than inferred.

### Requirement: Core journeys remain recoverable

The certification pass MUST exercise representative workout, game, result,
relaunch, catalog, progress, rewards/data, empty/error, theme, accessibility,
and offline paths without destructive state changes or protected-contract
regressions.

#### Scenario: A route or state seam fails

- **WHEN** a current native journey reveals data loss, duplicate irreversible
  writes, broken session identity, broken migration, or a navigation trap
- **THEN** certification stops at that severe issue until it is repaired and
  revalidated or recorded as blocked.

### Requirement: Catalog and copy claims are truthful

The certification evidence MUST reconcile the generated 42-game catalog and
review current product copy for unsupported intelligence, neurological,
medical, or guaranteed cognitive claims.

#### Scenario: A claim or identity is unsupported

- **WHEN** a catalog identity is missing/mismatched or copy makes an
  unsupported claim
- **THEN** the candidate is not labelled certified until the issue is repaired
  or explicitly classified as a remaining conditional/partial blocker.

