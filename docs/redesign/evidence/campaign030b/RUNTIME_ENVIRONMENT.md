# Campaign 030B runtime environment

Date: 2026-09-17

Status: graphics blocker closed on a disposable normal-phone AVD

## Repository and product identity

The pre-sync checkout was a clean `main` at `a5224ee2a58bc8028006f29b45416fff342a0326`.
The first fast-forward brought it to `4fa2e3dde7d371485d27262b8cd984f0a369f125`.
The remote advanced during runtime work; a second fetch and fast-forward brought
`main` to `7f08bf0d92ad15cdee8b4f82900cf919f5932e9a` before the Campaign 030B
documentation edits. No local user modifications existed to preserve, and no
reset, clean, stash, or overwrite operation was used.

Campaign 029's product baseline is `5c484a08083963439360cb06c229249029f90531`.
The current checkout differs from that baseline in tests, documentation, and a
QA workflow naming/contract change, but not in the product UI/runtime source,
Expo configuration, dependencies, persistence, game logic, or workout logic.
The runtime therefore uses the same effective product baseline while the exact
checkout SHA is recorded above.

## Disposable AVD

| Field | Observed value |
| --- | --- |
| AVD | `braintraining-c030b` |
| Profile | Pixel 7, normal phone profile |
| Image | `system-images;android-35;google_apis;x86_64` |
| API / ABI | Android 35 / x86_64 |
| Serial | `emulator-5562` |
| Display | 1080 x 2400, density 420 |
| RAM | 1536 MB |
| Emulator | 37.1.11.0 (build 15917651) |
| ADB | 1.0.41, Android Debug Bridge 37.0.0-14910828 |
| Host acceleration | WHPX; Windows 10.0.26200; NVIDIA RTX 4050 host GPU |
| Launch graphics mode | `-gpu host` |
| Other launch flags | `-port 5562 -no-window -no-snapshot -no-audio -no-boot-anim -no-metrics -feature -Wifi` |
| Boot/readiness | `sys.boot_completed=1`, ADB `device`, package manager ready |

The prior Campaign 030 AOSP ATD image was not reused. Its bounded
`swiftshader_indirect`, `software`, and `swiftshader` trials had populated
trees but uniform-black frames and zero rendered frames. The normal Google APIs
phone image rendered successfully with the supported host GPU path, so no
unbounded equivalent-mode cycling was necessary.

### Ownership and safety

All app installation, launch, input, screenshots, hierarchy dumps, and process
checks used the explicit serial `emulator-5562`. Before destructive operations,
`adb -s emulator-5562 emu avd name` was checked to identify
`braintraining-c030b`. The protected `emulator-5554`, `braintraining-ui35`, and
any physical device were not targeted.

During initial diagnostics, the new AVD was accidentally started once without an
explicit port and consequently appeared on the default serial. Exact process
command lines identified both the launcher and qemu process as
`braintraining-c030b`; those exact disposable processes were stopped. After
that correction every operation used port 5562. No user-owned emulator or
physical device was stopped, installed to, relaunched, wiped, or sent input.

The only application data reset was `pm clear com.braintraining.app` on this
disposable AVD, as authorized by Campaign 030B. The AVD was shut down after
evidence capture; it was not deleted. The existing Metro server on
`127.0.0.1:8081` was reused and was not stopped.

## APK and graphics proof

The exact assembled debug APK was built from the current checkout with:

    apps/mobile/android/gradlew.bat :app:assembleDebug --no-daemon

The first invocation reached `:app:packageDebug` but failed once in Android's
packaging splitter. A bounded `--stacktrace` rerun completed successfully;
there was no reproducible source/compiler failure. The successful universal
debug artifact was installed with `adb -s emulator-5562 install -r -d -g`.

| Field | Value |
| --- | --- |
| APK | `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` |
| SHA-256 | `80e9b29134fb70d7c45e30b7bb0fb6f6e90ee8d358b1880b9fa236e98a877d6a` |
| Size | 233,448,710 bytes |
| Package/version | `com.braintraining.app`, 0.1.0, versionCode 1000 |
| Install result | `Success` |
| EGL property | `ro.hardware.egl=emulation` |
| GfxInfo | 161 total frames; `Pipeline=Skia (OpenGL)` |

The first hard-gate proof, captured before the broad matrix, was:

    D:\Temp\campaign030b-render-proof\screen-20260917-164456.png

It is a 1080 x 2400 PNG, 193,670 bytes, SHA-256
`f3597894ce55e1ed921362cfd3e44dbfaeba246b626140a4c3f9fb72e32a1bf4`, with
1,757 full-image unique colors, channel range 26–255, mean luminance
237.172853, and luminance standard deviation 47.173679. Visual inspection
showed the current Home / Today surface, including the Brain Training heading,
Today workout card, progress, Start/Continue CTA, game legs, and bottom tabs.

After the successful universal APK install and one disposable-AVD reboot, a
second current Home proof was captured at
`D:\Temp\campaign030b-postreboot\home.png`. It is 1080 x 2400, 139,381 bytes,
SHA-256 `c22c067a9b8b699201e0ce6cbf321fb23b2d6da37feaba40ee2e1591874df28b`;
the matching hierarchy contained `home-title`, Today text, and
`home-workout-continue`. The initial post-reboot root-only dump lasted one
poll; the next poll contained 20 text nodes and 13,087 XML characters.

The exact current APK was then used for the verified 22-surface matrix in
`VISUAL_BASELINE_INDEX.md`. Every PNG is non-uniform and every surface has a
route-verified hierarchy. This separates the transient startup/tooling warm-up
from the stable rendered state.

## Runtime observations and limitations

- A cold debug launch can expose a 419-byte root-only hierarchy for several
  seconds while Metro/SQLite bootstrap completes. Later polls consistently
  reached the populated Home tree; this was recorded as startup warm-up, not a
  product crash.
- The current app reports `ro.hardware.egl=emulation` and renders real Skia /
  OpenGL frames on the normal phone AVD. The old ATD black-frame diagnosis is
  therefore an image/runtime limitation, not evidence of a product rendering
  failure.
- `uiautomator` briefly returned a null root after the storage-error fixture;
  one bounded AVD reboot restored it. The exact APK matrix was captured after
  that reboot with XML present for all 22 surfaces.
- No landscape, compact/expanded display profile, or font-scale-2 matrix was
  run. Those are outside this default phone baseline and remain follow-up
  validation.
