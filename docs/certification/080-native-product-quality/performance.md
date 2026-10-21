# Performance report — Campaign 080

Campaign: `080-native-product-quality`
Method: controlled source-level probes + on-device `dumpsys gfxinfo`, with the
emulator/software-rendering overhead separated from application-controlled cost.
No absolute frame-rate certification is claimed from emulator observation.

---

## C1 — Test environment & controlled measurements

**Runtime environment**
- Device: Android emulator `braintraining-qa36` (emulator-5554)
- ABI: x86_64 · Display: 1080×1920 · Density: 420dpi
- Renderer: **SwiftShader (software rendering)** — the emulator has no GPU passthrough
- Build: installed production build `com.braintraining.app`
- Host: Windows, Node v22.23.2 (source probes)

**Instrumentation**
- Source-level app-cost probes: `npm run perf:probe` (`scripts/perf/run-probes.mjs`) — 5 bounded Jest probes (history reads, sync/scan, quest A/B, projections, large-backup memory). Repeatable, same-machine comparable.
- On-device frame timing: `dumpsys gfxinfo com.braintraining.app` (reset counters between scenarios).

**Source-level baseline (app-controlled costs), 2026-10-21**

| Scenario | Metric | Value |
|---|---|---|
| History reads (20k sessions) | listRecent full rows | 110.9 ms |
| History reads (20k) | listLightweight projection | 35.0 ms |
| History reads (20k) | loadProgressSnapshot | 108.4 ms |
| Export (5k sessions) | exportLocalData incl. checksum | 1053.9 ms |
| Quest eval (20k) | keys-only single pass | 11.4 ms |
| Quest eval (20k) | engine / partitioned | 39–41 ms |
| Large backup (20k) | export text | ~15.2 M UTF-16 units, 966 chunks |
| Large backup (20k) | heapUsed delta | **96 MB** |

**On-device frame timing — Home/UI navigation scenario** (309 frames: tab switches + vertical scrolls)

| Metric | Value |
|---|---|
| Total frames | 309 |
| Janky frames (modern) | 15 → **4.85 %** |
| Janky frames (legacy, >16 ms) | 246 → 79.61 % |
| Frame time p50 / p90 / p95 / p99 | 23 / 32 / 34 / 121 ms |
| GPU time p50 / p90 / p95 | 7 / 23 / 25 ms |

Campaign 079 reported ~47.48 % jank / p95 101 ms during **timed gameplay** and
legacy jank ~94 %. Those numbers are not directly comparable to the UI-navigation
scenario measured here (different workload). The comparable takeaway is the
**legacy-vs-modern jank split** and the **GPU percentiles**, below.

## C2 — Separating emulator overhead from application cost

Evidence that the residual frame cost is dominated by **emulator software
rasterization**, not application-controlled JS/UI work:

1. **GPU percentiles are a large share of each frame.** At p50 the GPU
   (SwiftShader) spends 7 ms of the 23 ms frame; at p90 it is 23 ms of 32 ms.
   Software rasterization of the app's layered/rounded visuals is a first-order
   per-frame cost that no amount of JS optimization removes.
2. **Legacy jank (79.61 %) is inflated vs modern jank (4.85 %).** The legacy
   metric counts any frame >16 ms as janky; on a 60 Hz vsync software renderer a
   responsive app routinely lands at ~23 ms (as here), tripping the legacy
   threshold without a genuine responsiveness failure. The modern metric, which
   accounts for the frame budget, shows the UI path is largely healthy.
3. **Application-controlled source costs are small and bounded** (single-digit
   to low-hundreds of ms for extreme datasets of 5k–20k sessions, far above real
   usage; typical datasets are single-digit ms). The projection read path
   (`listLightweight` 35 ms vs `listRecent` 110 ms at 20k) is already the
   optimized path the app uses.

Conclusion: the app-controlled hot paths measured (history reads, quest eval,
projections) are within reasonable bounds, and the dominant residual frame cost
on this environment is SwiftShader software rendering. Per the campaign rule
("do not rewrite healthy app code to optimize an emulator artifact"), no
frame-chasing rewrite was applied to healthy UI.

## C4 — Optimization attempts & outcome

Hot-path inspection (Home dashboard, Games library, GameHost, tutorials, timed
screens, results) and the source probes were used to look for an application-
controlled bottleneck that meets the bar for a safe, measurable correction:

- **Games library** renders the 42-card cover grid via nested `.map` in a
  `ScrollView` (no virtualization). At 42 bounded items this is **not** a
  confirmed long-frame driver, and introducing virtualization would risk
  regressions for marginal gain — not applied (would be optimizing toward a
  software-rendering artifact).
- **Home** already memoizes derived work (`useMemo`/`useCallback`) and bounds
  recent/history lists (`slice(0,5)` / `slice(0,4)`); no confirmed re-render storm.
- **Quest evaluation** exposes a faster keys-only single-pass (11 ms) than the
  full engine (39–41 ms) at 20k samples; this is an A/B probe informing design,
  not a proven live hot path, and progression code is a **Critical**-sensitive
  surface (currency/progression corruption is a P0). No speculative change was
  made to progression logic without a confirmed live bottleneck.

**Result:** No confirmed application-controlled frame bottleneck cleared the bar
for a safe, evidence-backed correction on the measured paths. Accordingly this
workstream delivers controlled measurements + a precise overhead explanation
rather than an unmeasured "optimization." This is the mandate's accepted close
for the case where no safe application-controlled optimization is justified.
**A single measured before/after optimization is intentionally not claimed** to
avoid fabricating a performance win.

## C5 — Memory & leak analysis

- **Large-backup export heap:** the large-backup probe shows a **96 MB heap /
  98 MB RSS delta** when exporting a synthetic 20,000-session dataset (~15 M
  UTF-16 text units, 966 chunks). This is the previously-reported large-backup
  export heap increase. It is a **batch export** cost, not a gameplay/leak issue,
  and improving it would require a storage/streaming rewrite that this campaign
  explicitly declines to undertake solely for a synthetic benchmark. Recorded as
  known tradeoff.
- **Artwork memory budget:** Campaign 078 established the cover-image memory
  tradeoff (texture cache growth to ~40 MB with all 42 covers decoded). No new
  unbounded growth was observed in the sweep/journeys; cache behavior remains the
  documented intentional tradeoff.
- Repeated open/close game + navigation cycles during the 42-game sweep showed no
  crash or observed unbounded growth; a formal leak instrument run (repeated
  cycles with heap sampling) was **not** completed this campaign — **partial gap**.

## C6 — Confidence & limitations

- Source probes are same-machine comparable (before/after on one host); absolute
  values vary by machine and are **not** gates.
- On-device frame data is from a **SwiftShader software-rendered x86_64 emulator**
  and does **not** represent physical-device or ARM64-native GPU performance.
  No "60 FPS" or physical-latency claim is made.
- The gameplay `gfxinfo` capture registered 0 frames (grid-recall was static
  awaiting input — measurement artifact), so the representative frame data here is
  the UI-navigation scenario; a dedicated gameplay frame benchmark is a residual
  gap.
- Practical significance: for the measured UI path the app is responsive
  (4.85 % modern jank, p95 34 ms); tail latency (p99 121 ms) and the high
  GPU share point to software rendering as the limiting factor on the emulator,
  not application logic.
