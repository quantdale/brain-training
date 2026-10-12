# Campaign 076 — Visual Decision Report

**Generated:** 2026-10-12T23:04:44.078Z
**Change:** `openspec/changes/076-product-wide-ui-ux-reboot`
**Certification change:** `openspec/changes/076-f-final-product-certification`
**Parent tasks addressed:** 14.3 (matched before/after matrices), 14.7 (coverage manifest + visual decision report)
**ARTEMIS calls used for this work:** **zero.** No gameplay journey, no 42-game sweep, no nine-journey rerun.

## 1. Decision

**Parent task 14.7 is checked: the coverage manifest, this visual decision report, the three-direction scorecard and reference-lock links, the matched-image index, artifact hashes and the explicit residual gaps are all published, and no game is missing a status.**

**Parent task 14.3 stays open, and this report states the exact missing pairs rather than relaxing the criteria.** Task 14.3 requires *matched* route and representative-game before/after matrices for **default light/dark, 2× text, compact/large layouts and reduced-motion**. Of those four conditions, only two have a matched historical before profile:

| 14.3 condition | Matched before profile exists? | Matched pairs | Gap |
| --- | --- | --- | --- |
| default light/dark | **yes** | 16 route pairs + 42 game tutorial pairs | 14 route surfaces after-only |
| 2× text (`fs2`) | **yes, light only** | 4 route pairs (light only) | 11 light + 15 dark surfaces after-only |
| compact/large layouts | **no** | 0 | 30 surfaces after-only, measurement PASS only |
| reduced-motion | **no** | 0 | no historical before profile **and no images on either side**; measurement only |

An after-only measurement is not a matched comparison and is never presented as one. Producing the missing compact, reduced-motion and dark-2× before states requires rebuilding the pre-redesign baseline (`d631ab9a…` from source `d3d0b99`), which the owner explicitly excluded, or a historical recapture campaign that no longer exists to be run. Reporting the gap is therefore the only honest disposition.

## 2. Artifact identities — preserved, never relabelled

| Role | Source | APK SHA-256 | Short | Used for |
| --- | --- | --- | --- | --- |
| Before (pre-redesign baseline) | `d3d0b9926a44c039d7fd0d29e1376586afaa897b` | `d631ab9a410f9950f3c5cd989fe23b26d00178ecf98bafc439e86e85f20950a9` | d631ab9a41 | 20 route captures, 272 game-board state captures |
| After (post-redesign route matrix) | `c324960c7619d305f01d60587f9e74c4ca93ca6a` | `de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d` | de6c5fcd19 | 90 route captures, 6 accessibility audits |
| After (repaired terminal APK) | `d5787ec2857b0fd856d2e04ad346316d70951f6c` | `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6` | c8c3d46c2d | 84 tutorial frames (42 games × light/dark) |

Historical screenshots stay historical. The post-redesign matrix keeps its own `de6c5fcd…` identity and is **not** relabelled as a terminal capture. The terminal identity is `c8c3d46c…`, and it was read from the installed APK on the device (`sha256sum` of the installed `base.apk`) rather than assumed.

## 3. What was verified before anything was paired

| Inventory | Images | SHA-256 verified | Identity verified | Missing |
| --- | --- | --- | --- | --- |
| `before-captures/` | 272 | 272 | `d631ab9a` | 0 |
| `before/` | 20 | 20 | `d631ab9a` | 0 |
| `final-matrix-de6c5fcd/` | 90 | 90 (PNG magic + identity) | `de6c5fcd` | 0 |
| `terminal-tutorials-c8c3d46c/` | 84 | 84 | `c8c3d46c` (read from device) | 0 |
| **total** | **466** | **466** | | **0** |

Every image was decoded and its **theme measured from mean relative luminance** rather than inferred from its path. That check is what found the central problem in this evidence set:

- all **260 light / 12 dark** `before-captures/` frames, including **every** game board and **every** tutorial;
- all **42** accepted `current-device/` game rows are **dark**;

So a before/after pair for a game board compares light-old against dark-new. That is a theme mismatch, not a match, and it is reported as one.

## 4. Matched pairs (theme-verified)

{"MATCHED":62,"AFTER-ONLY":112,"THEME-MISMATCHED":38,"BEFORE-SURFACE-DIFFERS":4}

