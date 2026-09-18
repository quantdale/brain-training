# Startup, Performance, Resource & Reliability Soak

## ADDED Requirements

### Requirement: Performance evidence must separate launch from content readiness

The runtime soak MUST record a bounded sample of release Activity launch and
semantic content readiness separately, including any UIAutomator or emulator
polling overhead that affects the latter.

#### Scenario: Release force-stop/relaunch sample

- **WHEN** the release artifact is force-stopped and relaunched repeatedly on
  the dedicated emulator
- **THEN** each sample MUST record whether Home content rendered, the Activity
  launch timing, and the filtered app-only error result.

### Requirement: Optimization requires a reproduced material regression

The campaign MUST NOT change product source solely because a timing is
non-zero, and MUST preserve a measured baseline when no material regression is
reproduced.

#### Scenario: Existing performance probes remain bounded

- **WHEN** the 5k/20k query, progress, export, quest, and achievement probes
  pass with timestamped results
- **THEN** the campaign MUST retain those results as evidence and MUST not
  introduce speculative optimization.
