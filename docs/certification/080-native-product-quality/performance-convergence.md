# Controlled performance follow-up — 2026-10-23

**Measured, bounded emulator evidence; not physical-device performance approval.**
Application source `22ae2f7cfa3769fdf2ae9d426fe5e7c15610eb09`, installed release
APK SHA-256 `34bbf3deb38c6d704518603a579be1a6ae4da31fa5894bf8227105f406eaed81`,
x86_64, 1080×1920/420dpi/font1, SwiftShader emulator, Skia/OpenGL pipeline.
System transition-animation scale0 (the original QA-device setting).
No host mouse/keyboard input; no speculative optimization applied.

## Protocol and actual measurements

Raw evidence: `qa-artifacts/080/final-convergence/performance-02/`.

- Three cold native-activity launches:1071/983/963ms from `am start -W`.
  These are native launch timings, NOT time to complete JS/data/usable Home.
- Three process-alive foreground-resume requests returned UNKNOWN launch state
  and no valid TotalTime metric: **warm startup latency NOT MEASURED**, not0ms.
- Two warm-up cycles, then ten measured cycles across Home/Games/Memory detail/
  tutorial/latest saved Results/Profile/Backups & data. Each route settled5s;
  final quiescent interval60s. Same process PID29580 throughout;84 route
  requests succeeded. Full protocol elapsed8m38.8s. No session-start or data
  mutation was performed by this navigation workload.
- PSS measured baseline256267KiB; measured peak278360KiB; final cycling277292KiB;
  final idle266340KiB. Retained delta10073KiB (~9.84MiB); peak delta22093KiB
  (~21.57MiB). Later cycling samples ranged about271513–278360KiB rather than
  growing monotonically. This bounded cache/allocator-retention observation is
  NOT a JS heap/leak-free/long-duration soak guarantee.
- Navigation frame counters after warm-up reset:2571 frames,689 modern jank
  (26.80%),1749 legacy jank (68.03%); p50/p90/p95/p99=28/53/65/101ms.
- Separate timed Odd One Out gameplay/results/exit canary after counter reset:
 368 frames,185 modern jank (50.27%),167 legacy jank (45.38%);
 p50/p90/p95/p99=18/36/48/69ms. Native observations include real playing and
 results states and the matching session token; intermittent failed/unknown
 hierarchy acquisitions remain in the raw ledger. Its coverage classification
 is NOT asserted as current certification: this run predates the integrated
 contract, even though its seven engine repairs now have independent acceptance.
- App exit-info after navigation recorded the deliberately requested startup
  force-stops, not a new crash/ANR of the retained measured process. This does
  not erase the earlier System UI ANR or certify every workload crash-free.

GPU histogram overflow values reported as4950ms are not treated as trustworthy
individual GPU latency measurements. Software rendering is an important
confounder, not proof that all jank is outside app control. These new workload
figures supersede any implication in the earlier performance report that a
small source probe or GPU share exonerates the whole application.

## App-controlled source probes

All five supported `npm run perf:probe` workloads passed; raw log
`performance-source-probes-02.log` (Windows Node22.23.2):

| Workload | Measurement |
|---|---:|
|20k lightweight history projection|19.82ms|
|20k full-row history read|221.34ms|
|20k progress snapshot|183.91ms|
|5k export including canonical checksum|1851.42ms|
|20k quest-sync scan|82.46ms|
|20k keys-only quest evaluation|21.71ms|
|20k backup text|15,228,503 UTF-16 units /966 chunks|
|20k backup export memory|heap+96MB/RSS+97MB; no post-GC measurement|

These are extreme synthetic datasets and machine-specific measurements, not
native latency gates or a causal before/after optimization. The existing
projection path remains materially cheaper than full rows. No new actionable
allocation loop, unreleased session resource, or app-controlled hotspot was
isolated by these bounded measurements, so a speculative rewrite is unjustified.
Jank remains materially poor on this emulator;60fps/physical latency and a
long-duration leak qualification remain **NOT VALIDATED**. Rapid-input stress,
full workout-transition profiling and native import-memory profiling are not
established by this navigation/canary protocol. Physical GPU/ARM64 qualification
and deeper profiling remain necessary before unconditional performance approval.
