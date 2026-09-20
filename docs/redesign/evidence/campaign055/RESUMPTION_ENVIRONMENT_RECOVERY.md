# Campaign 055 (resumed) — Environment Recovery

Resumption started at `90169bf73a6d848f21c4b8d7419fc2ac67a0cf7d`; the resumption
prompt commit `18b7851fb9d2b17db0793b72d188b1c14c25fcc5` was fast-forwarded from
`origin/main` before any work. No stashes, no extra worktrees, no extra
branches existed; the only untracked files are pre-existing tool configuration
(preserved untouched).

## Device inventory at resumption start

`adb devices` reported **no connected devices** and no `qemu-system-*` process
existed: the non-target `emulator-5556` was **not running** and was never
contacted, started, stopped, installed to, or configured at any point in this
session. All ADB commands used in this session were serial-scoped
(`adb -s emulator-5554 …`) except two global operations that were justified
below (`adb devices`, and one `adb kill-server`/`start-server` restart).

## Dedicated runtimes and what happened

| # | AVD | Image | Launch | Result |
| --- | --- | --- | --- | --- |
| 1 | `braintraining-ui35` | android-35 google_apis | headless, swiftshader, cold | guest registered, then `emulator.exe` exited `0xC0000005` (access violation) after ~2 min |
| 2 | `braintraining-ui35` | android-35 google_apis | headless, verbose | exited `0xC0000005` before guest boot |
| 3 | `braintraining-ui35` | android-35 google_apis | repository flags (`-feature -Wifi`, …) | exited `0xC0000005` after ~15 s |
| 4 | `braintraining-c055r` (new) | android-35 google_apis | repository flags, cold | guest wedged: `sys.boot_completed` never answered for 10+ min; qemu stopped executing; process killed |
| 5 | `braintraining-c055r-atd` (new) | android-35 **aosp_atd** | repository flags, cold | **booted** (emulator log: "Boot completed in 38760 ms"), but `adb shell` hung — stale adb transport |
| 6 | `braintraining-c055r-atd` | android-35 aosp_atd | `-accel off` (TCG) | x86_64 guest never executed ("x86_64 emulation may not work without hardware acceleration"); process killed |
| 7 | `braintraining-c055r-atd` | android-35 aosp_atd | repository flags, cold, **after adb server restart** | **healthy**: `sys.boot_completed=1`, shell, screencap, uiautomator, logcat, install/uninstall, repeated interaction |
| 8 | `braintraining-c055r-a36` (new) | android-36 default | repository flags, cold | exited before guest boot (same full-image crash class) |

The `braintraining-c055r`, `braintraining-c055r-atd` and
`braintraining-c055r-a36` AVDs were created for this resumption only. They are
all API 35/36 x86_64, 1080×2400 @ 420 dpi (pixel_7 profile), 2048 MB RAM.
No existing AVD other than the dedicated `braintraining-ui35` was started or
modified.

## The adb-transport failure and its bounded fix

The adb server had been running since 05:40 through six crashed emulator
instances. With the fresh `braintraining-c055r-atd` boot, the device registered
but `adb shell`/`logcat` hung and the console port refused connections. After
confirming `adb devices` listed **only the dedicated ATD emulator** (no other
runtime attached), the adb server was restarted once:

```
adb kill-server && adb start-server
```

This is the repository's own documented recovery (`scripts/android/common.sh`
comment: "the guest transport may then need `adb kill-server && adb
start-server` to recover"). It restored the transport; the same emulator then
answered `getprop sys.boot_completed=1` and `echo alive`.

## Proved healthy on `braintraining-c055r-atd` / `emulator-5554`

| Check | Result |
| --- | --- |
| `sys.boot_completed` | `1` |
| `adb shell` | responsive (`echo alive`) |
| `wm size` / `wm density` | 1080×2400 / 420 |
| `screencap` | executes and returns a PNG (but see blocker below) |
| UIAutomator hierarchy dump | works (full React Native tree, e.g. `home-title`) |
| `logcat` | works |
| install / launch / uninstall | works (release APK installed, cold start 758 ms, `mCurrentFocus=MainActivity`) |
| Repeated interaction | stable across repeated shell/dump/capture cycles |
| No crash loop | emulator process stayed alive and responsive across all checks |

## Blocking limitation discovered: no composited frames on this host

Every GPU mode was tried on the healthy ATD runtime (headless and windowed,
cold boot and quickboot resume):

- `-gpu swiftshader_indirect` → screencap returns a uniform app-background
  frame; `dumpsys gfxinfo` reports **Total frames rendered: 0** for every
  process.
- `-gpu guest` → same.
- `-gpu host` → screencap returns a uniform black frame; 0–1 frames rendered.
- `-gpu angle_indirect` → same uniform frame.
- `-feature -Vulkan` + swiftshader → same.

The emulator's own log records a host compositing failure:

```
Critical: UpdateLayeredWindowIndirect failed for ptDst=(144, 131), size=(300x21), dirty=(300x21 0, 0)
(A device attached to the system is not functioning.)
```

`braintraining-ui35` (the canonical google_apis AVD that produced the first
session's captures) now crashes with `0xC0000005` on every launch, and
android-36 images crash the same way, while the lightweight `aosp_atd` image
boots but cannot composite content frames. Both GPUs report `Status: OK` in
Windows, there are no TDR/display driver events in the System log, and the
Windows session is the active console session (not RDP). The failure is in the
host's emulator display/compositing path, not in the app: the guest's view
hierarchy, database, input, and logs are fully functional.

**Consequence:** native pixel evidence (the six-way visual matrix, before/after
screenshots on the final artifact) is `NOT VALIDATED` for this host session.
All non-pixel native checks (routes, tutorial/gameplay semantics, workout,
SQLite, logs, accessibility bounds from UIAutomator XML) were executed on the
exact final artifact instead; see `FINAL_NATIVE_VALIDATION.md`.

## Non-target runtime statement

`emulator-5556` was not present at any point in this session and was never
touched. No non-Brain-Training AVD, emulator, or device was started, stopped,
wiped, restarted, installed to, sent input to, or reconfigured. The only
processes killed were the dedicated `braintraining-*` emulator processes
started by this session (verified by process start time and AVD identity).

## Final capture attempts on the exact final artifact

With the final APK installed on the healthy ATD runtime:

- `ui-capture` was run for `default/light` and produced `BLANK` for every
  surface it reached (`home`, `games`, `game-detail` before it was stopped),
  with full XML hierarchies captured alongside each blank PNG.
- A bounded XML-only re-capture produced the complete `default/light` set
  (11/11 surfaces, route markers verified). The `default/dark` attempt and a
  fresh-boot six-way loop then failed in the same host-level way: after a
  `wm size`/`wm density` profile switch the adb transport wedges (device
  registers, shell/dumps time out) and the emulator can exit; `adb kill-server`
  + `start-server` restores the transport only until the next profile change.
  This is the same host display/transport failure class as the pixel blocker
  above.
- Consequently the pixel six-way matrix is `NOT VALIDATED` and the compact/
  font-scale-2 re-captures could not be completed on this host. The
  accessibility classification does not depend on them: the density-correct
  re-audit of the first session's compact captures and the final artifact's
  default/light captures both resolve to the same four hit-slop-compliant
  Progress tabs (`ACCESSIBILITY_RESPONSIVE_QA.md`).
