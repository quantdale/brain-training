# 42-Game Lifecycle Matrix

## Method and interpretation

`[OBSERVED_RUNTIME]` Each current generated registry ID was deep-linked to Game Detail, launched through the current Game route, and inspected at its first interactive state on the dedicated Android emulator. Dev-only tutorial skip was used where necessary to keep the sweep bounded. The first detector reported 39/42 interactive because three games use non-generic control semantics; live hierarchy and current source inspection identified their real controls and corrected the detector classification. The authoritative result is 42/42 starts, not the generic detector’s 39/42.

The table’s `Lifecycle` column means registry resolution → detail → route → first interactive state. `Mechanic` is intentionally not claimed by this sweep; mechanic-specific automated tests and the eight-family real interaction evidence are separate.

| # | Registered game ID | Domain | Lifecycle | Mechanic evidence in this sweep |
|---:|---|---|---|---|
| 1 | `attention-odd-one-out` | Attention | PASS | Lifecycle only; shared/automated coverage separate |
| 2 | `attention-sustained-vigilance` | Attention | PASS | Lifecycle only; explicit controls `.go-button`, `.pause`, `.stage`, `.stimulus-digit`, `.trial.28`, `.verdict` verified |
| 3 | `attention-symbol-tracker` | Attention | PASS | Lifecycle only; shared/automated coverage separate |
| 4 | `attention-target-count` | Attention | PASS | Lifecycle only; real family interaction separately captured |
| 5 | `attention-visual-search` | Attention | PASS | Lifecycle only; shared/automated coverage separate |
| 6 | `flexibility-card-sort` | Flexibility | PASS | Lifecycle only; shared/automated coverage separate |
| 7 | `flexibility-color-stroop` | Flexibility | PASS | Lifecycle only; real family interaction separately captured |
| 8 | `flexibility-cue-shift` | Flexibility | PASS | Lifecycle only; workout path separately completed |
| 9 | `flexibility-rule-flip` | Flexibility | PASS | Lifecycle only; shared/automated coverage separate |
| 10 | `flexibility-task-switch` | Flexibility | PASS | Lifecycle only; shared/automated coverage separate |
| 11 | `language-context-fit` | Language | PASS | Lifecycle only; shared/automated coverage separate |
| 12 | `language-sentence-builder` | Language | PASS | Lifecycle only; shared/automated coverage separate |
| 13 | `language-word-chain` | Language | PASS | Lifecycle only; real family interaction and workout path separately completed |
| 14 | `language-word-match` | Language | PASS | Lifecycle only; shared/automated coverage separate |
| 15 | `language-word-scramble` | Language | PASS | Lifecycle only; shared/automated coverage separate |
| 16 | `logic-code-cracker` | Logic | PASS | Lifecycle only; shared/automated coverage separate |
| 17 | `logic-deduction-table` | Logic | PASS | Lifecycle only; shared/automated coverage separate |
| 18 | `logic-next-sequence` | Logic | PASS | Lifecycle only; shared/automated coverage separate |
| 19 | `logic-order-path` | Logic | PASS | Lifecycle only; real family interaction and workout path separately completed |
| 20 | `logic-rule-grid` | Logic | PASS | Lifecycle only; shared/automated coverage separate |
| 21 | `math-equation-builder` | Math | PASS | Lifecycle only; explicit controls `.equation`, `.equation-display`, `.number-pad`, `.pause`, `.round.1`, `.target`, `.timer` verified |
| 22 | `math-fast-math` | Math | PASS | Lifecycle only; shared/automated coverage separate |
| 23 | `math-missing-operator` | Math | PASS | Lifecycle only; shared/automated coverage separate |
| 24 | `math-number-line-estimation` | Math | PASS | Lifecycle only; shared/automated coverage separate |
| 25 | `math-value-ordering` | Math | PASS | Lifecycle only; shared/automated coverage separate |
| 26 | `memory` | Memory | PASS | Lifecycle only; shared/automated coverage separate |
| 27 | `memory-grid-recall` | Memory | PASS | Lifecycle only; real family interaction separately captured |
| 28 | `memory-pair-recall` | Memory | PASS | Lifecycle only; shared/automated coverage separate |
| 29 | `memory-pattern-tap-back` | Memory | PASS | Lifecycle only; shared/automated coverage separate |
| 30 | `memory-prospective-cue` | Memory | PASS | Lifecycle only; shared/automated coverage separate |
| 31 | `memory-running-order` | Memory | PASS | Lifecycle only; shared/automated coverage separate |
| 32 | `memory-sequence-memory` | Memory | PASS | Lifecycle only; shared/automated coverage separate |
| 33 | `spatial-coordinate-turn` | Spatial | PASS | Lifecycle only; shared/automated coverage separate |
| 34 | `spatial-fold-match` | Spatial | PASS | Lifecycle only; real family interaction separately captured |
| 35 | `spatial-grid-nav` | Spatial | PASS | Lifecycle only; shared/automated coverage separate |
| 36 | `spatial-mental-rotation` | Spatial | PASS | Lifecycle only; shared/automated coverage separate |
| 37 | `spatial-transform-match` | Spatial | PASS | Lifecycle only; shared/automated coverage separate |
| 38 | `speed-color-match` | Speed | PASS | Lifecycle only; explicit controls `.color-btn.*`, `.color-grid`, `.current-swatch`, `.pause`, `.trial.1`, `.trial-status` verified |
| 39 | `speed-order-sweep` | Speed | PASS | Lifecycle only; shared/automated coverage separate |
| 40 | `speed-quick-compare` | Speed | PASS | Lifecycle only; shared/automated coverage separate |
| 41 | `speed-reaction-time` | Speed | PASS | Lifecycle only; shared/automated coverage separate |
| 42 | `speed-tap-rush` | Speed | PASS | Lifecycle only; shared/automated coverage separate |

## Aggregate result

| Measure | Result |
|---|---:|
| Registry IDs | 42/42 |
| Game Detail routes | 42/42 |
| Standalone first routes | 42/42 |
| Actual game starts | 42/42 |
| Generic detector initial result | 39/42; three detector misses corrected by explicit live hierarchy/source checks |
| Fatal route/invariant errors | 0 observed in sweep |
| Real mechanic families exercised separately | 8/8 |

`[VERIFIED_TEST]` Registry/catalog/SDK/workout lifecycle suites supplied the automated side of this result. `[OBSERVED_RUNTIME]` supplied current native lifecycle evidence. This document does not equate registry membership or a force-win completion with mechanic correctness.

