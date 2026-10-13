# Campaign 076 — Visual Decision Report

**Generated:** 2026-10-13T03:53:06.257Z
**Scope:** bounded cleanup of existing evidence; no production edit, new device capture, local/historical APK rebuild, ARTEMIS call, game sweep or journey certification.

## 1. Disposition

**Parent 14.3 remains OPEN. Its original acceptance criteria are unchanged. The release verdict remains `CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED`.**
Parent 14.7 remains checked for publication of the coverage manifest, report, reference links and explicit gaps. Publication does not establish 14.3 acceptance.

The previous claim of 62 theme-verified pairs is withdrawn. No committed hash-linked witness establishes the observed app theme in these inventories. Requested capture modes and image brightness cannot supply that witness. There are **0 theme-confirmed matched pairs**.

## 2. Integrity and artifact identities

| Inventory | PNGs | Integrity check | APK / source |
| --- | --- | --- | --- |
| before-captures | 272 | recorded SHA-256 and bytes verified | `d631ab9a410f9950f3c5cd989fe23b26d00178ecf98bafc439e86e85f20950a9` / `d3d0b9926a44c039d7fd0d29e1376586afaa897b` |
| before routes | 20 | recorded SHA-256 and bytes verified | `d631ab9a410f9950f3c5cd989fe23b26d00178ecf98bafc439e86e85f20950a9` / `d3d0b9926a44c039d7fd0d29e1376586afaa897b` |
| final route matrix | 90 | each recorded pngSha256 and pngBytes verified; PNG and per-capture identity checks | `de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d` / `c324960c7619d305f01d60587f9e74c4ca93ca6a` |
| terminal tutorials | 84 | original recorded SHA-256 and bytes verified; existing hierarchy proves intro controls | `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6` / `d5787ec2857b0fd856d2e04ad346316d70951f6c` |
| filed game result rows | 42 | hashes computed for indexing; no separate prior per-PNG digest asserted | identities retained from each review; `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` |

The first four inventories total **466 PNGs** checked against prior recorded digests. The theme inventory contains **508 PNGs**: those 466 plus the 42 filed result rows. The prior theme walk included unrelated certification images under a misleading 42-row label; that scope is corrected.
Hash integrity verifies referenced bytes, not the claimed surface, theme or release acceptance. Historical route matrix `de6c5fcd19` remains historical, and is not relabelled as repaired-terminal evidence. No source PNG or original recorded digest was replaced.

## 3. Theme evidence

| Inventory | Observed app theme | Available metadata and limit |
| --- | --- | --- |
| before-captures | UNKNOWN | index records bytes/hash/APK/source, no observed-theme metadata |
| before routes | UNKNOWN | directory names label intended slots; original capture manifest was overwritten |
| final route matrix | UNKNOWN | hash-linked surfaces[].theme records requested mode; no selected app-theme witness |
| terminal tutorials | UNKNOWN | hash-linked games[].theme records requested mode; no selected app-theme witness |
| filed game results | UNKNOWN | reviews carry APK identity, no observed-theme metadata |

Mean relative luminance is retained only as a pixel diagnostic. There is no brightness threshold or filename fallback for observed theme. The old assertions that every historical board is light and every accepted row is dark are unsupported and withdrawn.
A future known classification needs hash-linked observed app-theme metadata or an equivalent same-capture witness. A selected system preference also needs the corresponding OS night-mode state. Missing or conflicting evidence stays UNKNOWN.

## 4. Coverage and unresolved candidates

`{"AFTER-ONLY":112,"THEME-UNKNOWN":100,"BEFORE-SURFACE-DIFFERS":4}`

**0 matched; 100 candidate comparisons with unverified themes; 112 after-only slots; 4 historical surface differences.**
The coverage matrix has 216 rows. Its captureTheme field labels a declared slot; its theme field reports the observed classification. Two UNKNOWN values never establish theme agreement.

| 14.3 condition | Confirmed matches | Existing before candidates | Remaining evidence |
| --- | --- | --- | --- |
| default route slots | 0 | 16 (themes unverified) | 14 after-only; observed themes UNKNOWN |
| fs2 route slots | 0 | 4 (themes unverified) | 26 after-only; observed themes UNKNOWN |
| compact route slots | 0 | 0 (themes unverified) | 30 after-only; observed themes UNKNOWN |
| reduced-motion | 0 | 0 | no before/after screenshot profile filed; existing measurement is not a comparison |

Tutorials: 42 former light-slot candidates are THEME-UNKNOWN; 42 separately requested dark-slot stills are after-only. The historical tutorial theme is unknown, so absence of a historical dark theme is not asserted.
Results: 38 standalone candidates are THEME-UNKNOWN; 4 games have only a different historical surface (workout-leg chrome). Neither uncertainty nor different surfaces may be counted as matched.

