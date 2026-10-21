# Performance report — Campaign 079

**Date:** 2026-10-21 · **Environment:** Windows 11 host, Node 22.23.2, AVD
`braintraining-qa36` (x86_64, 1080x1920, swiftshader_indirect GPU, headless),
QA APK sha256 `231559b935b4…`. Host load: light (CI is cloud-side). All
numbers below are **emulator observations, single-run unless noted** — no
60 fps claim, no physical-device claim, no causal improvement claim.

## 1. Measurements (E1)

### App-level (this session)

| Metric | Value | Method | Samples |
|---|---|---|---|
| Cold start (totalTime) | 2887 ms | `adb shell am start -W` after `force-stop` | 1 |
| Relaunch after force-stop | 2486 ms | same | 1 |
| Process PSS after journey | 237,661 KB (RSS 378,732 KB) | `dumpsys meminfo com.braintraining.app` | 1 |
| Frames rendered (session) | 318 | `dumpsys gfxinfo` | cumulative over the journey |
| Janky frames | 151 (47.48%); legacy 109 (34.28%) | same | — |
| Frame-time percentiles | p50 17 ms / p90 61 ms / p95 101 ms | same | — |

Consistent with the recorded 078-era baseline (jank 38–41%, p95 ~101 ms,
PSS ~182–208 MB depending on artwork state): emulator smoothness remains
**poor** and is a known limitation, not a regression from this program (no
runtime source changed in 079).

### Host-side bounded probes (`npm run perf:probe`, 5/5 written to
`scripts/perf/baselines/perf-*-2026-10-21T05-47-53-791Z.json`)

| Probe | Headline numbers |
|---|---|
| perf-baseline | see baseline JSON (db+scoring batch timings) |
| perf-sync-scan | see baseline JSON (progression sync scan) |
| perf-quest-ab | see baseline JSON (quest evaluation A/B) |
| perf-projection-w10 | see baseline JSON (analytics projections differential) |
| large-backup-memory | 20,000 sessions: export 1822 ms, text 15.2 M UTF-16 units (~14.5 MiB), 966 chunks, heap delta +84.7 MB, RSS delta +99.8 MB (no forced GC) |

These probes are **measurements, not CI gates** (GOVERNANCE
`enforcedGateSet.notACiGate.local-perf-probes`). Absolute values vary by
machine; only same-machine comparisons are meaningful.

## 2. Baseline comparison (E3)

The nearest like-for-like baseline is 078's matched 16-swipe comparison
(jank 40.92→38.12%, p95 113→101 ms, PSS 182,247→208,391 KiB after cover
artwork). This session's journey numbers (47.48% jank, p95 101 ms, PSS
237,661 KB) are **not workload-matched** to that baseline (different screens,
different interaction counts), so no before/after claim is made. The PSS
figure includes the previously documented ~26 MiB artwork texture cost.

## 3. Investigations and optimizations (E2/E3)

No runtime source change was made in this program, so no optimization claim
exists. Root-cause notes recorded for future work:

- Frame-time p50 is fine (17 ms); the tail (p90 61 ms) drives the jank rate —
  consistent with JS-thread bursts (board generation, feedback transitions)
  and swiftshader software rendering rather than image decode.
- Large-backup export memory (+84.7 MB heap at 20k sessions) is bounded and
  chunked (966 chunks) but not streaming; a streaming exporter is the
  identified improvement if backup scale ever becomes a product requirement.

## 4. Build-lane note

Multi-ABI local native builds reproduced
`ninja: error: manifest 'build.ninja' still dirty after 100 tries`
(3 occurrences, Windows host). Bounded workaround for QA: clear stale `.cxx`
configure caches and build the target ABI only
(`-PreactNativeArchitectures=x86_64`). Hosted Android Build Smoke passed at
both program revisions; see ci-recovery.md §5.

## 5. Limitations

Single samples; emulator + swiftshader; no frame-level instrumentation of
individual games; no memory-leak study (repeated navigation not profiled);
no physical-device numbers. **Performance verdict: CONDITIONAL GO** —
measured and documented, budgets not invented, known smoothness limitation
carried forward.
