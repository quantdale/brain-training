# Performance and Resource Sanity

Measurements below are current probes, not estimates. They are useful for regression comparison, not a device-independent performance promise.

## Repository performance probes

`[VERIFIED_TEST]` All opt-in probes passed.

| Probe / input | Measured result |
|---|---|
| Projection baseline, 5,000 rows | Full recent-list 20.9451 ms; lightweight 2.6608 ms; distinct dates 1.6794 ms; progress snapshot 42.5629 ms. |
| Projection baseline, 20,000 rows | Full recent-list 82.4292 ms; lightweight 26.3694 ms; distinct dates 4.9973 ms; progress snapshot 91.2378 ms. |
| Export 5,000 rows | Canonical checksum path 2,789.9867 ms; second canonical serialization 577.103 ms. |
| Sync scan, representative 20,000 | Build 2.0637 ms; evaluate 24.9811 ms; sync 32.9671 ms; achievement snapshot/sync 24.4992/23.6903 ms; dates 4.7135 ms. |
| Quest evaluation | First 24.5225 ms; partitioned 26.807 ms; after 24.065 ms; interleaved 22.567 ms; keys-only 7.5479 ms. |
| Legacy vs projection differential | 1,000: 5.1388 vs 2.931 ms; 5,000: 30.1982 vs 14.3589 ms; 20,000: 127.246 vs 67.3721 ms; equivalence held. |
| Large backup, 20,000 sessions | Seed 1,616 ms; export 3,280 ms; payload 15,228,503 UTF-16/byte-equivalent units; heap delta 109.4 MB; RSS delta 162.5 MB; post-GC evidence present; checksum/parse/chunk structure passed. |

## Native startup and rendering observations

`[OBSERVED_RUNTIME]` The locally assembled release APK reached Home after approximately 35 seconds in a direct cold launch with Metro stopped. The release UI-capture script emitted first-warm warnings at 90 seconds for two default light/dark resets, although all eight release captures eventually passed route/nonblank checks. This is an actionable startup/perceived-performance risk and should be measured again on the intended release artifact/device; no speculative optimization was made.

`[OBSERVED_RUNTIME]` Debug/native surface captures for Home, Games, Game Detail, Progress, Profile, Rewards, Data Management, Results, and Game Intro were nonblank and route-verified. The eight family interactions reached active states without a visible runaway render or fatal error.

## What was not measured

`[NOT VALIDATED]` No production telemetry, physical-device thermal profile, iOS performance, frame-time trace, long-duration memory-growth study across every game, or store-installed cold-start measurement was executed. No claim is made that the probe numbers represent all supported hardware.