**Compact layouts:** 30 unresolved surfaces, 30 after-only.
`dark/bootstrap-recovery`, `dark/data-management`, `dark/game-detail`, `dark/game-intro`, `dark/games`, `dark/home`, `dark/profile`, `dark/progress`, `dark/progress-activity`, `dark/progress-detail`, `dark/progress-domain`, `dark/progress-game`, `dark/results`, `dark/rewards`, `dark/storage-unavailable`, `light/bootstrap-recovery`, `light/data-management`, `light/game-detail`, `light/game-intro`, `light/games`, `light/home`, `light/profile`, `light/progress`, `light/progress-activity`, `light/progress-detail`, `light/progress-domain`, `light/progress-game`, `light/results`, `light/rewards`, `light/storage-unavailable`.

**All unconfirmed route slots:**

| Profile | Declared capture slot | Surface | Status |
| --- | --- | --- | --- |
| compact | dark | `bootstrap-recovery` | AFTER-ONLY |
| compact | dark | `data-management` | AFTER-ONLY |
| compact | dark | `game-detail` | AFTER-ONLY |
| compact | dark | `game-intro` | AFTER-ONLY |
| compact | dark | `games` | AFTER-ONLY |
| compact | dark | `home` | AFTER-ONLY |
| compact | dark | `profile` | AFTER-ONLY |
| compact | dark | `progress` | AFTER-ONLY |
| compact | dark | `progress-activity` | AFTER-ONLY |
| compact | dark | `progress-detail` | AFTER-ONLY |
| compact | dark | `progress-domain` | AFTER-ONLY |
| compact | dark | `progress-game` | AFTER-ONLY |
| compact | dark | `results` | AFTER-ONLY |
| compact | dark | `rewards` | AFTER-ONLY |
| compact | dark | `storage-unavailable` | AFTER-ONLY |
| compact | light | `bootstrap-recovery` | AFTER-ONLY |
| compact | light | `data-management` | AFTER-ONLY |
| compact | light | `game-detail` | AFTER-ONLY |
| compact | light | `game-intro` | AFTER-ONLY |
| compact | light | `games` | AFTER-ONLY |
| compact | light | `home` | AFTER-ONLY |
| compact | light | `profile` | AFTER-ONLY |
| compact | light | `progress` | AFTER-ONLY |
| compact | light | `progress-activity` | AFTER-ONLY |
| compact | light | `progress-detail` | AFTER-ONLY |
| compact | light | `progress-domain` | AFTER-ONLY |
| compact | light | `progress-game` | AFTER-ONLY |
| compact | light | `results` | AFTER-ONLY |
| compact | light | `rewards` | AFTER-ONLY |
| compact | light | `storage-unavailable` | AFTER-ONLY |
| default | dark | `bootstrap-recovery` | AFTER-ONLY |
| default | dark | `data-management` | THEME-UNKNOWN |
| default | dark | `game-detail` | THEME-UNKNOWN |
| default | dark | `game-intro` | THEME-UNKNOWN |
| default | dark | `games` | THEME-UNKNOWN |
| default | dark | `home` | THEME-UNKNOWN |
| default | dark | `profile` | THEME-UNKNOWN |
| default | dark | `progress` | THEME-UNKNOWN |
| default | dark | `progress-activity` | AFTER-ONLY |
| default | dark | `progress-detail` | AFTER-ONLY |
| default | dark | `progress-domain` | AFTER-ONLY |
| default | dark | `progress-game` | AFTER-ONLY |
| default | dark | `results` | AFTER-ONLY |
| default | dark | `rewards` | THEME-UNKNOWN |
| default | dark | `storage-unavailable` | AFTER-ONLY |
| default | light | `bootstrap-recovery` | AFTER-ONLY |
| default | light | `data-management` | THEME-UNKNOWN |
| default | light | `game-detail` | THEME-UNKNOWN |
| default | light | `game-intro` | THEME-UNKNOWN |
| default | light | `games` | THEME-UNKNOWN |
| default | light | `home` | THEME-UNKNOWN |
| default | light | `profile` | THEME-UNKNOWN |
| default | light | `progress` | THEME-UNKNOWN |
| default | light | `progress-activity` | AFTER-ONLY |
| default | light | `progress-detail` | AFTER-ONLY |
| default | light | `progress-domain` | AFTER-ONLY |
| default | light | `progress-game` | AFTER-ONLY |
| default | light | `results` | AFTER-ONLY |
| default | light | `rewards` | THEME-UNKNOWN |
| default | light | `storage-unavailable` | AFTER-ONLY |
| fs2 | dark | `bootstrap-recovery` | AFTER-ONLY |
| fs2 | dark | `data-management` | AFTER-ONLY |
| fs2 | dark | `game-detail` | AFTER-ONLY |
| fs2 | dark | `game-intro` | AFTER-ONLY |
| fs2 | dark | `games` | AFTER-ONLY |
| fs2 | dark | `home` | AFTER-ONLY |
| fs2 | dark | `profile` | AFTER-ONLY |
| fs2 | dark | `progress` | AFTER-ONLY |
| fs2 | dark | `progress-activity` | AFTER-ONLY |
| fs2 | dark | `progress-detail` | AFTER-ONLY |
| fs2 | dark | `progress-domain` | AFTER-ONLY |
| fs2 | dark | `progress-game` | AFTER-ONLY |
| fs2 | dark | `results` | AFTER-ONLY |
| fs2 | dark | `rewards` | AFTER-ONLY |
| fs2 | dark | `storage-unavailable` | AFTER-ONLY |
| fs2 | light | `bootstrap-recovery` | AFTER-ONLY |
| fs2 | light | `data-management` | AFTER-ONLY |
| fs2 | light | `game-detail` | AFTER-ONLY |
| fs2 | light | `game-intro` | THEME-UNKNOWN |
| fs2 | light | `games` | AFTER-ONLY |
| fs2 | light | `home` | THEME-UNKNOWN |
| fs2 | light | `profile` | THEME-UNKNOWN |
| fs2 | light | `progress` | THEME-UNKNOWN |
| fs2 | light | `progress-activity` | AFTER-ONLY |
| fs2 | light | `progress-detail` | AFTER-ONLY |
| fs2 | light | `progress-domain` | AFTER-ONLY |
| fs2 | light | `progress-game` | AFTER-ONLY |
| fs2 | light | `results` | AFTER-ONLY |
| fs2 | light | `rewards` | AFTER-ONLY |
| fs2 | light | `storage-unavailable` | AFTER-ONLY |

