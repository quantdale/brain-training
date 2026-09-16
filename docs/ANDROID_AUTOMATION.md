# Android setup and evidence capture

Google ARTEMIS is the authoritative Android runtime-QA controller for this
project. The checkout is external at `D:\Tools\artemis` and is never cloned,
copied, or vendored into the repository. ARTEMIS owns natural-language device
interaction, Flash/Pro task execution, task lifecycle management, and runtime
traces. Read [`ARTEMIS_ANDROID_QA.md`](ARTEMIS_ANDROID_QA.md) for that
workflow.

The repository's `scripts/android/` tools remain deliberately lower-level.
They provision or inspect one emulator, install/reset an APK, collect
diagnostics, and prove that those operations use emulator-local ADB. They are
not a gameplay driver and must not be used to create a second runtime-QA
controller.

## Repository tools

```
scripts/android/
├── common.sh        SDK, ADB, emulator, timeout, and artifact helpers
├── avd.sh           create/boot/stop/reset/snapshot the dedicated AVD
├── install.sh       build/install a debug APK
├── launch.sh        start the app package and inspect foreground state
├── reset.sh         clear app data, uninstall, reinstall, or reset the AVD
├── input.sh         limited emulator-local recovery input (wake/back/etc.)
├── hierarchy.sh     dump and inspect the current accessibility hierarchy
├── screenshot.sh    capture the current emulator framebuffer
├── logs.sh          capture filtered or raw logcat
└── self-test.sh     setup/diagnostic and offline-contract proof
```

All commands are emulator-local and host-input-free. They must not move the
host cursor, inject host keyboard input, steal desktop focus, or rely on
absolute desktop coordinates. Runtime screenshots, hierarchy dumps, and
logcat belong under the gitignored `qa-artifacts/` directory; see
[`QA_ARTIFACTS.md`](QA_ARTIFACTS.md).

## Prerequisites

| Component | Requirement | Check |
|---|---|---|
| Android SDK | `platform-tools`, `emulator`, `cmdline-tools`, API 35 platform/build tools, and a compatible x86_64 image | `adb version`, `emulator -version` |
| JDK | 17+ | `java -version` |
| Virtualization | WHPX or another supported hypervisor | `emulator -accel-check` |
| Node | repository-supported version | `node --version` |

The scripts discover the SDK through `ANDROID_SDK_ROOT`, then `ANDROID_HOME`,
then platform defaults. Useful overrides are:

- `BT_AVD_NAME` — repository helper default `braintraining-qa36`;
- `BT_APP_ID` — default `com.braintraining.app`;
- `BT_APP_ACTIVITY` — default `.MainActivity`;
- `BT_APK_PATH` — debug APK path override;
- `BT_EMULATOR_EXTRA_ARGS` — additional emulator flags;
- `BT_ARTIFACTS_DIR` — default `qa-artifacts/`.

ARTEMIS may use the dedicated `braintraining-ui35` AVD on this host. Confirm
the active serial before any inspection:

```bash
adb devices -l
uv run artemis doctor --json
uv run artemis helper status --serial emulator-5554
```

Use one dedicated AVD at a time. Do not launch a competing emulator or
controller while an ARTEMIS task is active.

## Provisioning and diagnostics

```bash
# Create/boot the repository helper AVD when needed.
scripts/android/avd.sh create
scripts/android/avd.sh boot
scripts/android/avd.sh status

# Build/install or install an already-built debug APK.
scripts/android/install.sh
scripts/android/install.sh --apk apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk

# Launch, inspect, capture, and collect logs.
scripts/android/launch.sh
scripts/android/hierarchy.sh
scripts/android/screenshot.sh --name setup-check
scripts/android/logs.sh --name setup-check

# Reset only when the task or diagnostic requires a clean local state.
scripts/android/reset.sh data
```

On Windows these scripts run from Git Bash/MSYS2. The common helper handles
`.bat` SDK tools and adds hard timeouts so a dead guest does not hang a shell.
`--no-boot` is available on `self-test.sh` when the orchestrator owns the
already-running emulator.

The generic `input.sh` helper is for emulator recovery only, such as waking a
screen or sending Back after a failed setup check. Use ARTEMIS for all game,
workout, resume, scoring, progression, and checkpoint journeys.

## Offline repository contract

This check requires no emulator, provider credential, network, Metro server, or
ARTEMIS checkout:

```bash
node scripts/qa/validate-runtime-qa-contract.mjs
```

The Android self-test additionally verifies ADB reachability, package/display
diagnostics, hierarchy/screenshot/logcat capture, and this offline contract.
It is a setup/evidence gate, not a substitute for ARTEMIS runtime evidence.

## ARTEMIS handoff

The external workflow is:

1. Run `uv sync` and `uv run artemis doctor --json` in `D:\Tools\artemis`.
2. Start or select the single dedicated AVD and install the current debug APK.
3. Use `mobile_run_task` with `--profile flash` for a short smoke journey.
4. Use `--profile pro` for a stateful workout, resume, diagnostic, or
   checkpointed journey.
5. Poll with `mobile_manage_task` and inspect the final trace with
   `mobile_inspect_trace`.
6. Record exact status, trace ID, model/tool failure, and artifact location;
   never turn an incomplete or quota-blocked run into a pass.

ARTEMIS should use the app's live accessibility labels, semantic IDs, deep
links, deterministic seeds, versioned game/scoring metadata, structured logs,
and safe development-only fixture controls. Those observability seams are
part of the app contract and must remain intact.

Credentials belong only in the external ARTEMIS `.env` (or an existing host
environment variable). They must not appear in this repository, Codex config,
task text, screenshots, traces, or command output.

## Troubleshooting

| Symptom | Likely cause | Recovery |
|---|---|---|
| No device in `adb devices` | AVD is stopped or still booting | Run `scripts/android/avd.sh status`, then `boot`/`wait`; confirm only one emulator is active |
| Device is `offline` | Guest boot or ADB transport is incomplete | Wait for `sys.boot_completed=1`; if needed run `adb kill-server` and `adb start-server` |
| Hierarchy is empty | Screen is asleep or a transition is active | Use the recovery-only wake/key path, wait briefly, and capture again |
| APK cannot install | Wrong package, stale build, or incompatible ABI | Rebuild/install with `scripts/android/install.sh`, then inspect `adb logcat` |
| ARTEMIS task is incomplete | External model/device/tool/provider failure | Preserve the trace, classify `BLOCKED` or `NOT VALIDATED`, and do not retry blindly |
| Multiple controllers are present | Another agent or process owns the emulator | Stop the competing controller before continuing; do not drive the same AVD concurrently |
