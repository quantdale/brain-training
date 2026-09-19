# Campaign 054 — First-Install / Cold-Start Startup Closure

**Disposition:** `NOT_REPRODUCIBLE_WITH_BOUNDED_EVIDENCE` for the current exact
final release artifact.
**Date:** 2026-09-19
**Device:** `braintraining-ui35` / `emulator-5554`, Android 15 / API 35,
1080x2400, density 420 (headless; emulator-local ADB only; `emulator-5556` was
never touched).
**Artifact:** `app-release.apk`, SHA-256
`1B6EBC20498785F9498A769F8F57968D9FB18C63DBBB19528F3E4954B0FB985F`,
109,586,373 bytes, rebuilt from the current tree with a forced Metro
re-bundle (bit-identical to the Campaign 053 artifact; see
`FINAL_SHA_ARTIFACT_PROVENANCE.md`).

## Original observation (Campaign 050)

After release installation, a first ARTEMIS launch displayed an Android
`Brain Training isn't responding` dialog; one bounded close/relaunch recovered
Home. Campaign 051 separately recorded a "transient Android System UI dialog"
on its first capture (not an identified app ANR). Campaign 053's fresh-install
journey did not reproduce it (one sample).

## Campaign 054 matrix (warm device, 23 runs)

Install / data / launch sequence, each launch `am start -W` with a 30 s Home
marker wait, ANR-dialog probes before and after, and per-run filtered logcat:

| Run | Launch state | `TotalTime` (ms) | Home rendered | Dialogs | Fatal/ANR markers |
| --- | --- | ---: | --- | ---: | ---: |
| uninstall + fresh install, first launch | COLD | 2,343 | yes | 0 | 0 |
| force-stop relaunch 01 | COLD | 1,203 | yes | 0 | 0 |
| force-stop relaunch 02 | COLD | 1,028 | yes | 0 | 0 |
| force-stop relaunch 03 | COLD | 1,979 | yes | 0 | 0 |
| force-stop relaunch 04 | COLD | 1,146 | yes | 0 | 0 |
| force-stop relaunch 05 | COLD | 1,316 | yes | 0 | 0 |
| force-stop relaunch 06 | COLD | 1,170 | yes | 0 | 0 |
| force-stop relaunch 07 | COLD | 1,025 | yes | 0 | 0 |
| force-stop relaunch 08 | COLD | 1,177 | yes | 0 | 0 |
| force-stop relaunch 09 | COLD | 1,152 | yes | 0 | 0 |
| force-stop relaunch 10 | COLD | 1,268 | yes | 0 | 0 |
| second launch (warm) | warm | — | yes | 0 | 0 |
| clear-data cold launch 1 | COLD | 1,555 | yes | 0 | 0 |
| clear-data cold launch 2 | COLD | 1,551 | yes | 0 | 0 |
| clear-data cold launch 3 | COLD | 1,741 | yes | 0 | 0 |
| offline launch (airplane mode) | COLD | 1,605 | yes | 0 | 0 |
| reinstall-over, first launch | COLD | 1,815 | yes | 0 | 0 |

## Campaign 054 matrix (true emulator cold boot, 7 runs)

The dedicated AVD process was stopped (`adb emu kill`) and relaunched with its
exact headless command line (`-no-window -no-audio -no-boot-anim -gpu host
-no-metrics -no-snapshot -memory 2048`; `-no-snapshot` means a true cold boot).
Android reported `sys.boot_completed=1` after 27.7 s.

| Run | Launch state | `TotalTime` (ms) | Home rendered | Dialogs | Fatal/ANR markers |
| --- | --- | ---: | --- | ---: | ---: |
| cold-booted: uninstall + fresh install, first launch | COLD | 2,410 | yes | 0 | 0 |
| cold-booted relaunch 1 | COLD | 1,090 | yes | 0 | 0 |
| cold-booted relaunch 2 | COLD | 956 | yes | 0 | 0 |
| cold-booted relaunch 3 | COLD | 827 | yes | 0 | 0 |
| cold-booted relaunch 4 | COLD | 858 | yes | 0 | 0 |
| cold-booted clear-data first launch | COLD | 834 | yes | 0 | 0 |
| cold-booted clear-data second launch | warm | — | yes | 0 | 0 |

## Marker scan

- 30 assessed launches, 0 ANR dialogs (window/activity/process probes),
  0 `ANR in`, 0 `FATAL EXCEPTION`, 0 `SIGSEGV`, 0 `OutOfMemoryError`,
  0 `isn't responding` across all per-run logcat captures
  (`D:\Temp\campaign054\runtime\logcat-startup-*.txt`,
  `logcat-coldboot-*.txt`).
- No app process ANR traces were present in the per-run probes.

## Disposition

The Campaign 050 first-install ANR is **NOT_REPRODUCED** under the Campaign 054
bounded matrix (30 assessed launches covering fresh install, clear-data,
normal cold launches, warm launch, force-stop/relaunch, offline launch,
reinstall-over, and a true emulator cold boot). Following the campaign's
classification rule this is recorded as
`NOT_REPRODUCIBLE_WITH_BOUNDED_EVIDENCE` — not "impossible" and not a clean
first-launch guarantee for every device.

Boundary notes:
- The original observation was a single first post-install launch on a runtime
  that Campaign 051 later recorded as degraded (its AVD required a clean-boot
  recovery); the current matrix runs on a freshly booted, dedicated headless
  AVD.
- Physical/OEM Android startup behavior remains a
  `MANUAL_PLATFORM_PENDING` boundary.
- Raw artifacts: `D:\Temp\campaign054\runtime\startup-matrix-results.json`,
  `coldboot-matrix-results.json`, and the per-run logcat files.
