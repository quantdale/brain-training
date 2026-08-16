# Android Automation Harness

The dedicated Android emulator workflow for autonomous QA of the brain-training
app. Every command in this harness is **emulator-local and host-input-free**:
no host mouse, host keyboard, or desktop coordinates are ever used. All
interaction goes through `adb` (`input`, `uiautomator`, `am start`) or the
emulator console.

Scripts live in `scripts/android/` and share one helper library
(`common.sh`). Runtime artifacts (screenshots, hierarchy dumps, logcat) are
written to `qa-artifacts/` at the repo root (gitignored).

```
scripts/android/
├── common.sh        shared helpers (SDK discovery, adb/emulator, wait-for-boot)
├── avd.sh           create/boot/stop/reset/snapshot the dedicated AVD
├── install.sh       build debug APK (expo run:android) + install
├── launch.sh        am start + wait for foreground
├── reset.sh         clear app data / uninstall / reinstall / emulator cold reset
├── input.sh         tap / swipe / text / key events via adb input
├── hierarchy.sh     uiautomator dump + pretty-print / --find semantic testIDs
├── screenshot.sh    screencap into qa-artifacts/
├── logs.sh          logcat capture into qa-artifacts/
└── self-test.sh     no-host-input harness proof
```

## Prerequisites

| Component | Requirement | Check |
|---|---|---|
| Android SDK | `platform-tools`, `emulator`, `cmdline-tools` (latest), `system-images;android-35;aosp_atd;x86_64`, `platforms;android-35`, `build-tools` | `adb version`, `emulator -version` |
| JDK | 17+ (Temurin/Eclipse Adoptium tested) | `java -version` |
| Virtualization | WHPX (Windows Hypervisor Platform) or other hypervisor backend | `emulator -accel-check` |
| RAM | ≥ 8 GB free recommended; the guest wants 2.5 GB | `wmic OS get FreePhysicalMemory` (see troubleshooting) |

The harness auto-discovers the SDK via `ANDROID_SDK_ROOT`, then `ANDROID_HOME`,
then well-known defaults (Windows: `%LOCALAPPDATA%\Android\Sdk`; macOS:
`~/Library/Android/sdk`; Linux: `~/Android/Sdk`). Override anything via
environment variables (see `common.sh`):

- `BT_AVD_NAME` (default `braintraining35`)
- `BT_APP_ID` (default `com.braintraining.app` — matches `apps/mobile/app.json`)
- `BT_APP_ACTIVITY` (default `.MainActivity`)
- `BT_APK_PATH` (default `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`)
- `BT_EMULATOR_EXTRA_ARGS` (extra emulator flags, e.g. `-memory 4096`)
- `BT_ARTIFACTS_DIR` (default `qa-artifacts/`)

### System image selection and first-boot timing

The AVD creator prefers `aosp_atd` (Android Test Device — fast, headless-friendly,
no Play services) and falls back to `google_apis`. On this host, `google_apis`
cold boots are unstable (emulator 37.1.x segfaults/hangs during the netsim
WiFi handshake); `aosp_atd` is stable. The harness therefore defaults to
`aosp_atd`.

First cold boot of a fresh AVD is slow — expect **15–20 minutes** to
`sys.boot_completed` on a busy dev machine (qemu prints "Boot completed" after
~30 s, but that is only the first boot stage; dexopt and service startup take
much longer). The wait loop logs progress every 30 s. Later boots are fast via
the quickboot snapshot (`fastboot.forceFastBoot=yes` is set on the AVD).

### Missing system image (fallback)

If no API 35 x86_64 image is installed:

```bash
scripts/android/avd.sh sdk-install-image   # installs aosp_atd (preferred, ~1GB)
```

or manually: `sdkmanager "system-images;android-35;aosp_atd;x86_64"`.
If you must use `google_apis`, set `BT_EMULATOR_NO_WIFI=1` (passes
`-feature -Wifi`) — it reduces but does not eliminate the instability.

