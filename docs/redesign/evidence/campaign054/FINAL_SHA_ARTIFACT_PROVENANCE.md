# Campaign 054 — Final SHA / Release Artifact Provenance

**Status:** VERIFIED — the Campaign 053 runtime artifact is bit-identical to a
fresh forced re-bundle of the current product source.
**Date:** 2026-09-19

## Source provenance

- Campaign 053 runtime artifact source: `02a7ecb`.
- Campaign 053 terminal documentation/governance: `8350db2`.
- Campaign 054 start SHA: `9fe9b41` (remote `main`; adds only the Campaign 054
  prompt markdown).
- `git diff --stat 02a7ecb..HEAD` changes **only** `.agent/**`,
  `docs/redesign/evidence/campaign053/**`,
  `openspec/changes/053-full-system-hardening/**`, and the Campaign 054 prompt.
  **No executable/product source changed** (`apps/**` and `scripts/**` are
  untouched; verified by the diff path list).
- Campaign 054 source change during execution: exactly one dependency lockfile
  patch (`apps/mobile/package-lock.json`, js-yaml `3.15.1→3.15.2` /
  `4.3.1→4.3.2`), which is not part of the app JS bundle.

## Build and artifact identity

- Build: `.\gradlew :app:assembleRelease --no-daemon` in
  `apps/mobile/android`, with generated JS bundle outputs deleted first
  (`app/build/generated/assets/react`, `app/build/intermediates/assets/release`)
  to force a genuine Metro re-bundle from the current tree.
- Result: `BUILD SUCCESSFUL`; the re-bundled `index.android.bundle` is
  byte-identical (SHA-256
  `9B78835286A0F18596BC783B6C97AEFDE867D94271177AF6C502162E4C945244`,
  4,868,032 bytes) and the packaged APK is byte-identical to the Campaign 053
  artifact:

| Property | Value |
| --- | --- |
| APK path | `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` |
| APK SHA-256 | `1B6EBC20498785F9498A769F8F57968D9FB18C63DBBB19528F3E4954B0FB985F` |
| APK size | 109,586,373 bytes |
| Package / version | `com.braintraining.app` / `versionName 0.1.0`, `versionCode 1000`, `targetSdk 36` |
| Build mode | release (`assembleRelease`), JS bundled in-APK, **no Metro required** |
| Embedded bundle SHA-256 | `9B78835286A0F18596BC783B6C97AEFDE867D94271177AF6C502162E4C945244` (verified by extracting the APK and hashing `assets/index.android.bundle`) |
| Signing | Android Debug certificate (`CN=Android Debug`), certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` — **not a production/store artifact** |

Because the current tree rebuilds to the exact same APK hash, the Campaign 053
release artifact *is* an exact-current product-bit artifact; Campaign 054 also
exercised this exact APK on the dedicated emulator (see below).

## Runtime identity checks on this artifact (emulator-5554)

From `startup-matrix-results.json` / `coldboot-matrix-results.json`:

- Install: streamed install `Success` (fresh, and reinstall-over).
- Cold launch: `Status: ok`, `LaunchState: COLD`, Home rendered
  (`home-workout-cta`), `TotalTime` 2,343 ms (fresh) / 2,410 ms (cold-booted).
- Force-stop/relaunch: 10 + 4 cycles, all COLD, all Home, `TotalTime`
  827–1,979 ms.
- Offline launch (airplane mode): Home rendered, no error markers.
- Clear-data first launches: Home rendered in all 4 samples.
- Filtered logcat across 30 assessed launches: 0 `FATAL EXCEPTION`, 0 `ANR in`,
  0 `SIGSEGV`, 0 `OOM`, 0 SQLite-fatal, 0 `isn't responding`.

## Disposition

`CLOSED_VERIFIED`: exact final product/source SHA provenance established; the
release APK SHA-256 is recorded; the artifact is Metro-independent and was
runtime-exercised from the current tree. Store signing remains a separate
`MANUAL_PLATFORM_PENDING` boundary (the recorded APK is debug-signed).
