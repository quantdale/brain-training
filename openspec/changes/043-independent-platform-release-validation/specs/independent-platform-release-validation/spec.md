# Independent platform and release-boundary validation

## ADDED Requirements

### Requirement: Release artifacts are independently launchable

The campaign MUST build and inspect a fresh release artifact from the current
validated source, install it on the dedicated Android runtime, and verify
startup and core routes without a Metro/dev-server dependency.

#### Scenario: Release APK starts offline

- **WHEN** the fresh release APK is installed after Metro is unavailable
- **THEN** Home and representative navigation/game/result/relaunch paths MUST
  be observed or explicitly classified with current hierarchy, logs, and
  persisted-state evidence.

### Requirement: External platform boundaries remain truthful

The campaign MUST distinguish executable automation from human, physical,
iOS, screen-reader-quality, signing, store, and system-UI evidence.

#### Scenario: A required platform is unavailable

- **WHEN** no authorized device, human participant, iOS environment, or store
  credential is available
- **THEN** the boundary MUST be recorded as NOT VALIDATED/EXTERNAL and MUST
  NOT be inferred from source, emulator automation, or another platform.

### Requirement: Current defects gate progression

The campaign MUST repair a reproduced severe release, startup, persistence,
migration, backup, session, or workout defect before progressing, while
leaving unrelated product design unchanged.

#### Scenario: A release defect is reproduced

- **WHEN** current evidence demonstrates a product defect in the campaign
  scope
- **THEN** the smallest justified repair and focused regression proof MUST be
  completed before closure or later-campaign progression.
