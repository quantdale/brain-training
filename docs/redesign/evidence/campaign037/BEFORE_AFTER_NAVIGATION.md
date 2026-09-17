# Campaign 037 — Before/After Navigation Evidence

## Captures

- Before baseline: `D:\Temp\campaign037-runtime-before`
- Matching clean after baseline: `D:\Temp\campaign037-runtime-after-clean`
- Capture command: `node scripts/qa/ui-capture.mjs --device emulator-5554
  --out <dir> --theme light,dark --surfaces
  home,games,game-detail,progress,progress-activity,progress-detail,profile,
  rewards,data-management,results,game-intro`
- Result: **22/22 PASS** in both directories. Each requested surface was
  route-verified and nonblank by the capture utility.

The after directory was captured after the bounded source change with app data
cleared. The first cold GameHost capture can show its real lazy-loading state;
that is retained as an observation rather than treated as a settled gameplay
screen.

## Observed route/state paths

| Path | Evidence | Result |
| --- | --- | --- |
| Home → Games → Game Detail → Android back | `campaign037-games.xml`, `campaign037-detail.xml`, `campaign037-back-games.xml` | Returned to the launching Games route. |
| Game Detail → Play → GameHost intro → Android back | `campaign037-intro.xml`, `campaign037-after-back-from-intro.xml` | Intro was reachable; return restored Game Detail. Cold lazy loading was observable before the existing Cancel path became available. |
| Odd One Out live board → time-up/QA force-win → Results → Android back | `campaign037-live.xml`, `campaign037-result.xml`, `campaign037-back-result.xml` | Session completed with a persisted session identity and returned to Game Detail. |
| Game Detail → recent Results drill-down → Android back | `campaign037-result-route.xml`, `campaign037-after-back-results.xml` | Results rendered and returned to Game Detail. |
| Profile → Rewards → Android back | `campaign037-rewards.xml`, `campaign037-after-back-rewards.xml` | Returned to Profile. |
| Profile → Data Management → Android back | `campaign037-data.xml`, `campaign037-after-back-data.xml` | Returned to Profile. |
| Progress → domain detail → Android back | `campaign037-progress.xml`, `campaign037-progress-domain.xml`, `campaign037-progress-return.xml` | Returned to Progress with the 30d selection preserved. |
| Invalid Game, Detail, and Results IDs | `campaign037-invalid-game.xml`, `campaign037-invalid-detail.xml`, `campaign037-invalid-results.xml` | Recoverable not-found/empty states exposed a library/browse action; no blank trap observed. |

## Copy and pixel comparison

Screenshots were compared at the same 1080×2400 emulator resolution with a
Pillow RGB exact-difference pass. The Home difference is the intended copy
and layout reflow; the other surfaces are effectively unchanged.

| Theme/surface | Before SHA-256 | After SHA-256 | Changed pixels | RGB RMSE |
| --- | --- | --- | ---: | ---: |
| light / Home | `4136CA2F4E0D98B09BEDD911D5DF9ED8AC3D6C24CBF1949C47529AE733FEFB1A` | `0E65B22222DE8AF0FD3B232240812457B9F51A1DE77AAADBB0E2F5A29985552C` | 13.63% | 45.22 |
| dark / Home | `2F39A514BD6648959C798C0DA63D3BF4F41A4B0B2C643240A2F006D833123060` | `CFCE76D75FB7FF1D4C0144D78E2B3C1D7DFEB345265F5B2EB42D831A999D389D` | 13.73% | 39.86 |
| all other light surfaces | per-surface files in the two directories | per-surface files in the two directories | 0.02–0.08% | 1.30–2.88 |
| all other dark surfaces | per-surface files in the two directories | per-surface files in the two directories | 0.02–0.03% | 2.74–3.16 |

The raw captures remain outside Git under `D:\Temp`; no screenshot or trace
was invented or copied into the repository.

