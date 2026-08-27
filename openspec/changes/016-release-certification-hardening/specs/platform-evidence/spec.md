# Platform Evidence — Delta Spec

## ADDED Requirements

### Requirement: Android current-head claims use current-head evidence

Post-015 Android runtime claims MUST use evidence generated from the current candidate SHA, not only earlier campaign certification.

#### Scenario: Prior certification exists
- GIVEN an earlier SHA has a 42/42 Android certification
- AND the current candidate changed gameplay or workout behavior after that SHA
- WHEN current release readiness is summarized
- THEN earlier evidence is retained as historical proof but current changed-surface behavior remains NOT VALIDATED until rerun.

### Requirement: Android certification preserves dedicated-device ownership

Android certification MUST use the dedicated brain-training AVD/device and MUST fail closed on foreign-app/device contamination.

#### Scenario: Foreign app owns foreground
- GIVEN another project or package is foreground on the selected device
- WHEN certification preflight runs
- THEN the run aborts before product evidence is recorded.

### Requirement: Emulator recovery is bounded and evidence-driven

If the emulator crashes, the agent MUST execute a bounded compatibility matrix and MUST NOT use repeated blind retries as validation.

#### Scenario: WHPX emulator repeatedly segfaults
- GIVEN the dedicated AVD boots but qemu exits unexpectedly
- WHEN recovery is attempted
- THEN the agent captures environment/log evidence and evaluates the bounded version, rendering, fresh-AVD, and available physical-device alternatives before declaring BLOCKED.

### Requirement: iOS compile compatibility has native evidence

The repository MUST provide macOS/Xcode build-smoke evidence for iOS source compatibility when compatible hosted infrastructure is available.

#### Scenario: Hosted macOS build smoke
- GIVEN a macOS CI runner
- WHEN Expo prebuild, CocoaPods installation, and an iOS Simulator xcodebuild with code signing disabled run
- THEN successful compilation is recorded as iOS build-smoke evidence without implying device UX or store-signing readiness.

### Requirement: Unavailable platform evidence remains explicit

Manual SAF sheets, TalkBack/manual UX, physical-device refresh-rate behavior, and iOS runtime UX MUST remain NOT VALIDATED unless actually performed.

#### Scenario: Static accessibility checks pass
- GIVEN unit/static accessibility semantics are green
- BUT no manual TalkBack session was performed
- WHEN final evidence is written
- THEN manual TalkBack remains NOT VALIDATED.