**62 matched pairs** — *20 route* + *42 game tutorial (light)*. Each row below was paired only after both frames measured the same theme.

Full machine-readable list: `evidence/matched-gallery.json` and `evidence/coverage-matrix.json`.

### 4.1 Route pairs (20)

| Profile / theme / route | Before frame (`d631ab9a`) | After frame (`de6c5fcd`) |
| --- | --- | --- |
| `default/dark/data-management` | `before/default/dark/data-management.png` | `final-matrix-de6c5fcd/default/dark/data-management.png` |
| `default/dark/game-detail` | `before/default/dark/game-detail.png` | `final-matrix-de6c5fcd/default/dark/game-detail.png` |
| `default/dark/game-intro` | `before/default/dark/game-intro.png` | `final-matrix-de6c5fcd/default/dark/game-intro.png` |
| `default/dark/games` | `before/default/dark/games.png` | `final-matrix-de6c5fcd/default/dark/games.png` |
| `default/dark/home` | `before/default/dark/home.png` | `final-matrix-de6c5fcd/default/dark/home.png` |
| `default/dark/profile` | `before/default/dark/profile.png` | `final-matrix-de6c5fcd/default/dark/profile.png` |
| `default/dark/progress` | `before/default/dark/progress.png` | `final-matrix-de6c5fcd/default/dark/progress.png` |
| `default/dark/rewards` | `before/default/dark/rewards.png` | `final-matrix-de6c5fcd/default/dark/rewards.png` |
| `default/light/data-management` | `before/default/light/data-management.png` | `final-matrix-de6c5fcd/default/light/data-management.png` |
| `default/light/game-detail` | `before/default/light/game-detail.png` | `final-matrix-de6c5fcd/default/light/game-detail.png` |
| `default/light/game-intro` | `before/default/light/game-intro.png` | `final-matrix-de6c5fcd/default/light/game-intro.png` |
| `default/light/games` | `before/default/light/games.png` | `final-matrix-de6c5fcd/default/light/games.png` |
| `default/light/home` | `before/default/light/home.png` | `final-matrix-de6c5fcd/default/light/home.png` |
| `default/light/profile` | `before/default/light/profile.png` | `final-matrix-de6c5fcd/default/light/profile.png` |
| `default/light/progress` | `before/default/light/progress.png` | `final-matrix-de6c5fcd/default/light/progress.png` |
| `default/light/rewards` | `before/default/light/rewards.png` | `final-matrix-de6c5fcd/default/light/rewards.png` |
| `fs2/light/game-intro` | `before/font-scale-2/light/game-intro.png` | `final-matrix-de6c5fcd/fs2/light/game-intro.png` |
| `fs2/light/home` | `before/font-scale-2/light/home.png` | `final-matrix-de6c5fcd/fs2/light/home.png` |
| `fs2/light/profile` | `before/font-scale-2/light/profile.png` | `final-matrix-de6c5fcd/fs2/light/profile.png` |
| `fs2/light/progress` | `before/font-scale-2/light/progress.png` | `final-matrix-de6c5fcd/fs2/light/progress.png` |

### 4.2 Game tutorial pairs (42, light theme)

Tutorial screens are the only game surface reachable **statically** — by deep link, with no gameplay — which is why they are the game state that could be collected on the terminal APK under the zero-ARTEMIS constraint. Each captured frame was proven to be the tutorial surface by reading the accessibility hierarchy for that game’s own `intro-back` and `start` controls, not by trusting the deep link.

