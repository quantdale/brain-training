# Accessibility, Responsive, System-UI & State Matrix

## ADDED Requirements

### Requirement: Responsive evidence must cover the declared profiles

The campaign MUST capture representative Home, Games, Game Detail, Progress,
Profile, and Data Management surfaces in both light and dark themes at compact
and large-font profiles, preserving a semantic hierarchy dump for each image.

#### Scenario: Compact and large-font release captures

- **WHEN** the release artifact is captured under each declared theme/profile
- **THEN** every representative surface MUST be nonblank and route-verified,
  and the capture manifest MUST identify the theme, profile, and surface.

### Requirement: Accessibility target and naming checks remain machine-auditable

Interactive controls MUST meet the 44 dp minimum and expose an accessible name
in the captured hierarchy. Controls partly hidden because the scroll viewport
ends at the native tab bar MUST be reported as clipped evidence rather than
silently counted as measured target failures.

#### Scenario: Accessibility audit over the responsive matrix

- **WHEN** the hierarchy dumps are audited at the matching emulator density
- **THEN** the audit MUST report zero undersized and unlabelled interactive
  nodes, while retaining any clipped entries in the per-surface report.

### Requirement: Fixed navigation remains usable under large system text

Native bottom navigation MUST retain distinct, readable labels and reachable
tab targets under the supported large-font profile. A reproduced collision or
hidden destination MUST receive a focused repair and matrix rerun.

#### Scenario: Large-font tab chrome

- **WHEN** the four-tab shell is rendered with system font scale 2
- **THEN** all four tab destinations MUST remain independently identifiable and
  selectable without label collision or loss of the active state.

### Requirement: State and system-surface boundaries must be truthful

The evidence packet MUST classify fresh, active, completed, empty, error,
offline, search/filter, result, settings, and data states, and MUST distinguish
repository/app evidence from human screen-reader, physical-device, iOS, store,
and external system-surface evidence that was not executed.

#### Scenario: State-matrix closure

- **WHEN** the campaign closes on the dedicated Android release artifact
- **THEN** each required state MUST be marked newly exercised, inherited from a
  matching unchanged source checkpoint, or explicitly NOT VALIDATED with a
  concrete handoff.
