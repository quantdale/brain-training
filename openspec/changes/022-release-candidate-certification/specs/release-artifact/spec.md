# Release Artifact — Delta Spec

## ADDED Requirements

### Requirement: The release candidate is a reproducible clean-state artifact

The campaign MUST produce its Android release artifact from a clean
dependency install, a clean Expo prebuild, and a release Gradle assembly, and
MUST record the artifact SHA-256, size, versionName, versionCode, minSdk,
targetSdk, packaged permissions, and native ABIs at the built SHA.

#### Scenario: Artifact inspected

- GIVEN a release APK built from a clean prebuild at the candidate SHA
- WHEN the inspection step runs
- THEN every recorded field matches the generated native configuration and no
  prohibited or unexpected permission is packaged.

#### Scenario: Unsigned artifact classified accurately

- GIVEN no production signing credentials exist in the repository
- WHEN the artifact is classified
- THEN it is recorded as locally signed release-build evidence, never as a
  Play-Store-signed artifact.

### Requirement: The release artifact runs standalone

The built release artifact MUST install from an uninstalled state on the
dedicated device and complete startup and primary navigation with no Metro
server running.

#### Scenario: Standalone launch

- GIVEN the AVD has no Metro and no dev-server reachability
- WHEN the release artifact is launched
- THEN the app reaches an interactive state and primary tabs function.
