# Source Identity — Delta Spec

## ADDED Requirements

### Requirement: Runtime evidence is source-bound

Certification MUST verify that the running app exposes the exact expected
source SHA before trusting UI evidence.

#### Scenario: Stale bundle on a clean checkout

- GIVEN the expected source SHA differs from the running bundle marker
- WHEN certification preflight checks the app
- THEN the run fails before gameplay results are certified.
