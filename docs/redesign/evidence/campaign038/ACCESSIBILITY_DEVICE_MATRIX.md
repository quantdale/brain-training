# Campaign 038 accessibility and device matrix

All native captures used the disposable `emulator-5554` AVD
(`braintraining-ui35`, Android 15/API 35, 1080×2400, density 420 unless
noted). Captures are external evidence under `D:\Temp`; the repository stores
the manifests and conclusions, not screenshots or private traces.

| Condition | Capture | Result | Notes |
| --- | --- | --- | --- |
| Default light/dark | `D:\Temp\campaign038-runtime-before` and `D:\Temp\campaign038-runtime-after-fixed` | 22/22 requested surfaces route-verified and nonblank in both matrices | Same 11 routes × 2 themes; `deepLinkStarted=true`, `routeVerified=true`, `blank=false` in the after manifest |
| Android font scale 2.0 | `D:\Temp\campaign038-font-scale-2` | 16/16 captured; a11y audit 0 violations | Home’s lower Transform Match card was clipped at the captured position (19dp visible), but remained scroll content; Profile/Rewards/Data text continued below the viewport |
| Compact phone 720×1600, density 320 | `D:\Temp\campaign038-compact` | 16 requested surfaces; a11y audit 0 violations | The capture runner labelled both Game Intro frames `BLANK`; direct pixel inspection showed real themed `Loading… / Starting the game… / Cancel` cards and XML had `game-not-ready-loading`, so this is a harness false-positive, not an app blank screen |
| Settled Profile scroll | `D:\Temp\campaign038-profile-settled-1.xml` | Reachable | Shield moved from `[751,2078][996,2126]` at the tab edge to `[751,198][996,314]`; at density 420 its 116px height is approximately 44dp |
| Settled Games scroll | `D:\Temp\campaign038-games-fixed-top.xml`, `campaign038-games-fixed-settled.xml` | Reachable | Symbol Tracker moved from `[42,1864][1038,2126]` to `[42,377][1038,867]` after one emulator-local swipe |

The automated audit was run with the matching capture density for each set:

- `D:\Temp\campaign038-runtime-after-fixed\a11y.json`: **0 violations
  across 22 surfaces**. It reports two expected visible-edge `clipped`
  entries per theme (Symbol Tracker 100dp visible; Shield 18dp visible),
  excluded from violations by the audit’s documented visible-bounds rule.
- `D:\Temp\campaign038-font-scale-2\a11y.json`: **0 violations across 16
  surfaces**.
- `D:\Temp\campaign038-compact\a11y.json`: **0 violations across 16
  surfaces**.

