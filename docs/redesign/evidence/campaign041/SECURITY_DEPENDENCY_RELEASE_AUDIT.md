# Security, Dependency, Offline, and Release Audit

## Secrets and offline boundary

`[VERIFIED_TEST]` Secret validation was clean across 2,282 tracked text files, including its self-test. The offline-boundary validator was clean across 973 source files. No provider credential, signing secret, token, or external ARTEMIS credential was placed in the repository or evidence packet.

`[VERIFIED_BUILD]` The release app was installed and launched after the Metro process was stopped and port 8081 was no longer listening. The release path rendered Home, Games, Game Detail, and Game Intro, and the release screenshot showed no development QA panel. This is current evidence against a hidden Metro dependency for the exercised core routes.

## Dependency audit reconciliation

The repository policy validator passed with five accepted advisory families and no unallowlisted moderate+ production finding. Separately, a direct `npm audit --omit=dev --audit-level=moderate --json` exited 1 and reported 20 reachable-tree findings: 15 moderate and 5 high, 0 critical. The notable families were:

- Expo/Expo Router/config/plugin chain advisories;
- `decode-uri-component` through `query-string`/Expo Router;
- `image-size` through Metro;
- `js-yaml` in the installed tree;
- `uuid` through Xcode tooling.

`[INFERRED]` The discrepancy is policy/reachability classification, not a clean raw audit. The repository validator classifies `uuid`, `image-size`, and `js-yaml` as build/dev-only, accepts the current malformed-deep-link decoder risk pending a compatible Expo Router upgrade, and records the toolchain advisories as accepted debt. Because direct npm audit still exits nonzero, this remains a dependency-owner/release review item. No broad upgrade was attempted: the available fixes are major Expo/Router changes or toolchain churn, and no current product defect was reproduced that would justify that scope during this hardening pass.

## Android release package

`[VERIFIED_BUILD]` Release APK SHA-256: `1FF87618F190513BC04A84BA597BC0BE8764317EA8B5BC4720683EB4BE539DAA`; package `com.braintraining.app`; versionCode 1000; versionName 0.1.0; min SDK 24; target/compile 36; ABIs arm64-v8a, armeabi-v7a, x86, x86_64. Release build completed successfully.

`[VERIFIED_SOURCE]`/`[VERIFIED_BUILD]` Manifest inspection found the expected launch activity and providers: MainActivity exported/launchable, file/share providers not exported with URI grants, and no `android:debuggable` attribute (release default is non-debuggable). `expo.modules.updates.ENABLED=false`, launch wait 0. `allowBackup=true` with full-backup/data-extraction rules remains an explicit platform policy surface.

Permissions include INTERNET, audio settings, legacy external-storage permissions capped at maxSdk32, VIBRATE, network state, wake lock, and the dynamic receiver permission. No unexpected exported component was found in the inspected tree.

`[BLOCKED]` The locally built release artifact is not a production-signed distribution artifact; `adb run-as` correctly refused because the package is non-debuggable, but signing identity/store install was not certified. Human/system backup/share/document-picker behavior remains pending.
