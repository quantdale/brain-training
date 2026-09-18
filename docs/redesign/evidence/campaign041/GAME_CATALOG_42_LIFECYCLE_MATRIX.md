# 42-Game Lifecycle Matrix

## Method and interpretation

`[OBSERVED_RUNTIME]` Each current generated registry ID was deep-linked to Game Detail, launched through the current Game route, and inspected at its first interactive state on the dedicated Android emulator. Dev-only tutorial skip was used where necessary to keep the sweep bounded. The first detector reported 39/42 interactive because three games use non-generic control semantics; live hierarchy and current source inspection identified their real controls and corrected that **first-interactive detector** classification. The retained result-completion log is stricter and reports only 39/42 full result lifecycles. The packet does not promote 42/42 first-start evidence into 42/42 result/persistence evidence.

The table’s `First interactive` column means registry resolution → detail → route → first interactive state. `Result` means the retained sweep reached a result screen using the deterministic QA control. `Mechanic` is intentionally not claimed by this sweep; mechanic-specific automated tests and the eight-family real interaction evidence are separate.

| # | Registered game ID | Domain | First interactive | Result in retained sweep | Mechanic evidence in this sweep |
|---:|---|---|---|---|
| 1 | `attention-odd-one-out` | Attention | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 2 | `attention-sustained-vigilance` | Attention | PASS | PASS | Lifecycle only; explicit controls `.go-button`, `.pause`, `.stage`, `.stimulus-digit`, `.trial.28`, `.verdict` verified |
| 3 | `attention-symbol-tracker` | Attention | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 4 | `attention-target-count` | Attention | PASS | PASS | Lifecycle only; real family interaction separately captured |
| 5 | `attention-visual-search` | Attention | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 6 | `flexibility-card-sort` | Flexibility | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 7 | `flexibility-color-stroop` | Flexibility | PASS | PASS | Lifecycle only; real family interaction separately captured |
| 8 | `flexibility-cue-shift` | Flexibility | PASS | PASS | Lifecycle only; workout path separately completed |
| 9 | `flexibility-rule-flip` | Flexibility | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 10 | `flexibility-task-switch` | Flexibility | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 11 | `language-context-fit` | Language | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 12 | `language-sentence-builder` | Language | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 13 | `language-word-chain` | Language | PASS | PASS | Lifecycle only; real family interaction and workout path separately completed |
| 14 | `language-word-match` | Language | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 15 | `language-word-scramble` | Language | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 16 | `logic-code-cracker` | Logic | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 17 | `logic-deduction-table` | Logic | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 18 | `logic-next-sequence` | Logic | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 19 | `logic-order-path` | Logic | PASS | PASS | Lifecycle only; real family interaction and workout path separately completed |
| 20 | `logic-rule-grid` | Logic | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 21 | `math-equation-builder` | Math | PASS | **NOT REACHED** | Board and explicit controls `.equation`, `.equation-display`, `.number-pad`, `.pause`, `.round.1`, `.target`, `.timer` were verified; retained sweep did not reach result. |
| 22 | `math-fast-math` | Math | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 23 | `math-missing-operator` | Math | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 24 | `math-number-line-estimation` | Math | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 25 | `math-value-ordering` | Math | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 26 | `memory` | Memory | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 27 | `memory-grid-recall` | Memory | PASS | PASS | Lifecycle only; real family interaction separately captured |
| 28 | `memory-pair-recall` | Memory | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 29 | `memory-pattern-tap-back` | Memory | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 30 | `memory-prospective-cue` | Memory | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 31 | `memory-running-order` | Memory | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 32 | `memory-sequence-memory` | Memory | PASS | **NOT REACHED** | Board reached, but retained sweep did not reach result. |
| 33 | `spatial-coordinate-turn` | Spatial | PASS | **NOT REACHED** | Board reached, but retained sweep did not reach result. |
| 34 | `spatial-fold-match` | Spatial | PASS | PASS | Lifecycle only; real family interaction separately captured |
| 35 | `spatial-grid-nav` | Spatial | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 36 | `spatial-mental-rotation` | Spatial | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 37 | `spatial-transform-match` | Spatial | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 38 | `speed-color-match` | Speed | PASS | PASS | Lifecycle only; explicit controls `.color-btn.*`, `.color-grid`, `.current-swatch`, `.pause`, `.trial.1`, `.trial-status` verified |
| 39 | `speed-order-sweep` | Speed | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 40 | `speed-quick-compare` | Speed | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 41 | `speed-reaction-time` | Speed | PASS | PASS | Lifecycle only; shared/automated coverage separate |
| 42 | `speed-tap-rush` | Speed | PASS | PASS | Lifecycle only; shared/automated coverage separate |

## Aggregate result

| Measure | Result |
|---|---:|
| Registry IDs | 42/42 |
| Game Detail routes | 42/42 |
| Standalone first routes | 42/42 |
| Actual game starts / first interactive | 42/42 |
| Result-complete retained sweep | 39/42 |
| Generic detector initial result | 39/42 first-interactive; three detector misses corrected by explicit live hierarchy/source checks |
| Fatal route/invariant errors | 0 observed in sweep |
| Real mechanic families exercised separately | 8/8 |

`[VERIFIED_TEST]` Registry/catalog/SDK/workout lifecycle suites supplied the automated side of this result. `[OBSERVED_RUNTIME]` supplied current native first-interactive and retained result evidence. The three `NOT REACHED` results are an explicit current gap; they are not silently relabeled as success. This document does not equate registry membership or a force-win completion with mechanic correctness.
