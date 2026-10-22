# Native 42-game coverage matrix — Campaign 080 (contract 2.0)

Generated: 2026-10-22T02:23:35.338Z  •  Contract: coverage-contract/2.0  •  Inputs: native-coverage-ledger-v2.json (42 runs, runtime)

This matrix is produced by the corrected evidence contract. **Certified level**
is the deepest level proven by ONE coherent execution attempt. The per-axis
columns are a **union of observations across runs** and never imply one
continuous session. Cell legend: V=VERIFIED, O=OBSERVED, A=ATTEMPTED,
F=FAILED, B=BLOCKED, NE=NOT EXECUTED.

**Totals (certified, single-run proven):** 42 games — L1 8, L2 6, L3 4, L4 0, below-L1 24. Runs: 42 (42 valid / 0 invalid).

## Level definitions (contract 2.0)

- **L0** — no proven native smoke (or smoke INCOMPLETE: e.g. safe exit never verified).
- **L1** — verified native smoke: intended game launched, identity verified, correct screen rendered, entry controls present, safe exit ATTEMPTED **and its post-exit destination confirmed**.
- **L2** — verified actual gameplay interaction: game entry + tutorial completion where required + positively identified active gameplay + a real input ACCEPTED (or a defined input-independent gameplay event for passive/timed games) + observable feedback/progression. A Start press or tutorial demonstration never qualifies.
- **L3** — verified full-session lifecycle: actual gameplay entered, complete session reaches a legitimate terminal state, final results rendered AND attributable to the current session. Passive timeout completion is distinguished from answer-driven play.
- **L4** — verified resilience scenario (background/relaunch, interruption/recovery, offline continuity, accessibility profile, responsive transition), reported as independent subcapabilities.

## Per-game matrix

