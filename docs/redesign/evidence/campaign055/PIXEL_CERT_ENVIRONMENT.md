# Campaign 055P — Pixel Certification Environment

Session: 2026-09-20 (afternoon), continuation of `055-signal-arcade-desirability`.
Starting repository SHA: `0de77dca4d19b58b0cb275290a41b23053324ee3` (after fast-forward
of the pixel-certification prompt commit from `origin/main`).
Product-source checkpoint: `ddfe539d1a25b5bf47b2b3975ee37783e0f81f60` — proven
unchanged in this session (`git diff --stat ddfe539..HEAD -- apps src plugins packages`
is empty; only `.agent/`, `docs/` and `openspec/` files changed since the checkpoint).

## Certified artifact

| Field | Value |
| --- | --- |
| APK | `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` |
| SHA-256 | `A83729AEFC9C00D398A215880CFB5B6837A3F08CA248EEC770BAAF2D33C48AA5` |
| Size | 109,596,169 bytes |
| Package / version | `com.braintraining.app` / `versionName=0.1.0` |
| Signing | debug-signed release build, Metro-independent |
| Installed on | `emulator-5554` (AVD `braintraining-ui35`), installed 2026-09-20 06:45:50 device time |

The on-disk APK hash was verified in this session before installation; it equals
the authoritative Campaign 055 artifact exactly, so no rebuild or substitution
was necessary.

## Runtime ownership

`adb devices` reported **no connected devices** at session start; no
`emulator.exe`/`qemu-system-*` process existed. Every ADB command in this session
was serial-scoped (`adb -s emulator-5554 …`). `emulator-5556` (Study Maker) and
every other AVD/device were never started, stopped, wiped, installed to, sent
input to, or reconfigured. Only the dedicated Brain Training AVD
`braintraining-ui35` was booted. No `adb kill-server` was needed.

## Host state at recovery

| Check | Result |
| --- | --- |
| Windows | 10.0.26200, active **console** session (not RDP) |
| Video controllers | Intel UHD Graphics — Status OK; NVIDIA RTX 4050 Laptop GPU — Status OK |
| WHPX | `emulator -accel-check` → `WHPX(10.0.26200) is installed and usable` |
| Emulator | 37.1.11.0 (build_id 15917651), graphics backend `gfxstream` |

## Working configuration (the recovery)

| Field | Value |
| --- | --- |
| AVD | `braintraining-ui35` (pre-existing dedicated Brain Training AVD) |
| System image | `system-images;android-35;google_apis;x86_64` |
| Serial | `emulator-5554` |
| API level | 35 |
| Resolution / density | 1080×2400 @ 420 dpi (`pixel_7`, 2048 MB RAM) |
| Launch | `-avd braintraining-ui35 -port 5554 -no-window -no-audio -no-boot-anim -gpu host -no-metrics -feature -Wifi -no-snapshot` |
| Guest GLES | `NVIDIA GeForce RTX 4050 Laptop GPU/PCIe/SSE2, OpenGL ES 3.1 (4.5.0 NVIDIA 610.62)` via the Android Emulator GLES translator |
| SurfaceFlinger display | `EMU_display_0`, 1080×2400, 60 Hz, HWC display 0 |
| Boot time | `sys.boot_completed=1` ~25 s after launch |

### Why the earlier sessions failed, and what actually fixes it

1. **Legacy GPU flag.** The repository launch flags carried
   `-gpu swiftshader_indirect`. Emulator 37.1.11 no longer accepts that legacy
   name — its supported modes are `auto|host|software|lavapipe|swiftshader|swangle`.
   Launched with the legacy value, `braintraining-ui35` exited with
   `0xC0000005` (access violation) in the previous resumption. The invalid flag
   also explains the 9/20 resumption's "every GPU mode" matrix: two of the tried
   values (`swiftshader_indirect`, `angle_indirect`) are not valid modes in this
   emulator and the others were tried on the `aosp_atd` image.
2. **ATD image cannot compose app frames.** The resumption's fallback AVD
   `braintraining-c055r-atd` (`aosp_atd`) boots and answers ADB, but on this host
   it never produces HWUI frames: the app's full view hierarchy mounts
   (`home-title`, correct bounds) while `dumpsys gfxinfo` stays at
   `Total frames rendered: 0` and `screencap` returns a uniform black PNG.
   Reproduced again this session before switching images.
3. **Working path.** `braintraining-ui35` (google_apis) with the *valid*
   `-gpu host` mode boots cleanly and composites real frames. This is the same
   AVD and mode that produced the first session's real dark/light captures.

## Evidence that frames are genuinely composited

| Requirement | Evidence |
| --- | --- |
| Boot completed | `getprop sys.boot_completed` → `1` |
| SurfaceFlinger responsive | `dumpsys SurfaceFlinger` lists HWC display 0, active layers, composition list |
| Current activity visible | `mCurrentFocus=Window{… com.braintraining.app/com.braintraining.app.MainActivity}` |
| Real frame activity | `dumpsys gfxinfo com.braintraining.app` → `Total frames rendered: 152` (system launcher: 136) |
| Screencap nonuniform | Home light capture: 2,523 unique RGB colors, top colors `#FFFDF7` (770,859 px), `#F4F1E8` (756,956 px), `#EDE2FA` (512,444 px) — the Signal Arcade light palette |
| Dimensions correct | PNG 1080×2400, matches `wm size`; compact profile capture 720×1600 matches the applied size |
| Nonzero variance | Home light luminance mean 226.7 / σ 45.5; dark mean 47.1 / σ 45.6 (pure-black frame would be σ = 0) |
| Repeated captures stable | Two captures 3 s apart are **byte-identical** (no tearing, no stale composite drift) |
| Light/dark changes pixels | `cmd uimode night yes` → mean luminance 226.7 → 47.1; palette changes to `#0E1922` / `#152733` / authored dark surfaces |
| Profile changes layout | `wm size 720x1600` + `density 320` → 720×1600 capture with distinctly different layout pixels |
| Font scale changes layout | `font_scale 2.0` → hierarchy text heights grow (e.g. `home-workout-plan` 53 px → 180 px, `home-local-trust` 42 px → 148 px) and the capture's pixel distribution changes |
| Hierarchy matches screenshot | The Home hierarchy dumps `home-brand`, `home-title` ("Home"), `home-workout-cta`, `home-workout-continue` ("Start workout") with bounds that place each element inside the visible 1080×2400 frame; the captured pixels show the same structure (`home-a.png` visual review) |

Raw proof artifacts (gitignored): `qa-artifacts/campaign055-pixel/env-proof/`
(`home-a.png`, `home-b.png`, `home-dark.png`, `home-compact.png`,
`home-fs2.png`, `home-default.xml`, `home-fs2.xml`) plus the emulator launch
logs under `qa-artifacts/campaign055-pixel/`.

## Method

All captures use the repository's canonical harness (`scripts/qa/ui-capture.mjs`)
or raw `adb exec-out screencap -p` on the same serial; pixel metrics are computed
with deterministic Python/PIL scripts over the exact PNG bytes. No host mouse,
keyboard, focus stealing, or desktop coordinates were used — input is
emulator-local ADB only.

## Pixel pipeline verdict

`PASS` — the exact final Campaign 055 artifact renders composited, nonblank,
route-correct frames on `braintraining-ui35` / `emulator-5554`, and the
display path responds correctly to theme and profile changes. The six-way
matrix may proceed on this runtime.
