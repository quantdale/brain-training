# Campaign 037 — Runtime Validation

## Native environment

- Android emulator: `emulator-5554`
- AVD: `braintraining-ui35`
- Android: 15 / API 35
- App: `com.braintraining.app`
- Metro development server: port 8081 with emulator-local ADB reverse
- App data was cleared for the clean after matrix with
  `adb shell pm clear com.braintraining.app`.

## Executed checks

- Android build: `apps/mobile/android/.\gradlew.bat assembleDebug` — **PASS**;
  458 actionable tasks, 55 executed, 403 up-to-date.
- APK install: `adb -s emulator-5554 install -r .../app-debug.apk` —
  **PASS**. APK SHA-256:
  `80E9B29134FB70D7C45E30B7BB0FB6F6E90EE8D358B1880B9FA236E98A877D6A`.
- Clean Home after state: UIAutomator XML contains `home-workout-plan`,
  `a balanced starting set`, `home-local-trust`, and
  `home-workout-continue`.
- Native matrix: `ui-capture.mjs` — **PASS**, 22/22 light/dark surfaces.
- Fresh logcat after clear/launch — **PASS** for the retained sample:
  no `FATAL EXCEPTION`, `SQLiteException`, database-lock, ANR,
  ReactNativeJS error/failed, RedBox, or unresolved-module signatures.
- Focused contracts — **PASS**: Home workout tests 3/3; app-shell tests
  13/13; visual baselines 5/5 snapshots.
- Full Jest — **PASS**: 556 suites passed, 4 skipped; 6,566 tests passed,
  5 skipped; 5 snapshots passed.
- Typecheck and lint — **PASS**.
- Repository validators — **PASS**: repo state, task ownership, affected-map
  sync and strict mapping, offline boundary, provenance, secrets, workflows,
  dependency audit, generated registry, and runtime-QA contract.

The route journeys in `BEFORE_AFTER_NAVIGATION.md` were exercised with
emulator-local ADB/UIAutomator observation. Campaign 037 changed only a
state-dependent Home subtitle and added route regression contracts; no
navigation seam or persistent workflow was rewritten.

## Tooling limits

ARTEMIS and computer-use were not used for Campaign 037. The deterministic
local ADB/UIAutomator and repository capture/audit tools supplied the relevant
evidence. No iOS runtime, physical device, or manual screen-reader session was
available.

