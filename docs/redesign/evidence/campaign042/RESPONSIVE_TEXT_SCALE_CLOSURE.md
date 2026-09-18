# Campaign 042 — Responsive and Text-Scale Closure

**Status:** `[REPAIRED_AND_REVALIDATED]`
**Date:** 2026-09-18

## Defect

The pre-repair release Results screen at Android font scale 2 rendered the
primary Play Again action only partially inside the initial viewport. The
pre-repair XML measured its bounds as `[42,2333][1038,2400]`, approximately
26 dp visible at density 420. This was a real actionable-control reachability
defect, not a screenshot interpretation issue.

## Minimal repair

`apps/mobile/src/app/results.tsx` now reads `useWindowDimensions().fontScale`
and applies a local `heroLargeText` style when `fontScale >= 1.5`. That style
tightens only the Results hero's gap and padding. It keeps the existing
content, hierarchy, component order, and normal-font layout unchanged; it does
not change game, scoring, persistence, or navigation behavior.

## Revalidation

On the final release artifact at density 420/font scale 2:

```text
Results summary bounds       [42,499][1038,1469]
Results reward bounds        [42,1891][1038,2144]
Play Again bounds            [42,2186][1038,2355]
Play Again visible height    169 px ≈ 64 dp
Automated a11y violations    0
```

The compact baseline (density 320) and the normal-font route matrix both
remained clean. The final compact audit reports 0 violations across four
surfaces; the final font-scale-2 audit reports 0 violations across four
surfaces. The only clipped notes are non-actionable card-copy edges recorded
in the state matrix.

Evidence files:

- Pre-repair: `D:\Temp\campaign042\release-after-fix\responsive\font-scale-2\results.png`
- Final XML/PNG: `D:\Temp\campaign042\release-after-repair\results-repair\results-font2.xml` and `results-font2.png`
- Audits: `responsive-final-compact-a11y.json` and `responsive-final-font2-a11y.json`
