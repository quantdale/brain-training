# Campaign 067 — pixel and accessibility matrix

**Artifact:** `B7AA4102…` · **Target:** dedicated `emulator-5554` ·
**Harness:** `scripts/qa/ui-capture.mjs` (manifest written by the
harness) + `scripts/qa/a11y-audit.mjs`.

## Capture matrix (66/66 PASS)

11 canonical surfaces × 3 display profiles × 2 themes:

| Profile | Density/scale | Captures | Result |
|---|---|---|---|
| default | 420 | 22 (11 × light/dark) | **PASS** — `[PASS] 22 surface capture(s)` |
| compact | 720×1600 @ 320 | 22 | **PASS** |
| font-scale-2 | system font scale 2.0 | 22 | **PASS** |

Surfaces: home, games, game-detail, progress, progress-activity,
progress-detail, profile, rewards, data-management, results, game-intro
(gameplay entry for `memory`). Every capture is nonblank, route-verified
against the surface's expected root testIDs (the harness fails otherwise)
and dialog-free. Raw captures: `D:\Temp\campaign067-captures\manifest.json`
(outside Git).

Interaction coverage beyond the gameplay-entry surface (the 42-game
six-way expansion) is **NOT VALIDATED** — carried as census C2 for the
hardening phase.

## Accessibility audit

`a11y-audit.mjs` per profile (density matched to the profile):

| Profile | Flagged `<44 dp` (as captured) | Unlabelled interactive | Other kinds |
|---|---|---|---|
| default | 12 | **0** | none |
| compact | 8 | **0** | none |
| font-scale-2 | 10 | **0** | none |

**Classification (corrected during the hardening phase).** The initial
blanket `COMPLIANT_PARENT_OR_HITSLOP` label was overstated. Re-derivation
from the archived dumps with the corrected audit tool shows:

- **4 items per theme were TRUE undersized targets:** the Progress period
tabs (`7d/30d/90d/All`) rendered 32 dp (`segmented-control.tsx` compact
option). The hardening phase fixed this (`minHeight: MinTouchTarget` 44)
and pinned it with a layout assertion; the certified artifact predates
the fix, so a fresh capture on the hardening artifact is required to
show it clean.
- **The remaining flags were occlusion false positives, not size
defects:** `Export backup to JSON`, `Play again`, and `Add to favorites`
sit under the bottom tab-bar overlay in the captured viewport; the audit
tool measured only the visible sliver. The tool now classifies pinned or
overlay-covered nodes as `occluded` (excluded from violations and listed
separately), and re-running it on the archived captures yields 0 size
violations for those controls.
- **Zero unlabelled interactive nodes** across all 66 captures — the 055
accessibility property holds on the certified artifact.

Raw audit JSON: `D:\Temp\campaign067-a11y-{default,compact,fs2}.json`
(outside Git). Machine-readable curated copies: `A11Y_AUDIT.json` in this
directory (original capture), with the corrected classification and
hardening fix recorded in
`docs/hardening/post067/PASS_C_RELEASE_UX.md`.
