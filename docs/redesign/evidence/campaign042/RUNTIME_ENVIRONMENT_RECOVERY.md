# Campaign 042 — Runtime Environment Recovery

**Status:** `[PASS]` for the dedicated Android technical scope
**Source checkpoint:** `317657757ef611cb50e496a1a4eaf3b850e7b6fd` plus the Campaign 042 results-layout repair
**Date:** 2026-09-18

## Environment

| Item | Observed value | Classification |
| --- | --- | --- |
| Android emulator | `braintraining-ui35`, serial `emulator-5554` | `[VERIFIED]` |
| Android image | Android 15 / API 35 / `sdk_gphone_x86_64` | `[VERIFIED]` |
| Display | 1080 × 2400, density 420 for release responsive runs | `[VERIFIED]` |
| App artifact | `versionName=0.1.0`, `versionCode=1000`, release APK non-debuggable | `[VERIFIED]` |
| Emulator count | One dedicated AVD | `[VERIFIED]` |
| Host interaction | ADB, UIAutomator, screenshots, and ARTEMIS helper only; no host mouse or keyboard injection | `[VERIFIED]` |

The release APK used for the final route and responsive captures had SHA-256
`A15820A6B1CCC9AEDA707550B3DB39E50714166790936137CECAD7CA21981927`.
The debug APK used for development-only checks had SHA-256
`FECB9C4772E419CE59F9CE7A2DFF3A27542FC26A14C70E209EDAB6F1BEA53164`.

## Recovery and readiness checks

- `[PASS]` ADB reported the dedicated emulator ready and unlocked.
- `[PASS]` ADB framebuffer screenshots were non-empty and UIAutomator dumps
  contained app elements.
- `[PASS]` ARTEMIS `doctor` returned ready with 5/5 required checks: device,
  unlock state, helper installation, screenshot, and hierarchy probe.
- `[PASS]` The final release route manifest contains 22 route/theme surfaces
  (11 light and 11 dark); every surface was nonblank and route-verified.
- `[PASS]` The release app loaded from the installed bundle without Metro.
- `[PASS]` Final offline relaunch runs returned to a healthy Home surface with
  no targeted SQLite, `NativeDatabase`, fatal, ANR, or app-error markers.

Raw runtime captures remain outside Git under
`D:\Temp\campaign042\release-after-repair\`, including `routes-final`,
`responsive-final`, `final-transition`, `final-relaunch`, and
`persistence-final`. The committed evidence records the provenance and result;
large screenshots, XML dumps, and logcat files are not copied into the
repository.

## Boundary

The ARTEMIS daemon had historical task-level launch/tap failures during this
campaign, and two direct ARTEMIS game tasks timed out during model planning.
Those are recorded as tooling limitations, not silently converted into app
success. The current ARTEMIS doctor/probe was healthy, while the decisive
game, release, pixel, XML, and persistence observations were independently
made through emulator-local ADB/UIAutomator controls.
