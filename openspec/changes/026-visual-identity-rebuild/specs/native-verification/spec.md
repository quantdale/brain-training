# Native Verification — Delta Spec

## ADDED Requirements

### Requirement: R1 Baseline and after captures

The campaign MUST produce a pre-redesign baseline and a post-redesign capture
set for the same surfaces, themes and display profiles on emulator-5560.

#### Scenario: Surface comparison

- GIVEN the owner opens the before/after sets
- WHEN comparing any surface pair
- THEN the visual identity change is immediately apparent (palette, type,
  composition, geometry) rather than a subtle token shift.

### Requirement: R2 Accessibility kept

The a11y audit MUST report 0 sub-44 dp / unlabelled interactive violations
after the rebuild, in both themes.

#### Scenario: Audit

- GIVEN captured hierarchy dumps after the rebuild
- WHEN `scripts/qa/a11y-audit.mjs` runs
- THEN the violation count is 0.

### Requirement: R3 Runtime intact

Autobot canaries (8/8) and the daily-workout journey MUST pass on the
post-redesign head.

#### Scenario: Canaries

- GIVEN the rebuilt app with Metro serving the campaign head
- WHEN the canaries run on emulator-5560
- THEN every canary passes, including force-win, persistence and navigation.

### Requirement: R4 Matrix and validators

The full Jest matrix, `tsc`, `expo lint` and all repository validators MUST
pass on the closure tree, and every existing testID MUST survive.

#### Scenario: Matrix

- GIVEN the closure tree
- WHEN the matrix runs
- THEN all required checks pass or are honestly recorded NOT VALIDATED.

### Requirement: R5 Release artifact

A release artifact MUST be built from the campaign head and its hash recorded,
or the omission recorded as an explicit environment blocker.

#### Scenario: Build

- GIVEN the campaign head
- WHEN `:app:assembleRelease` runs
- THEN it succeeds and the artifact bytes/SHA-256 are recorded.
