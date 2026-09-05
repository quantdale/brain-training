# Android Release Gate — Delta Spec

## ADDED Requirements

### Requirement: Clean native release build is proven, not assumed

The Android Build Smoke workflow MUST perform a clean Expo prebuild followed by
release Gradle assembly from that clean native state, and MUST fail if the APK
is missing, implausibly small, contains a prohibited permission, or cannot be
uploaded with its SHA-256 recorded.

#### Scenario: Release assembly succeeds

- GIVEN a clean checkout at the candidate SHA
- WHEN the Android Build Smoke workflow runs
- THEN Gradle assembly completes from the freshly generated native project and
  the APK passes size and permission boundaries before upload.

#### Scenario: Release assembly fails

- GIVEN Gradle assembly fails on the candidate SHA
- WHEN the workflow runs
- THEN the job fails and captures the Gradle build logs as an artifact.

### Requirement: SDK setup fails closed on genuine installation failure

The pinned Android SDK/NDK installation step MUST return the real `sdkmanager`
exit status and MUST verify that the pinned packages are actually installed
before the workflow proceeds.

#### Scenario: Pinned package is not installed

- GIVEN `sdkmanager` cannot install a pinned package
- WHEN the setup step runs
- THEN the step fails with a non-zero status and the workflow does not continue.

#### Scenario: Licenses are already accepted

- GIVEN `android-actions/setup-android` has already accepted SDK licenses
- WHEN the pinned install step runs
- THEN the step succeeds without a redundant interactive license prompt and
  without any producer-side broken-pipe status.
