# Campaign 039 performance and reliability baseline

Artifacts are retained outside Git under `D:\Temp`.

## Runtime and startup

Target: dedicated disposable AVD `braintraining-ui35`, serial
`emulator-5554`, Android 15/API 35, 1080×2400 at density 420, font scale
1.0. No physical device or second emulator was used.

The three-run Metro/dev cold-start sample was 8,188 / 8,621 / 8,295 ms
(`D:\Temp\campaign039-startup-baseline`). The corresponding dev bootstrap
marks were 72.60–216.42 ms for progression, and the first progress snapshot
was 807.16–1,011.13 ms; warmed progress loads were 7–26 ms.

The pre-maintenance release sample was 1,129 / 1,918 / 2,555 ms total time
(`D:\Temp\campaign039-release-startup`). After the isolated patch refresh,
the first post-install sample was 3,211 / 2,946 / 3,658 ms and a five-run
repeat after the capture matrix was 5,492 / 8,230 / 4,515 / 3,442 / 3,684 ms
(`D:\Temp\campaign039-after-patch-startup` and
`D:\Temp\campaign039-after-patch-startup-repeat`). After an AVD reboot, a
fresh three-run sample was 5,669 / 5,996 / 5,537 ms
(`D:\Temp\campaign039-after-patch-startup-reboot`).

These release samples were taken at different emulator/system-load points and
the `am start -W` result includes Android window/process timing, so they are
not a controlled before/after performance benchmark. The post-refresh
variance was investigated by rebooting the repository-owned AVD; no app crash,
ANR, React Native fatal, SQLite lock, or error boundary appeared. Because no
controlled profiler attribution established a product regression, no
speculative startup optimization was introduced.

## Same-host data probes

The opt-in Jest probe passed at
`D:\Temp\campaign039-perf-baseline-20260918.json`. Representative results:

| Probe | 5,000 rows | 20,000 rows |
| --- | ---: | ---: |
| Full recent rows | 14.15 ms | 56.48 ms |
| Lightweight recent projection | 2.10 ms | 8.31 ms |
| Distinct activity dates | 1.23 ms | 4.44 ms |
| Progress snapshot | 35.22 ms | 74.85 ms |
| Export with canonical checksum | 4,116.83 ms at 5,000 | — |
| Second canonical backup serialization | 736.81 ms at 5,000 | — |

The sync probe passed at `D:\Temp\campaign039-perf-sync-20260918.json`.
At 20,000 rows, quest sample construction/evaluation/sync measured 1.81 /
21.03 / 42.07 ms, with snapshot/achievement/date work at 26.15 / 30.13 /
7.05 ms. These are same-host Jest measurements, not device FPS or user-facing
latency claims.

## Route and memory observations

The release route-arrival probe (`D:\Temp\campaign039-release-route-memory`)
verified Home, Games, Progress, Game Detail, and Game Intro with 2,185–2,363
ms harness-inclusive arrival times. PSS rose from 178,785 KB on Home to
196,353 KB on Game Intro. Three repeat cycles plateaued around 204–207 MB
without an unbounded rise (`repeat-summary.json`). The arrival timings include
UIAutomator dump/settle work and must not be read as first-frame timings.

Games scroll/search was exercised on release: one emulator-local swipe brought
the search control into view, typing `memory` produced memory-game results and
the semantic count `Showing 7 of 42 games`. No source list optimization was
justified by this observation.

## Reliability/log evidence

The refreshed release was force-stopped and cold-launched repeatedly. The
app-filtered logcat contained only normal `Running "main"` entries and no
`FATAL EXCEPTION`, ANR, `database is locked`, SQLite, or React Native error
signal. A release `run-as` database query was intentionally not attempted
because Android correctly reports that the release package is not debuggable;
Campaign 038 contains the debug-build persistence query and the sensory
off/on cold-relaunch proof.
