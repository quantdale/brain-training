# Campaign 051 Final Native Validation

**Target:** `braintraining-ui35` / `emulator-5554`
**Platform:** Android 15 / API 35, 1080×2400, density approximately 420
**Artifact:** `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

## Artifact and launch

- Release Gradle build — **PASS**.
- APK install with ADB — **PASS**.
- Resolved activity — `com.braintraining.app/.MainActivity`.
- APK size — **109,576,529 bytes**.
- SHA-256 — `C4B05F30CED48400DE677A845ED547FF50245AD7442016E2166496528E26B9B0`.
- Narrow post-capture logcat scan — **0** `FATAL EXCEPTION`, app ANR,
  `OutOfMemoryError`, or `SIGSEGV` markers.

The first release screenshot showed a transient Android System UI “isn't
responding” dialog. It was dismissed through emulator-local UI hierarchy and
the app subsequently rendered the clear Home frame and the remaining routes.
This is retained as a first-capture system boundary, not relabeled as a clean
first-launch result. The debug artifact's Metro-required red screen is a
development-launch limitation and is not product visual evidence.

## Native visual surfaces captured

- Home training console and dominant workout action.
- Games storefront, including poster cards, search, filter chips, and catalog
  count.
- Game Detail poster hero and dominant Play action.
- GameHost intro and tutorial/gameplay stage.
- Progress record view.
- Profile player identity, XP, and streak view.

Results, Rewards, and Data Management were covered by source/component tests
and inherited repository/runtime evidence, but were not each captured as a new
Campaign 051 release screenshot. The complete 42-game native route matrix was
not rerun in this campaign; registry membership and source lifecycle coverage
remain green.

## ARTEMIS evidence

- `mobile_diagnose` reported `ready`; all 5/5 required device checks passed.
- Successful Flash trace: `ceced6a6-a075-4f23-9f4d-a05ed4f944a5`.
- The trace started from Games, opened Sequence Memory detail through the
  visible semantic action, and verified `Play Sequence Memory` completion.

The earlier exploratory Flash trace
`08161201-ec31-4c10-8759-0779829a19ef` was cancelled after it followed an
off-path loop and is not counted as a pass. ARTEMIS traces remain external
evidence under `D:\Tools\artemis\traces` and are not copied into Git.
