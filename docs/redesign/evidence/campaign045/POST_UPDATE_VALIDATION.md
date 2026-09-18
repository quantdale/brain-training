# Campaign 045 Post-Update Validation

**Campaign:** `045-expo-sdk57-patch-alignment`
**Runtime:** dedicated `braintraining-ui35` / `emulator-5554`
**Date:** 2026-09-19

## Local gates

| Check | Result |
| --- | --- |
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run test:ci -- --silent` | **PASS** — 558 suites passed, 6,573 tests passed; 4 suites / 5 tests skipped by the suite; 5 snapshots passed |
| `npx expo export --platform web` | **PASS** — 47 web bundles and 20 static routes exported to `dist` |
| `node scripts/validate-offline.mjs` | **PASS** — 973 source files scanned; no network API outside the allowlist |
| `node scripts/qa/validate-runtime-qa-contract.mjs` | **PASS** |
| `node scripts/validate-workflows.mjs` | **PASS** — 4 workflow files |
| `node scripts/validate-repo-state.mjs` | **PASS** |
| `node scripts/validate-task-ownership.cjs` | **PASS** |

The Jest run emitted existing Testing Library deprecation warnings for the
two-argument `findBy*` timeout form; they did not fail the suite and are not
part of this dependency-only change.

## Android build and artifact

Both native builds completed successfully after alignment:

- `./gradlew.bat assembleDebug --no-daemon`: **BUILD SUCCESSFUL**, 458
  actionable tasks, 111 executed, 347 up-to-date, 2m51s.
- `./gradlew.bat assembleRelease --no-daemon`: **BUILD SUCCESSFUL**, 571
  actionable tasks, 138 executed, 433 up-to-date, 3m16s.

Fresh release artifact:

- Path: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- Size: `109,559,713` bytes
- SHA-256: `003D77C44F215DB9654C5744472874934885E16E5C6FEC4989C511EF0DDC9D85`
- Package: `com.braintraining.app`
- Version: code `1000`, name `0.1.0`
- SDK: min `24`, target/compile `36`
- ABIs: `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`
- Permissions: existing network/audio/storage-v32/vibration/network-state/
  wake-lock set; no location or camera permission

`apksigner verify --verbose --print-certs` passed APK v2 verification. The
artifact is signed with the local Android Debug certificate (`CN=Android
Debug`), so this is a runnable validation artifact, not a store-release
signature.

## Release launch and route smoke

The release APK was installed with `adb -s emulator-5554 install -r -d` without
clearing the dedicated emulator's app data. After a clean logcat and process
stop, cold launch reported:

```text
Status: ok
LaunchState: COLD
TotalTime: 5331 ms
WaitTime: 5504 ms
```

The app remained the resumed `com.braintraining.app/.MainActivity` process and
the Home semantic tree exposed `home-brand`, `home-title`, the workout CTA,
and the four labelled navigation destinations.

The deterministic UI capture harness completed **12/12** captures across:
`home`, `games`, `progress`, `profile`, `game-detail`, and `results`, each in
light and dark themes. The follow-up accessibility audit found **0
violations**: all 65 reported interactive elements were labelled. It retained
the known non-violation observation that the Color Stroop Games card reports a
116dp visible height in both themes.

After the clean launch, filtered application logcat contained no app fatal,
ANR, React Native error, script-load, SQLite, database-lock, or OOM signal.
One earlier `FATAL EXCEPTION` line belonged to the `uiautomator` shell's
`UiAutomationShellWrapper.connect` after an accessibility-dump contention;
the stack was not from the app process, and a clean app-only relaunch was
successful.

## Metro-independent boundary

No Metro process was started and the host had no listener on TCP 8081. The only
ADB reverse entry was the pre-existing `host-27 tcp:8080 tcp:8080`; the release
APK still launched and rendered Home, all route captures, and the result
surface from its embedded bundle.