| # | Game | Before (`d631ab9a`) | After (`c8c3d46c`) |
| --- | --- | --- | --- |
| 1 | `attention-odd-one-out` | `attention-odd-one-out-tutorial.png` | `attention-odd-one-out-light.png` |
| 2 | `attention-sustained-vigilance` | `attention-sustained-vigilance-tutorial.png` | `attention-sustained-vigilance-light.png` |
| 3 | `attention-symbol-tracker` | `attention-symbol-tracker-tutorial.png` | `attention-symbol-tracker-light.png` |
| 4 | `attention-target-count` | `attention-target-count-tutorial.png` | `attention-target-count-light.png` |
| 5 | `attention-visual-search` | `attention-visual-search-tutorial.png` | `attention-visual-search-light.png` |
| 6 | `flexibility-card-sort` | `flexibility-card-sort-tutorial.png` | `flexibility-card-sort-light.png` |
| 7 | `flexibility-color-stroop` | `flexibility-color-stroop-tutorial.png` | `flexibility-color-stroop-light.png` |
| 8 | `flexibility-cue-shift` | `flexibility-cue-shift-tutorial.png` | `flexibility-cue-shift-light.png` |
| 9 | `flexibility-rule-flip` | `flexibility-rule-flip-tutorial.png` | `flexibility-rule-flip-light.png` |
| 10 | `flexibility-task-switch` | `flexibility-task-switch-tutorial.png` | `flexibility-task-switch-light.png` |
| 11 | `language-context-fit` | `language-context-fit-tutorial.png` | `language-context-fit-light.png` |
| 12 | `language-sentence-builder` | `language-sentence-builder-tutorial.png` | `language-sentence-builder-light.png` |
| 13 | `language-word-chain` | `language-word-chain-tutorial.png` | `language-word-chain-light.png` |
| 14 | `language-word-match` | `language-word-match-tutorial.png` | `language-word-match-light.png` |
| 15 | `language-word-scramble` | `language-word-scramble-tutorial.png` | `language-word-scramble-light.png` |
| 16 | `logic-code-cracker` | `logic-code-cracker-tutorial.png` | `logic-code-cracker-light.png` |
| 17 | `logic-deduction-table` | `logic-deduction-table-tutorial.png` | `logic-deduction-table-light.png` |
| 18 | `logic-next-sequence` | `logic-next-sequence-tutorial.png` | `logic-next-sequence-light.png` |
| 19 | `logic-order-path` | `logic-order-path-tutorial.png` | `logic-order-path-light.png` |
| 20 | `logic-rule-grid` | `logic-rule-grid-tutorial.png` | `logic-rule-grid-light.png` |
| 21 | `math-equation-builder` | `math-equation-builder-tutorial.png` | `math-equation-builder-light.png` |
| 22 | `math-fast-math` | `math-fast-math-tutorial.png` | `math-fast-math-light.png` |
| 23 | `math-missing-operator` | `math-missing-operator-tutorial.png` | `math-missing-operator-light.png` |
| 24 | `math-number-line-estimation` | `math-number-line-estimation-tutorial.png` | `math-number-line-estimation-light.png` |
| 25 | `math-value-ordering` | `math-value-ordering-tutorial.png` | `math-value-ordering-light.png` |
| 26 | `memory` | `memory-tutorial.png` | `memory-light.png` |
| 27 | `memory-grid-recall` | `memory-grid-recall-tutorial.png` | `memory-grid-recall-light.png` |
| 28 | `memory-pair-recall` | `memory-pair-recall-tutorial.png` | `memory-pair-recall-light.png` |
| 29 | `memory-pattern-tap-back` | `memory-pattern-tap-back-tutorial.png` | `memory-pattern-tap-back-light.png` |
| 30 | `memory-prospective-cue` | `memory-prospective-cue-tutorial.png` | `memory-prospective-cue-light.png` |
| 31 | `memory-running-order` | `memory-running-order-tutorial.png` | `memory-running-order-light.png` |
| 32 | `memory-sequence-memory` | `memory-sequence-memory-tutorial.png` | `memory-sequence-memory-light.png` |
| 33 | `spatial-coordinate-turn` | `spatial-coordinate-turn-tutorial.png` | `spatial-coordinate-turn-light.png` |
| 34 | `spatial-fold-match` | `spatial-fold-match-tutorial.png` | `spatial-fold-match-light.png` |
| 35 | `spatial-grid-nav` | `spatial-grid-nav-tutorial.png` | `spatial-grid-nav-light.png` |
| 36 | `spatial-mental-rotation` | `spatial-mental-rotation-tutorial.png` | `spatial-mental-rotation-light.png` |
| 37 | `spatial-transform-match` | `spatial-transform-match-tutorial.png` | `spatial-transform-match-light.png` |
| 38 | `speed-color-match` | `speed-color-match-tutorial.png` | `speed-color-match-light.png` |
| 39 | `speed-order-sweep` | `speed-order-sweep-tutorial.png` | `speed-order-sweep-light.png` |
| 40 | `speed-quick-compare` | `speed-quick-compare-tutorial.png` | `speed-quick-compare-light.png` |
| 41 | `speed-reaction-time` | `speed-reaction-time-tutorial.png` | `speed-reaction-time-light.png` |
| 42 | `speed-tap-rush` | `speed-tap-rush-tutorial.png` | `speed-tap-rush-light.png` |

