# Final Risk Audit — Delta Spec

## ADDED Requirements

### Requirement: Final evidence is exact and classified

The final hardening record MUST include exact source SHA, test/static/build
results, dependency classification, and separate PASS/NOT VALIDATED/BLOCKED
platform evidence.

#### Scenario: Android remains unavailable

- GIVEN the bounded dedicated-device matrix cannot reach a usable boot state
- WHEN the final audit is recorded
- THEN Android runtime is BLOCKED/NOT VALIDATED and local automated evidence is
  not relabeled as a device PASS.

### Requirement: Critical and High regressions block closure

Known Critical/High product, data-integrity, security, or release-signal
regressions MUST be repaired or keep the campaign open.

#### Scenario: Final gate finds a data-loss regression

- GIVEN final adversarial validation detects data loss
- WHEN closure is attempted
- THEN closure is refused until the defect is repaired and revalidated.
