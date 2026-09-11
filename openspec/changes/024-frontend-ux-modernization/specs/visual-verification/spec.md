# Visual Verification — Delta Spec

## ADDED Requirements

### Requirement: R1 Native capture capability

The campaign MUST provide native screenshot evidence. The Campaign 023
limitation ("headless `screencap` returns a constant blank frame") MUST be
resolved or recorded honestly with the attempted remedies.

#### Scenario: Real pixels on device

- GIVEN the campaign capture AVD with a GPU-enabled profile
- WHEN `screencap` is taken with the screen awake
- THEN the frame contains rendered app pixels, verified by visual inspection
  rather than file size alone.

### Requirement: R2 Evidence set

For every surface in `screen-hierarchy`, the campaign MUST capture before and
after states, light and dark themes, the default profile, and the
compact/expanded/landscape/font-scale variants required by the responsive spec.

#### Scenario: Evidence manifest

- GIVEN the campaign artifact directory
- WHEN its manifest is read
- THEN it lists surface, profile, theme and file for every capture, including a
  before/after pair per surface.

### Requirement: R3 Scripted, emulator-local capture

Capturing MUST be scripted, MUST be emulator-local, and MUST NOT require host
mouse or keyboard input.

#### Scenario: One-command reproduction

- GIVEN a running capture AVD
- WHEN the documented command is executed
- THEN the evidence set is reproduced without host input.

### Requirement: R4 Structural verification

Beyond pixels, the campaign MUST verify structure: hierarchy dumps confirming
roles, labels and bounds, plus a check that no surface regressed its testID
contract.

#### Scenario: Structure manifest

- GIVEN the capture run
- WHEN its outputs are inspected
- THEN per-surface hierarchy dumps and a testID presence report exist alongside
  the screenshots.

### Requirement: R5 Regression matrix

The campaign MUST run and record: full Jest, `tsc --noEmit`, `expo lint`, the
repository validators (repo-state, task-ownership, registry, provenance,
offline, secrets, workflows), the OpenSpec validation, and the autobot canaries;
and MUST rebuild plus standalone-verify the release artifact from campaign HEAD.

#### Scenario: Matrix recorded

- GIVEN `.agent/VALIDATION.md` at campaign close
- WHEN reviewed
- THEN every check lists its exact command and outcome, with NOT VALIDATED used
  where a check could not run.

### Requirement: R6 No fake green

Any check that could not run MUST be recorded as NOT VALIDATED or BLOCKED with
the reason and what was attempted; unavailable evidence MUST NOT be converted
into PASS.

#### Scenario: Honest classification

- GIVEN the validation entry
- WHEN each PASS is traced
- THEN every one is backed by an artifact or command result in the record.