## 5. After-only observations (not comparisons)

112 surfaces have a post-redesign frame and no historical before frame. These are recorded as after-only and are never counted as matched.

- **42 dark-tone tutorial frames** — captured for completeness; no historical dark-theme before tutorial exists.
- **70 matrix route surfaces** — including the whole `compact` profile (`${compactMissing.length}` surfaces), all `fs2/dark`, and 7 routes with no historical counterpart at all.

## 6. The gaps that keep parent 14.3 open — stated exactly

**6.1 Compact / large layouts — 30 surfaces after-only, 0 matched.** Exact surfaces: `light/home`, `light/games`, `light/game-detail`, `light/progress`, `light/progress-activity`, `light/progress-detail`, `light/profile`, `light/rewards`, `light/data-management`, `light/results`, `light/game-intro`, `light/progress-domain`, `light/progress-game`, `light/storage-unavailable`, `light/bootstrap-recovery`, `dark/home`, `dark/games`, `dark/game-detail`, `dark/progress`, `dark/progress-activity`, `dark/progress-detail`, `dark/profile`, `dark/rewards`, `dark/data-management`, `dark/results`, `dark/game-intro`, `dark/progress-domain`, `dark/progress-game`, `dark/storage-unavailable`, `dark/bootstrap-recovery`.

**6.2 Reduced-motion — no before profile, and no images on either side.** The reduced-motion check exists only as a measurement: 30 surfaces across default light/dark, **0 violations**. No screenshot is filed for it, and no historical before profile exists. A matched reduced-motion comparison is therefore impossible from existing evidence; it is reported as a measurement PASS, which is a different thing from a matched comparison PASS.

**6.3 2× text — light has 4 matched pairs, but `games`, `game-detail`, `progress-activity`, `progress-detail`, `rewards`, `data-management`, `results`, `progress-domain`, `progress-game`, `storage-unavailable`, `bootstrap-recovery` are after-only, and all `home`, `games`, `progress`, `progress-activity`, `progress-detail`, `profile`, `rewards`, `data-management`, `results`, `game-intro`, `progress-domain`, `progress-game`, `storage-unavailable`, `bootstrap-recovery`, `game-detail` are after-only in dark. So the "dark/light 2× text" condition is only half matched.

**6.4 Default profile — `light/progress-activity`, `light/progress-detail`, `light/results`, `light/progress-domain`, `light/progress-game`, `light/storage-unavailable`, `light/bootstrap-recovery`, `dark/progress-activity`, `dark/progress-detail`, `dark/results`, `dark/progress-domain`, `dark/progress-game`, `dark/storage-unavailable`, `dark/bootstrap-recovery` (7 routes × 2 themes, 14 surfaces) are after-only.

**6.5 Representative game result frames — 38 theme-mismatched and 4 surface-differs, 0 matched.**

Every historical game board is light and every accepted game row is dark, so **no** game result frame can be paired. The 38 mismatched games are: `attention-odd-one-out/result`, `attention-sustained-vigilance/result`, `attention-symbol-tracker/result`, `attention-target-count/result`, `attention-visual-search/result`, `flexibility-color-stroop/result`, `flexibility-cue-shift/result`, `flexibility-rule-flip/result`, `language-context-fit/result`, `language-sentence-builder/result`, `language-word-chain/result`, `language-word-match/result`, `language-word-scramble/result`, `logic-code-cracker/result`, `logic-deduction-table/result`, `logic-next-sequence/result`, `logic-order-path/result`, `logic-rule-grid/result`, `math-equation-builder/result`, `math-fast-math/result`, `math-missing-operator/result`, `math-number-line-estimation/result`, `math-value-ordering/result`, `memory/result`, `memory-grid-recall/result`, `memory-pair-recall/result`, `memory-pattern-tap-back/result`, `memory-prospective-cue/result`, `memory-sequence-memory/result`, `spatial-coordinate-turn/result`, `spatial-fold-match/result`, `spatial-mental-rotation/result`, `spatial-transform-match/result`, `speed-color-match/result`, `speed-order-sweep/result`, `speed-quick-compare/result`, `speed-reaction-time/result`, `speed-tap-rush/result`.

