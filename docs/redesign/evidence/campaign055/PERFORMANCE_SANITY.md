# Campaign 055 — Performance Sanity

## What changed (performance-relevant)

- No new image/bitmap assets; all new visuals are plain React Native views and
  text (Stage scenes reuse the existing `GameWorldArt` geometry).
- No new lists, virtualisation or nested scrolling: the Games catalog remains
  the same single windowed scroll with a denser child (2-up tiles instead of
  full-width cards, i.e. **fewer** layout nodes per viewport).
- No new animation loops: existing `Entrance`, press feedback and the bounded
  reward confetti are unchanged (the confetti is now gated to strong outcomes,
  so it runs less often).
- Result/report screens replace card-in-card structures with flat rows, which
  removes nested clipping/overflow work.

## Measurements available

| Check | Result |
| --- | --- |
| Release build | `:app:assembleRelease --no-daemon` — BUILD SUCCESSFUL in 3 m 10 s (pre-freeze artifact) |
| Debug build | `:app:assembleDebug --no-daemon` — BUILD SUCCESSFUL in 1 m 54 s |
| Jest full suite (includes the repository performance probes when opted in) | 565 suites / 6,731 tests in 199 s |
| Opt-in probes (5/5, `PERF_PROBE=1`, `LARGE_BACKUP_PROBE=1`) | 5 suites / 22 tests passed (repository-scale query/export/sync/projection measurements; machine-relative) |
| Compact/light matrix capture | 11/11 surfaces captured with stable frames; no jank or blank-frame observations recorded in the capture log |

## Not measured (environment blocker)

- On-device first-render/scroll timings for Home and Games on the final
  artifact (the host emulator crashed before the measurement pass; the
  documented blocker is in `FINAL_NATIVE_VALIDATION.md`).
- Memory/decode cost: not applicable — no bitmap assets were introduced.

## Assessment

No performance-relevant structure was added; the catalog got denser with fewer
nodes per viewport and no new asset decoding. The earlier Campaign 048/054
probe baselines remain valid for the untouched data/query paths. On-device
profiling of the re-composed screens is listed as a follow-up for the resumed
native pass rather than claimed.
