# Task Packet 001-d — Android Autonomous Runtime Harness (WP-D)

Campaign: 001-autonomous-foundation
Status: READY
Owner role: coder agent

## Objective

Create the dedicated Android emulator workflow and CLI harness proving no host mouse/keyboard is required:

- Create a dedicated AVD named `braintraining35` (API 35 x86_64, aosp_atd or google_apis image, whichever is installed — check `emulator -list-avds` and `sdkmanager --list_installed`); document fallback if image is missing.
- `scripts/android/avd.sh` — create/boot dedicated AVD headless (`-no-window` or `-no-audio -no-boot-anim -gpu swiftshader_indirect`), wait-for-boot, snapshot/reset.
- `scripts/android/install.sh` — build debug APK (`cd apps/mobile && npx expo run:android` or prebuilt flow) and install to the AVD.
- `scripts/android/launch.sh` — launch app by package/activity via `adb shell am start`, with wait-for-foreground.
- `scripts/android/reset.sh` — clear app data / uninstall-reinstall / emulator cold reset.
- `scripts/android/input.sh` — emulator-local tap/text/swipe via `adb shell input` (coordinates from uiautomator dump or semantic IDs).
- `scripts/android/hierarchy.sh` — `uiautomator dump` + pretty-print XML for semantic testID assertions.
- `scripts/android/screenshot.sh` — `adb exec-out screencap` into `qa-artifacts/`.
- `scripts/android/logs.sh` — `adb logcat` filtered capture into `qa-artifacts/`.
- `docs/ANDROID_AUTOMATION.md` — full workflow documentation: prerequisites (SDK, JDK, WHPX/virtualization), AVD bootstrap, every command, no-host-input proof procedure, troubleshooting.

## Dependencies

- Orchestrator scaffold commit (app exists at `apps/mobile`); APK build may not work until later waves — install/launch scripts must handle `NOT VALIDATED` gracefully until the first successful build.

## Allowed write surfaces

- `scripts/android/**`
- `docs/ANDROID_AUTOMATION.md`
- `qa-artifacts/` (runtime outputs, gitignored)

## Forbidden / shared write surfaces

- `apps/mobile/**` (any file — report needs to orchestrator)
- `scripts/validate-repo-state.mjs` and other root scripts outside `scripts/android/`
- `.github/**`, `.agent/**`, `docs/**` except the one file above

## Completion criteria

- `scripts/android/avd.sh` creates/boots the dedicated AVD headless and waits for `sys.boot_completed`.
- All CLI scripts exist, are executable, and fail with clear messages on missing prerequisites.
- Harness self-test: `scripts/android/self-test.sh` proves hierarchy dump + screenshot + input round-trip on the booted AVD without touching host input (all commands pure adb).
- Documentation covers the full no-host-input workflow.

## Cheap validation

- Run `scripts/android/avd.sh` (orchestrator may defer expensive boot to integration QA; document what was actually run).
- Shell syntax check `bash -n` on all scripts.

## Integration notes for orchestrator

- Orchestrator owns the first real APK build + emulator smoke during integration QA; the harness must be ready to consume it.
- Do not modify `apps/mobile` config (app id, gradle) — report needed app-side settings to orchestrator.

## Result/evidence

(agent fills in)
