# Campaign 038 before/after pixel and hierarchy evidence

The matching native baseline is `D:\Temp\campaign038-runtime-before`; the
post-fix matrix is `D:\Temp\campaign038-runtime-after-fixed`. Both are
1080×2400 PNG/XML captures of the same 11 routes in light and dark themes.
Every after capture is route-verified and nonblank by the capture manifest.

The implementation checkpoint changes only asynchronous persistence code and a
test, so it has no intended visual delta. Pixel comparison was still run over
the real rendered PNGs. Representative stable comparisons are below; changed
pixel percentage is per image and RMSE is the 8-bit RGBA channel error.

| Theme/surface | Changed pixels | RMSE | Interpretation |
| --- | ---: | ---: | --- |
| light / games | 0.04% | 1.70 | Stable; clock/settling noise |
| light / profile | 0.04% | 1.74 | Stable; no layout change |
| light / rewards | 0.04% | 1.74 | Stable; no layout change |
| dark / games | 0.04% | 0.51 | Stable; no layout change |
| dark / profile | 0.10% | 1.03 | Stable; no layout change |
| dark / rewards | 0.10% | 1.12 | Stable; no layout change |
| dark / home | 0.03% | 2.74 | Stable; no layout change |

The light Home pair was intentionally not treated as a visual regression:
the after route settled on a visible loading/skeleton phase while the baseline
had the loaded workout card. Direct inspection showed real UI in both frames;
the difference is capture timing, not the Campaign 038 source change. The
compact Game Intro false-blank classification was similarly checked against
pixels and XML rather than hidden.

The after XML also preserves the same interactive labels/roles. The only
source-level behavior change is serialized sensory persistence, covered by the
focused and full Jest runs recorded in `RUNTIME_VALIDATION.md`.