**All unconfirmed game results:**

| Game | Status | Reason |
| --- | --- | --- |
| `attention-odd-one-out/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `attention-sustained-vigilance/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `attention-symbol-tracker/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `attention-target-count/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `attention-visual-search/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `flexibility-card-sort/result` | BEFORE-SURFACE-DIFFERS | only a workout-leg before result exists; its workout chrome is a different surface |
| `flexibility-color-stroop/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `flexibility-cue-shift/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `flexibility-rule-flip/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `flexibility-task-switch/result` | BEFORE-SURFACE-DIFFERS | only a workout-leg before result exists; its workout chrome is a different surface |
| `language-context-fit/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `language-sentence-builder/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `language-word-chain/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `language-word-match/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `language-word-scramble/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `logic-code-cracker/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `logic-deduction-table/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `logic-next-sequence/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `logic-order-path/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `logic-rule-grid/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `math-equation-builder/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `math-fast-math/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `math-missing-operator/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `math-number-line-estimation/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `math-value-ordering/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `memory-grid-recall/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `memory-pair-recall/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `memory-pattern-tap-back/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `memory-prospective-cue/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `memory-running-order/result` | BEFORE-SURFACE-DIFFERS | only a workout-leg before result exists; its workout chrome is a different surface |
| `memory-sequence-memory/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `memory/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `spatial-coordinate-turn/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `spatial-fold-match/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `spatial-grid-nav/result` | BEFORE-SURFACE-DIFFERS | only a workout-leg before result exists; its workout chrome is a different surface |
| `spatial-mental-rotation/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `spatial-transform-match/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `speed-color-match/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `speed-order-sweep/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `speed-quick-compare/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `speed-reaction-time/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |
| `speed-tap-rush/result` | THEME-UNKNOWN | observed app theme is unverified on one or both frames |

Complete references and hashes: `matched-gallery.json`, `coverage-matrix.json`, `image-themes.json` and `matched-image-index.md`.

## 5. Existing accessibility measurements

These are historical after-only measurements on the route-matrix APK, not matched comparisons or new certification. Counts below come from the six audit files; occluded nodes remain excluded.

| Profile | Surfaces | Interactive | Labelled | Undersized | Unlabelled | Occluded | Violations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| compact-dark | 15 | 73 | 73 | 0 | 0 | 5 | 0 |
| compact-light | 15 | 73 | 73 | 0 | 0 | 5 | 0 |
| default-dark | 15 | 64 | 64 | 0 | 0 | 6 | 0 |
| default-light | 15 | 64 | 64 | 0 | 0 | 6 | 0 |
| fs2-dark | 15 | 53 | 53 | 0 | 0 | 5 | 0 |
| fs2-light | 15 | 53 | 53 | 0 | 0 | 5 | 0 |

The existing 42-game review and nine-journey certification records are unchanged and were not repeated. This cleanup does not certify clipping, contrast, hidden actions or beta readiness.

## 6. Decision record and remaining owner decision

- [Three-direction scorecard](proto-scorecard.md): Pocket Console 8.45, Training Studio 8.63, Puzzle Index 7.63; historical prototype decision.
- [Reference lock](REFERENCE_LOCK.md): selected Training Studio direction; historical design record.

Before a limited Android beta, the owner must authorize resolving the remaining 14.3 evidence requirements, or explicitly accept that documented visual evidence debt for the beta. Any release-verdict change needs separate authorization. No waiver, new baseline comparison or publication approval is inferred here.
Historical/terminal capture acquisition remains outside this cleanup; observed-theme gaps must first be resolved before choosing any further comparisons.

## 7. Reproducibility

Run the source hash verifier, tutorial verifier, theme analysis, final-gallery generator, coverage generator, report publisher and theme/ledger validators in that order. All read existing artifacts; the tutorial verifier preserves the original digests. No device connection is needed.