### Windows notes

- The harness runs in Git Bash (MSYS2). `cmdline-tools` tools are `.bat` files;
  `common.sh` invokes them via `cmd //c` automatically.
- WHPX must be enabled (Windows feature "Windows Hypervisor Platform"). Verify
  with `emulator -accel-check`; output must show `WHPX(...) is installed and
  usable`.
- If the emulator fails to start with an accel error, see Troubleshooting.

## AVD bootstrap

```bash
# Create the dedicated AVD (idempotent) + boot headless + wait for boot:
scripts/android/avd.sh

# Individual steps:
scripts/android/avd.sh create            # create AVD braintraining35 (API 35 x86_64, pixel_7)
scripts/android/avd.sh boot              # boot headless (quickboot), wait for sys.boot_completed
scripts/android/avd.sh boot --no-snapshot  # deterministic cold boot (no quickboot resume)
scripts/android/avd.sh boot --wipe-data    # cold boot with wiped userdata
scripts/android/avd.sh boot --retry 3      # retry up to 3x if the emulator crashes while booting
scripts/android/avd.sh wait             # wait for boot (device already running)
scripts/android/avd.sh status           # RUNNING/STOPPED + serial + boot state
scripts/android/avd.sh stop             # kill the emulator (adb emu kill)
scripts/android/avd.sh reset            # deterministic cold boot (drops snapshots)
scripts/android/avd.sh snapshot-save NAME | snapshot-load NAME | snapshot-list | snapshot-delete NAME
```

Every boot is headless: `-no-window -no-audio -no-boot-anim -gpu
swiftshader_indirect -no-metrics` (software GPU, nothing appears on the host
desktop). Boot waits for `sys.boot_completed=1` and a responsive package
manager (default timeout 600 s, progress logged every 30 s; `--no-wait`
skips the wait). After the first boot, quickboot snapshots make later boots
fast (~30 s).

> AVD snapshots: quickboot is enabled on the AVD (`fastboot.forceFastBoot=yes`),
> so normal boots resume the last snapshot — fast, and stable on this host.
> Use `avd.sh boot --no-snapshot` or `avd.sh reset` when a deterministic cold
> boot is required. Named snapshots are managed via the emulator console
> (`adb emu avd snapshot ...`).

> Driving the emulator from an ephemeral shell (CI runners, agent tool shells):
> those environments often reap background children when the shell exits, so
> `avd.sh boot`'s detached process may not survive. Start the emulator as a
> persistent background process instead (e.g. a task/job with no timeout):
>
> ```bash
> emulator -avd braintraining35 -no-window -no-audio -no-boot-anim \
>   -gpu swiftshader_indirect -no-metrics &
> ```
>
> then use `scripts/android/avd.sh wait` to wait for boot. In a normal
> interactive terminal, `avd.sh boot` works as-is.

## Installing and launching the app

```bash
# Build debug APK and install (requires apps/mobile to build; slow on first run):
scripts/android/install.sh

# Install an already-built APK:
scripts/android/install.sh --skip-build
scripts/android/install.sh --apk path/to/app-debug.apk

# Launch and wait for foreground focus (default timeout 60 s):
scripts/android/launch.sh
scripts/android/launch.sh --timeout 120
scripts/android/launch.sh --component com.braintraining.app/.MainActivity
```

Notes:

- `install.sh` runs `npx expo run:android --no-bundler` from `apps/mobile`. If
  the native project has not been prebuilt yet (earlier waves), it fails
  clearly with a `NOT VALIDATED` message and exit code 2 — the harness itself
  remains usable.
- Debug builds load JS from Metro. Start it separately:
  `cd apps/mobile && npx expo start`. Without Metro, `launch.sh` will report
  the app never reaching the foreground (exit 3) — that is expected behavior,
  not a harness bug.
- `launch.sh` detects the foreground window via `dumpsys window mCurrentFocus`
  with a `dumpsys activity ResumedActivity` fallback, then prints
  `FOREGROUND: ...`.