A further **4** games have no standalone before result at all — their only historical frame is a **workout-leg** result, which carries workout progress chrome a standalone result does not: `flexibility-card-sort/result`, `flexibility-task-switch/result`, `memory-running-order/result`, `spatial-grid-nav/result`. Pairing those would fabricate equivalence, so they are not paired.

Fixing 6.5 needs either dark-theme historical board captures (which need the baseline APK rebuild the owner excluded) or light-theme terminal captures of game results — which need **completed gameplay**, i.e. an ARTEMIS run, which the zero-ARTEMIS cost constraint excludes. This is a genuine, unavoidable gap, not an incomplete step.

## 7. Accessibility, clipping and hidden-action coverage (the second half of 14.3)

This half is fully satisfied and is an **after-only measurement PASS**, since no historical before audit profile exists. Totals are computed from the six audit files rather than stated from memory:

| Profile | Surfaces | Interactive | Labelled | Undersized | Unlabelled | Occluded (excluded) | Violations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| compact-dark | 15 | 73 | 73 | 0 | 0 | 5 | **0** |
| compact-light | 15 | 73 | 73 | 0 | 0 | 5 | **0** |
| default-dark | 15 | 64 | 64 | 0 | 0 | 6 | **0** |
| default-light | 15 | 64 | 64 | 0 | 0 | 6 | **0** |
| fs2-dark | 15 | 53 | 53 | 0 | 0 | 5 | **0** |
| fs2-light | 15 | 53 | 53 | 0 | 0 | 5 | **0** |

Total across all six profiles: **90 surfaces, 380 interactive controls, 380 labelled, 0 undersized, 0 unlabelled, 0 violations**, with 32 occluded nodes excluded from the pass count rather than counted as passing. The 42-device a11y audit (`ROUTES_AND_A11Y.md`) independently measures 126 surfaces / 756 controls / 0 violations.

## 8. Three-direction scorecard and reference lock

Both artifacts already exist and are the ones the task names:

- **Three-direction scorecard:** [`evidence/proto-scorecard.md`](../076-product-wide-ui-ux-reboot/evidence/proto-scorecard.md) — A Pocket Console **8.45**, B Training Studio **8.63**, C Puzzle Index **7.63**, selected B. 66 hashed device captures in `proto-captures/`.
- **Reference lock:** [`evidence/REFERENCE_LOCK.md`](../076-product-wide-ui-ux-reboot/evidence/REFERENCE_LOCK.md) — Training Studio, with the token table and the permitted/rejected borrowings.

Neither is a terminal-APK artifact: the scorecard was graded on the three prototypes before the redesign landed, and the lock predates `c8c3d46c…`. They are linked as the decision record they are, not restated as current-APK evidence.

## 9. Method, tooling and reproducibility

All collection was emulator-local `adb`; no host mouse or keyboard was used (AGENTS.md host-interaction prohibition), and no production source file was edited.

| Script | Role |
| --- | --- |
| `scripts/qa/verify-visual-evidence.mjs` | verifies every image exists, matches its indexed SHA-256 and carries its inventory identity |
| `scripts/qa/analyse-image-themes.mjs` | decodes 492 images and measures mean relative luminance → measured theme |
| `scripts/qa/capture-terminal-tutorials.mjs` | captures 42 tutorials × 2 themes on the terminal APK, proving each surface from the hierarchy |
| `scripts/qa/verify-terminal-tutorials.mjs` | re-checks each captured frame’s measured theme, dimensions and non-blankness |
| `scripts/qa/build-final-gallery.mjs` | forms pairs, requiring theme agreement |
| `scripts/qa/build-coverage-matrix.mjs` | produces the per-surface coverage matrix |

## 10. Disposition

| Parent task | Disposition |
| --- | --- |
| **14.7** | **CHECKED** — coverage manifest, this report, scorecard/reference-lock links, matched-image index, artifact hashes, residual debt and explicit gaps are all published; no game is missing a status. |
| **14.3** | **OPEN** — matched matrices exist for default light/dark and light 2× text only. The exact missing pairs are named in §6 and require the excluded baseline rebuild to produce. Not rewritten and not checked. |

---

*Nothing in this report claims a match that was not measured, relabels a historical capture as terminal, or counts an after-only observation as a comparison.*