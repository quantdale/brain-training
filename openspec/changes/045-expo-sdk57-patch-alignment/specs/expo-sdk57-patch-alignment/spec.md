# Expo SDK57 patch alignment

## ADDED Requirements

### Requirement: Patch maintenance stays narrow

The campaign MUST align only the package set reported by the current supported
Expo compatibility check and MUST preserve unrelated dependency versions.

#### Scenario: Expo Doctor reports patch drift

- **WHEN** the five SDK57 packages are one patch behind the installed Expo
  expectations
- **THEN** supported Expo tooling MUST update that coherent package/lockfile set
  without a broad major-version modernization.

### Requirement: Runtime validation follows maintenance

The campaign MUST rerun the applicable tests, builds, launch, route, offline,
and Metro-independent checks after package changes.

#### Scenario: Alignment destabilizes the app

- **WHEN** a post-update check finds a current build/startup/runtime regression
- **THEN** the campaign MUST isolate or revert only its package changes and
  document the result before progression.
