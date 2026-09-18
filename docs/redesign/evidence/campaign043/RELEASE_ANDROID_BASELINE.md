# Campaign 043 — Android Release Baseline

Status: `PASS` for the executable Android/emulator release scope; human,
physical-device, iOS, VoiceOver, and store-signing lanes remain separate
pending boundaries.

## Artifact and environment

- Validated product/control SHA: `59bc801bbaa047834f78819370aa7a805acb1783`
  (the Campaign 043 activation/control commit; product source was unchanged
  from the Campaign 042-validated source).
- Build command: `apps/mobile/android/gradlew.bat assembleRelease --no-daemon`.
- Result: `BUILD SUCCESSFUL` (571 actionable tasks; 57 executed; 514
  up-to-date).
- APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
- APK size: `109,559,713` bytes.
- APK SHA-256:
  `A15820A6B1CCC9AEDA707550B3DB39E50714166790936137CECAD7CA21981927`.
- Package: `com.braintraining.app`, version `0.1.0` / versionCode `1000`.
- Target/min SDK: target 36, min 24. Native ABIs: arm64-v8a, armeabi-v7a,
  x86, x86_64.
- Installation: `adb -s emulator-5554 install -r -d` succeeded. The release
  package flags did not include `DEBUGGABLE`.

## Metro-independent launch

On the dedicated `braintraining-ui35` / `emulator-5554` Android API 35 runtime,
the app was force-stopped, started from its launcher activity, and observed
until `home-title` appeared in the hierarchy.

- Initial cold launch: `Status: ok`, `LaunchState: COLD`, `TotalTime: 4650 ms`.
- Final post-check cold launch: `Status: ok`, `LaunchState: COLD`, `TotalTime:
  5268 ms`.
- `adb reverse --list` contained only the ARTEMIS helper's `tcp:8080` mapping;
  no Metro `8081` mapping was present. No Metro process was listening on 8081.
- Fresh filtered logcat after the final clean launch: zero matches for fatal
  exceptions, ANR, ReactNativeJS error/Unable markers, RedBox, SQLiteException,
  database-lock, or OOM markers.
- A real nonblank Home frame was visually inspected. The route displayed the
  Brain Training title, workout card, Start workout action, and bottom tabs.

## Release surface matrix

The existing emulator-local `scripts/qa/ui-capture.mjs` harness captured the
following 9 routes in both light and dark themes: Home, Games, Progress,
Profile, Rewards, Data Management, Memory Game Detail, Memory Game Intro, and
Results.

- 18/18 route-verified captures completed with exit code 0.
- The paired `scripts/qa/a11y-audit.mjs` run found 0 violations across all 18
  captures. All interactive nodes were labelled; the two clipped measurements
  were known visible-bound observations, not audit violations.
- Current raw PNG/XML/manifest evidence is retained outside Git under
  `D:\Temp\campaign043-release-matrix` to avoid committing large generated
  artifacts.

## Representative real gameplay

From the release APK, Memory was started at the Easy difficulty and completed
through four ordinary rounds using emulator-local taps. No force-win/force-loss
QA hook was used and no host input was injected. The resulting screen reported
`Session complete`, `0/4` rounds passed, `0%` accuracy, and `+8 XP earned!`.

After a cold process refresh, Data Management reported 1 session, 2 ratings,
2 history rows, and 1 currency-ledger entry. A debug-variant inspection of the
same package data (used only because release `run-as` is correctly unavailable)
confirmed `PRAGMA integrity_check = ok`, no foreign-key violations, no
duplicate session IDs, no duplicate currency operation IDs, and no duplicate
session/domain rating-history rows. The persisted session retained
`forced=false` and the expected versioned Memory metadata.

## Known limitations

This baseline is Android/emulator evidence, not a production-store or human
release approval. See the sibling boundary records and `CAMPAIGN043_CLOSURE.md`.