| Game id | Certified | Status | Proven by run | Runs | Launch | Render | TutDone | Play | InputOK | Feedback | RoundAdv | Passive | SessEnd | Results | SafeExit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `attention-odd-one-out` | L3 | VERIFIED | `sweep-2026-10-22T011659713Z--attention-odd-one-out` | 1 | V | V | NE | V | V | NE | NE | NE | V | V | V |
| `attention-sustained-vigilance` | L1 | VERIFIED | `sweep-2026-10-22T011838807Z--attention-sustained-vigilance` | 1 | V | V | NE | A | NE | NE | NE | NE | NE | F | V |
| `attention-symbol-tracker` | L0 | PARTIAL | `sweep-2026-10-22T011943836Z--attention-symbol-tracker` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |
| `attention-target-count` | L1 | VERIFIED | `sweep-2026-10-22T012135856Z--attention-target-count` | 1 | V | V | NE | V | V | NE | NE | V | NE | NE | V |
| `attention-visual-search` | L3 | VERIFIED | `sweep-2026-10-22T012240460Z--attention-visual-search` | 1 | V | V | NE | V | V | NE | V | NE | V | V | V |
| `flexibility-card-sort` | L0 | PARTIAL | `sweep-2026-10-22T012400753Z--flexibility-card-sort` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |
| `flexibility-color-stroop` | L1 | VERIFIED | `sweep-2026-10-22T012528044Z--flexibility-color-stroop` | 1 | V | V | NE | V | V | NE | NE | NE | NE | NE | V |
| `flexibility-cue-shift` | L0 | PARTIAL | `sweep-2026-10-22T012633092Z--flexibility-cue-shift` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |
| `flexibility-rule-flip` | L0 | PARTIAL | `sweep-2026-10-22T012757815Z--flexibility-rule-flip` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |
| `flexibility-task-switch` | L2 | VERIFIED | `sweep-2026-10-22T012949053Z--flexibility-task-switch` | 1 | V | V | NE | V | V | V | V | NE | NE | NE | V |
| `language-context-fit` | L0 | PARTIAL | `sweep-2026-10-22T013053514Z--language-context-fit` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |
| `language-sentence-builder` | L0 | PARTIAL | `sweep-2026-10-22T013245364Z--language-sentence-builder` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |
| `language-word-chain` | L2 | VERIFIED | `sweep-2026-10-22T013448200Z--language-word-chain` | 1 | V | V | NE | V | V | NE | V | V | NE | NE | NE |
| `language-word-match` | L0 | PARTIAL | `sweep-2026-10-22T013547081Z--language-word-match` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |
| `language-word-scramble` | L0 | PARTIAL | `sweep-2026-10-22T013744165Z--language-word-scramble` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |
| `logic-code-cracker` | L0 | PARTIAL | `sweep-2026-10-22T013936036Z--logic-code-cracker` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |
| `logic-deduction-table` | L0 | PARTIAL | `sweep-2026-10-22T014128091Z--logic-deduction-table` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |
| `logic-next-sequence` | L1 | VERIFIED | `sweep-2026-10-22T014321005Z--logic-next-sequence` | 1 | V | V | NE | V | V | NE | NE | NE | NE | NE | V |
| `logic-order-path` | L2 | VERIFIED | `sweep-2026-10-22T014435837Z--logic-order-path` | 1 | V | V | NE | V | V | V | NE | NE | NE | NE | NE |
| `logic-rule-grid` | L1 | VERIFIED | `sweep-2026-10-22T014534525Z--logic-rule-grid` | 1 | V | V | NE | V | V | NE | NE | V | NE | NE | V |
| `math-equation-builder` | L0 | PARTIAL | `sweep-2026-10-22T014639673Z--math-equation-builder` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |
| `math-fast-math` | L0 | PARTIAL | `sweep-2026-10-22T014830614Z--math-fast-math` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |
| `math-missing-operator` | L0 | PARTIAL | `sweep-2026-10-22T015021424Z--math-missing-operator` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |
| `math-number-line-estimation` | L1 | VERIFIED | `sweep-2026-10-22T015212112Z--math-number-line-estimation` | 1 | V | V | NE | A | V | NE | V | V | V | V | V |
| `math-value-ordering` | L0 | PARTIAL | `sweep-2026-10-22T015439048Z--math-value-ordering` | 1 | V | V | NE | V | V | NE | NE | NE | NE | NE | NE |
| `memory` | L0 | PARTIAL | `sweep-2026-10-22T015546845Z--memory` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |
| `memory-grid-recall` | L0 | PARTIAL | `sweep-2026-10-22T015738505Z--memory-grid-recall` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |
| `memory-pair-recall` | L2 | VERIFIED | `sweep-2026-10-22T015930102Z--memory-pair-recall` | 1 | V | V | NE | V | V | V | V | V | NE | NE | V |
| `memory-pattern-tap-back` | L0 | PARTIAL | `sweep-2026-10-22T020037012Z--memory-pattern-tap-back` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |
| `memory-prospective-cue` | L1 | VERIFIED | `sweep-2026-10-22T020235447Z--memory-prospective-cue` | 1 | V | V | NE | V | V | NE | NE | NE | NE | NE | V |
| `memory-running-order` | L0 | PARTIAL | `sweep-2026-10-22T020339664Z--memory-running-order` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |
| `memory-sequence-memory` | L0 | PARTIAL | `sweep-2026-10-22T020454583Z--memory-sequence-memory` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |
| `spatial-coordinate-turn` | L2 | VERIFIED | `sweep-2026-10-22T020645332Z--spatial-coordinate-turn` | 1 | V | V | NE | V | V | V | V | NE | NE | NE | V |
| `spatial-fold-match` | L0 | PARTIAL | `sweep-2026-10-22T020810107Z--spatial-fold-match` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |
| `spatial-grid-nav` | L0 | PARTIAL | `sweep-2026-10-22T021001242Z--spatial-grid-nav` | 1 | V | V | NE | V | V | NE | NE | NE | NE | NE | NE |
| `spatial-mental-rotation` | L0 | PARTIAL | `sweep-2026-10-22T021100058Z--spatial-mental-rotation` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |
| `spatial-transform-match` | L3 | VERIFIED | `sweep-2026-10-22T021251527Z--spatial-transform-match` | 1 | V | V | NE | V | V | V | V | NE | V | V | V |
| `speed-color-match` | L1 | VERIFIED | `sweep-2026-10-22T021346568Z--speed-color-match` | 1 | V | V | NE | V | V | NE | NE | NE | NE | NE | V |
| `speed-order-sweep` | L0 | PARTIAL | `sweep-2026-10-22T021450034Z--speed-order-sweep` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |
| `speed-quick-compare` | L3 | VERIFIED | `sweep-2026-10-22T021640622Z--speed-quick-compare` | 1 | V | V | NE | V | V | V | V | NE | V | V | V |
| `speed-reaction-time` | L2 | VERIFIED | `sweep-2026-10-22T021744819Z--speed-reaction-time` | 1 | V | V | NE | V | V | NE | V | V | NE | NE | V |
| `speed-tap-rush` | L0 | PARTIAL | `sweep-2026-10-22T021850938Z--speed-tap-rush` | 1 | V | V | F | A | NE | NE | NE | NE | NE | NE | F |

## Downgrade explanations (legacy claimed level -> certified level)

_No legacy claims in these inputs._

## Coverage-validation diagnostics

_None._
