# Documentation Truth — Delta Spec

## ADDED Requirements

### Requirement: R1 ADRs describe shipped behavior

An accepted ADR whose findings or version pins are contradicted by shipped
code MUST be superseded or annotated so a fresh agent is not misled.

#### Scenario: ADR-0005 adjacency

- GIVEN `memory-pattern-tap-back` now enforces adjacency in its generator
- WHEN ADR-0005 is read
- THEN it records that the adjacency differentiation shipped (superseding
  note with the implementing files), not that it is future work.

### Requirement: R2 Status documents match repository reality

MASTER_PLAN, GAME_SDK, the mobile app README, ANDROID_AUTOMATION, the
constitution status line and GOAL.md MUST NOT describe an older phase/state
than the repository actually has; locked product decisions are left untouched.

#### Scenario: Fresh-agent read

- GIVEN a new session reading only the docs
- WHEN it opens MASTER_PLAN/GAME_SDK/README
- THEN it learns the current terminal-campaign state, the real routing path
  (`apps/mobile/src/app`), the real default AVD, and which SDK phases shipped.

### Requirement: R3 Known issues are true

KNOWN_ISSUES and BACKLOG MUST list only findings that still exist; fixed,
misclassified or stale entries are corrected with evidence.

#### Scenario: Late-tap entry

- GIVEN Campaign 024 fixed the late-tap feedback in all three games
- WHEN KNOWN_ISSUES is read
- THEN the entry is gone or marked resolved, alongside the other stale items
  (vigilance screen test, HUD progress, tab labels, xp_awards, sync cap).