## Resetting state

```bash
scripts/android/reset.sh data        # pm clear (wipe app data)
scripts/android/reset.sh uninstall   # uninstall the app
scripts/android/reset.sh reinstall   # uninstall + install latest APK
scripts/android/reset.sh emulator    # AVD cold-boot reset (drops snapshots)
scripts/android/reset.sh full        # emulator reset + uninstall
```

## Interacting with the app (all emulator-local)

```bash
# Tap / swipe at coordinates from a hierarchy dump:
scripts/android/hierarchy.sh --find "btn-start"          # prints matching nodes + bounds
scripts/android/input.sh tap 540 1200
scripts/android/input.sh swipe 540 1800 540 600 300

# Text and keys:
scripts/android/input.sh text "hello world"
scripts/android/input.sh key BACK ENTER
scripts/android/input.sh key KEYCODE_APP_SWITCH

# Raw passthrough:
scripts/android/input.sh shell swipe 0 800 0 200 200
```

### Semantic testID flow (recommended for assertions)

React Native `testID` props become `resource-id` in the Android hierarchy:

```bash
# 1. Dump and locate a node by testID:
scripts/android/hierarchy.sh --find "game-start-button"
#   resource-id='game-start-button' text='Start' class='android.widget.Button' bounds='[360,600][720,780]'

# 2. Tap its center:
scripts/android/input.sh tap 540 690

# 3. Assert the result via a fresh dump / screenshot / logcat:
scripts/android/hierarchy.sh --find "game-score-42"
scripts/android/screenshot.sh --name after-tap
scripts/android/logs.sh --filter "ReactNative|AndroidRuntime" --name app.log
```

`hierarchy.sh` also pretty-prints the full XML (`xmllint` when available,
Python `minidom` otherwise) and saves copies with `--save NAME`.

## Evidence collection

```bash
scripts/android/screenshot.sh                 # qa-artifacts/screen-<ts>.png (PNG magic verified)
scripts/android/screenshot.sh --name tap-1    # qa-artifacts/tap-1.png
scripts/android/logs.sh                       # qa-artifacts/logcat-<ts>.log
scripts/android/logs.sh --filter "ReactNative|AndroidRuntime"
scripts/android/logs.sh --crash --tail 200    # crash buffer, last 200 lines
scripts/android/logs.sh --clear               # clear buffer before a scenario
```

## No-host-input proof procedure

Run the self-test after booting the AVD:

```bash
scripts/android/self-test.sh          # boots the AVD if needed, then runs all checks
scripts/android/self-test.sh --no-boot
```

It proves, with pure adb only:

1. `sys.boot_completed=1`.
2. `uiautomator dump` produces a non-trivial hierarchy XML (5+ nodes; the
   aosp_atd home window exposes a minimal tree).
3. `adb exec-out screencap -p` produces a valid PNG (magic bytes checked).
4. **Input round-trip**: `input keyevent KEYCODE_POWER` flips the device
   wakefulness off, a second keyevent restores it — injected input demonstrably
   reaches the system.
5. Best-effort real tap: the center of a `clickable="true"` node is computed
   from its hierarchy `bounds` and tapped; the foreground focus is re-read. A
   missing clickable node (e.g. app not yet installed — the ATD home screen has
   none) is a SKIP, not a FAIL.
6. Logcat capture is non-empty.

Artifacts are written to `qa-artifacts/self-test-*.{xml,png,log}`. Exit code 0
means all hard checks passed.

