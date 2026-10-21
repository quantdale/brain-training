# Performance follow-up — Campaign 080 continuation

Date: 2026-10-21
Status: **NO APP-CONTROLLED BOTTLENECK ESTABLISHED — conclusion retained with
evidence; no forced optimization.** (Prompt §13: do not force unnecessary code
changes; do not assume GPU usage rules out JS bottlenecks.)

## What this continuation changed

- Nothing in application performance-critical code. The two presentation-only
  visual corrections (`tile.tsx` outline token, `trigger.tsx` elevation) have
  no per-frame workload change (static styles, precomputed at module load).
- The QA driver itself was the measured bottleneck class this campaign: two
  UIAutomator dumps per action (~3-4s each) against 9-10s game rounds caused
  timeout-driven round failures in automation. The harness now caches the
  parsed hierarchy per observation and dumps once per action — this is
  automation performance, explicitly NOT app performance, and is recorded so
  nobody mistakes faster sweeps for app speedup.

## Prior measurements (Campaign 080, unchanged, re-scoped)

- 309-frame UI scenario: 4.85% modern jank, p95 34 ms (SwiftShader software
  rendering — emulator overhead separated but not eliminated).
- Large-backup export: ~96 MB transient heap increase.
- Matched before/after optimization trials: **none qualified** (no change met
  the bar of reproduced app-controlled cost → safe fix → rebenchmark).

## Follow-up status (honest)

- **Timed gameplay / round transitions:** covered observationally by the fresh
  sweep (round advancement evidence per game); no dedicated frame-timing
  capture was re-run this continuation — emulator software rendering remains
  the dominant measured cost source, consistent with 080's C4 finding.
- **Repeated launches / long-session memory stabilization:** NOT re-measured
  this continuation. The prior PSS observations (image texture cache growth
  with 42 covers) stand as the recorded tradeoff.
- **App-controlled JS/UI profiling:** requires a profiling build + metro/Perf
  monitor capture that the runtime QA contract treats as a separate lane; NOT
  EXECUTED this continuation. Conclusion therefore remains: no evidence of an
  app-controlled frame bottleneck; not a claim that none can exist.

## Exact next actions (if a perf campaign is reopened)

1. Profile round transitions on a debug build with JS FPS monitor +Perfetto.
2. Measure memory across 3 consecutive full workout sessions (stabilization).
3. Re-test export heap after any data-layer change (the 96 MB observation).
