# Certification Signal — Delta Spec

## ADDED Requirements

### Requirement: Certification is fail-closed

Certification MUST fail when required Jest/test evidence is skipped, a
diagnostic bypass is supplied, or required launch/evidence artifacts are absent.

#### Scenario: Jest is not validated

- GIVEN a clean-checkout certification run whose Jest result is skipped or
  bypassed
- WHEN certification completes
- THEN it is non-certifying and exits nonzero.

### Requirement: Interaction evidence is semantic

Gameplay certification MUST require a gameplay-state or tapped-node change;
layout/timer churn alone is insufficient.

#### Scenario: Timer-only hierarchy change

- GIVEN a timer changes while the gameplay state and tapped node are unchanged
- WHEN the harness probes interaction
- THEN the probe does not count as a successful interaction.
