# Thumbnail asset and performance comparison

The accepted APK adds 422,249 bytes (0.807%) over the installed Campaign077 baseline. Its JavaScript bundle is 8,416 bytes smaller. A matched emulator scrolling sample did not show a frame-time regression, but the library remains visibly janky on this emulator. Memory use increased as expected when decoding the new covers.

## Asset and bundle budget

| Measure | Before | After |
|---|---:|---:|
| Game-specific bundled PNG covers | 0 | 42 |
| Game-specific PNG bytes | 0 | 569,529 |
| Existing domain/workout PNGs | 9 / 1,084,784 B | retained |
| APK bytes | 52,311,479 | 52,733,728 |
| JavaScript bundle bytes | 5,346,928 | 5,338,512 |
| Hypothetical all-cover RGBA allocation | not applicable to old View art | 27,525,120 B / 26.25 MiB |

Every cover is 512 × 320, transparent, statically packaged and fitted with `contain`. The RGBA figure is width × height × 4 × 42, not a PSS measurement. PNG geometry avoids the old miniature View hierarchies; exact text remains native SVG. There are no animated backgrounds, runtime blur effects, remote requests or new runtime rendering dependencies. The authoring compiler is a pinned development dependency.

## Matched native sample

Device: visible `braintraining-ui35`, `emulator-5570`, 1080 × 2400, density420, font1.0, light mode, Wi-Fi and mobile data off. Root owned the only tested device; the other running emulator was untouched. Both comparison samples were taken after expensive local build/test work had finished. Each reset the app's gfxinfo statistics and used the same 16 bounded library swipes: eight upward and eight downward, 350 ms gestures, 250 ms requested settle and a screenshot after each gesture. OS/process scheduling and screenshot overhead remain uncontrolled.

The quiet baseline is the `before2` sample. The earlier host-confounded `before` sample is retained locally and excluded from this table. ARTEMIS Pro task `fdae2057…` ended after three actions with a pending measurement ledger and is not measurement evidence. The bounded ADB gestures are a one-off library diagnostic, not a new repository gameplay controller.

| Metric | Baseline `before2` | Accepted APK `after` |
|---|---:|---:|
| Reported frames | 650 | 669 |
| Reported janky frames | 266 / 40.92% | 255 / 38.12% |
| p50 / p90 / p95 | 40 / 77 / 113 ms | 38 / 69 / 101 ms |
| Legacy jank counter | 603 / 92.77% | 631 / 94.32% |
| gfxinfo image texture cache | 110.02 KB | 40.41 MB |
| Slow bitmap uploads | 6 | 1 |
| Attached Views at sampled endpoint | 1,095 | 931 |
| PSS at start | 192,259 KiB | 203,788 KiB |
| PSS after scrolling | 182,247 KiB | 208,391 KiB |
| PSS after settling | not sampled | 206,273 KiB |

End-of-scroll PSS increased by 26,144 KiB (25.53 MiB / 14.35%), close to the hypothetical 26.25 MiB decoded cover budget. The image texture cache also increases substantially, and the legacy jank counter worsens; this is a real memory tradeoff rather than an unqualified performance improvement. The measured start/end/settled points showed no additional unexplained large spike; they do not establish continuous peak usage or absence of leaks. First cold Games launch was 2,635 ms before and 1,591 ms after; those are individual observations, not statistically controlled startup benchmarks.

Raw `gfxinfo`, `meminfo`, gesture ledgers and actual screenshots remain under local `apps/mobile/qa-artifacts/campaign078/`. [PERFORMANCE.json](PERFORMANCE.json) records the parsed counters. Local builds use x86_64; physical Android/ARM64 and iOS runtime performance are not validated. No 60 FPS, physical latency or causal improvement guarantee is made.
