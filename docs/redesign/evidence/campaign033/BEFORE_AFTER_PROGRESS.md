# Progress before/after record

The same repository app was rendered on the dedicated Android target before and after the Campaign 033 source changes. Raw PNG/XML files remain outside Git at the paths below; each `ui-capture` manifest records the deep-link route check and blank-frame check.

## Populated state

| State | Before | After |
| --- | --- | --- |
| Light overview | `D:/Temp/campaign033-runtime-before-live/default/light/progress.png` | `D:/Temp/campaign033-runtime-after-populated/default/light/progress.png` |
| Dark overview | `D:/Temp/campaign033-runtime-before-live/default/dark/progress.png` | `D:/Temp/campaign033-runtime-after-populated/default/dark/progress.png` |
| Representative drill-downs | before manifest includes `progress-detail` and `progress-activity` in light/dark | after manifest includes `progress-detail` and `progress-activity` in light/dark |

Before, the first populated viewport was dominated by the large composite ring, overall score, and analytics framing. After, the first meaningful viewport presents `At a glance`, trained days, sessions, sessions per active day, recorded-movement sufficiency, and a domain consideration before the old composite/analytics stack. The after screenshot was independently inspected in both light and dark themes.

## Sparse state

| State | Before | After |
| --- | --- | --- |
| Light overview | `D:/Temp/campaign033-runtime-before-sparse/default/light/progress.png` | `D:/Temp/campaign033-runtime-after-sparse2/default/light/progress.png` |
| Dark overview | `D:/Temp/campaign033-runtime-before-sparse/default/dark/progress.png` | `D:/Temp/campaign033-runtime-after-sparse2/default/dark/progress.png` |

The sparse before state showed a large empty panel followed by the old `0 of 8 / 1000` composite treatment. The sparse after state uses the empty message followed by a compact outlined `How ratings start / No history / 1000` explanation, without presenting the initial rating as a performance result.

## Artifact integrity

- All listed `ui-capture` entries had `routeVerified: true` and `blank: false`.
- The light populated overview changed from SHA-256 `4244B62F31D83427F1DC7E7CA689D3CE51393C61D62E79D4E7F56ADE25F27E2E` to `AC3DCF75338EA6EC1A51364A12F0C27184690A08B4AA0B9FE7FFC939B706D01C`.
- The light sparse overview changed from SHA-256 `FEB33F8A27EDD1B87388680AD13A78E23D74DDD93B4B39D57AC1BDCC22ACEE90` to `F739826DC7FB90BD50AEBD170F9C20C487551194DE749F0AEBC98B21982E6B82`.