**Manual audit checklist** (for reviewers): the whole workflow — boot, install,
launch, tap/text/swipe, hierarchy, screenshot, logs, reset — is `adb` +
`emulator` + `am` + `uiautomator` commands; there is no `xdotool`, no
PowerShell `SendKeys`, no desktop coordinate system involved. The emulator
runs `-no-window`, so nothing is even rendered on the host display.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `No device connected. Boot the AVD first` | AVD not running | `scripts/android/avd.sh boot` |
| Emulator exits immediately | Acceleration unavailable | `emulator -accel-check`; enable WHPX (Windows optional feature), then reboot |
| Emulator segfaults right after launch (Windows + google_apis) | netsim WiFi daemon handshake crash (emulator 37.1.x) | Use the default `aosp_atd` image (stable on this host); with google_apis set `BT_EMULATOR_NO_WIFI=1` (`-feature -Wifi`) to reduce crashes |
| `adb shell` hangs / device goes `offline` | Guest still booting (first boot takes 8–20 min), or a killed adb client left the transport half-open | Wait for `avd.sh wait` to report booted; `adb kill-server && adb start-server`; if still offline, `avd.sh reset`. All harness commands carry hard `timeout` guards so a slow guest cannot block forever |
| Device paths like `/sdcard/x` get mangled ("C:/Program Files/Git/sdcard/x") | MSYS/Git Bash path conversion rewrites slash-paths before adb sees them | Harness handles it (`MSYS_NO_PATHCONV=1` + `cygpath` in `common.sh`); when running adb manually from Git Bash, prefix `MSYS_NO_PATHCONV=1` for guest paths |
| Emulator crashes intermittently (segfault) at any point | emulator 37.1.x + WHPX instability on this host (worst with google_apis; aosp_atd is stable enough) | `avd.sh boot --retry 3`; keep host RAM free (guest needs ~2.5 GB); see the `--retry` option |
| First boot seems frozen (qemu CPU not advancing) | Normal on this host: the guest crawls through first-boot dexopt | Be patient; `avd.sh wait` logs progress every 30 s; first boot ≈ 8–20 min, later boots are fast |
| Guest boots extremely slowly / never completes (qemu CPU frozen for 10+ min) | Host memory pressure: the guest needs ~2.5 GB; with < 1 GB free it thrashes (this dev machine saw WSL + Chrome consume 12+ GB) | Free host RAM (WSL `wsl --shutdown`, close browsers), or cap the guest: `BT_EMULATOR_EXTRA_ARGS="-memory 1536"` |
| `uiautomator dump` empty/fails | Screen off, animation in progress, or app not focused | `input.sh key KEYCODE_WAKEUP`; wait 1–2 s; `hierarchy.sh --retry 5` |
| Screenshot not a PNG | Framebuffer not ready (booting) | Wait for boot (`avd.sh wait`), retry; check display state with `input.sh key KEYCODE_WAKEUP` |
| `am start` fails / app never foreground | App not installed, or debug build waiting for Metro | `install.sh`; `cd apps/mobile && npx expo start`; then `launch.sh --timeout 120` |
| `expo run:android` fails | Native `android/` not prebuilt yet | Expected in early waves — see install.sh `NOT VALIDATED` note; retry after prebuild |
| `avdmanager`/`sdkmanager` not found | cmdline-tools missing | `sdkmanager "cmdline-tools;latest"`; harness prints the same hint |
| Input `text` mangling spaces | Shell quoting | Always quote: `input.sh text "a b"` (uses `%s` format internally) |
| Multiple emulators running | The harness only touches the serial whose `avd name` is `braintraining35` | `avd.sh status` prints the serial it considers "ours" |
| PNG corrupted on `adb shell` | Shell mode mangles binary | Harness always uses `adb exec-out` |

## Integration notes

- The orchestrator owns the first real APK build + app smoke test. The harness
  is ready to consume it: `avd.sh boot && install.sh && launch.sh`.
- No `apps/mobile` configuration was changed for this harness. The harness
  reads the app id `com.braintraining.app` from `app.json` (kept in sync via
  `BT_APP_ID` env if it ever changes).
- Everything is reproducible: stable AVD name, quickboot snapshot for fast
  boots, deterministic cold boots on demand, fixed artifact directory,
  timestamped filenames, exit codes (0 ok, 2 build not validated, 3 app not
  foreground).
