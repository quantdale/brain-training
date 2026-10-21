# Native 42-game coverage matrix — Campaign 080

Generated: 2026-10-21T08:23:43.971Z  •  Device: Android SDK built for x86_64 (x86_64, Physical size: 1080x1920, Physical density: 420dpi)  •  Renderer: SwiftShader (emulator software rendering)
Build: installed production build (com.braintraining.app)

Coverage is **native runtime execution** on a live Android emulator via the
deterministic sweep harness (`scripts/qa/native-game-sweep.mjs`), not source-level
tests. Each row records the deepest level actually reached; a lower level is
never reported as a higher one.

**Totals:** 42 registered games swept — **4 at Level 1 (native smoke)**, **37 at Level 2 (native interaction)**, **1 at Level 3 (full lifecycle)**, **0 at Level 4**. All 42 reached at least native smoke.

## Level definitions

- **L1 native smoke** — launch, routing, identity, controls render, safe exit.
- **L2 native interaction** — a valid/invalid input submitted; feedback or round-advance observed.
- **L3 full lifecycle** — a whole session ended (win **or** fail) with final results shown.
- **L4 resilience** — background/relaunch, interruption, a11y profiles, offline.

## Per-game matrix

| Game id | Name | Domain | Level | Result | Tut | Input | Feedback | RoundAdv | SessionEnd | Results |
|---|---|---|---|---|---|---|---|---|---|---|
| `attention-odd-one-out` | Odd One Out | Attention | L2 | PASS | — | Y | Y | — | — | — |
| `attention-sustained-vigilance` | Signal Watch | Attention | L3 | PASS | Y | — | — | — | Y | Y |
| `attention-symbol-tracker` | Symbol Tracker | Attention | L2 | PASS | Y | Y | Y | — | — | — |
| `attention-target-count` | Target Count | Attention | L2 | PASS | Y | Y | Y | — | — | — |
| `attention-visual-search` | Visual Search | Attention | L2 | PASS | Y | Y | — | — | — | — |
| `flexibility-card-sort` | Card Sort | Flexibility | L2 | PASS | Y | Y | — | — | — | — |
| `flexibility-color-stroop` | Color Stroop | Flexibility | L2 | PASS | Y | — | Y | — | — | — |
| `flexibility-cue-shift` | Cue Shift | Flexibility | L2 | PASS | Y | Y | — | — | — | — |
| `flexibility-rule-flip` | Rule Flip | Flexibility | L2 | PASS | Y | Y | Y | — | — | — |
| `flexibility-task-switch` | Task Switch | Flexibility | L2 | PASS | Y | Y | — | — | — | — |
| `language-context-fit` | Context Fit | Language | L2 | PASS | Y | Y | — | — | — | — |
| `language-sentence-builder` | Sentence Builder | Language | L2 | PASS | Y | Y | — | — | — | — |
| `language-word-chain` | Word Chain | Language | L2 | PASS | Y | Y | — | — | — | — |
| `language-word-match` | Word Match | Language | L2 | PASS | Y | Y | — | — | — | — |
| `language-word-scramble` | Word Scramble | Language | L2 | PASS | Y | Y | — | — | — | — |
| `logic-code-cracker` | Code Cracker | Logic & Problem Solving | L1 | SMOKE_ONLY | Y | — | — | — | — | — |
| `logic-deduction-table` | Deduction Table | Logic & Problem Solving | L2 | PASS | Y | Y | — | — | — | — |
| `logic-next-sequence` | Next in Sequence | Logic & Problem Solving | L2 | PASS | Y | Y | — | — | — | — |
| `logic-order-path` | Order Path | Logic & Problem Solving | L2 | PASS | — | Y | Y | Y | — | — |
| `logic-rule-grid` | Rule Grid | Logic & Problem Solving | L2 | PASS | Y | Y | Y | — | — | — |
| `math-equation-builder` | Equation Builder | Math | L2 | PASS | Y | Y | — | — | — | — |
| `math-fast-math` | Fast Math | Math | L2 | PASS | Y | Y | — | — | — | — |
| `math-missing-operator` | Missing Operator | Math | L2 | PASS | Y | Y | — | — | — | — |
| `math-number-line-estimation` | Number Line | Math | L2 | PASS | Y | Y | Y | — | — | — |
| `math-value-ordering` | Value Order | Math | L2 | PASS | Y | Y | Y | — | — | — |
| `memory` | Memory | Memory | L2 | PASS | Y | Y | Y | — | — | — |
| `memory-grid-recall` | Grid Recall | Memory | L2 | PASS | Y | Y | Y | — | — | — |
| `memory-pair-recall` | Pair Recall | Memory | L2 | PASS | Y | — | — | — | — | — |
| `memory-pattern-tap-back` | Pattern Tap Back | Memory | L2 | PASS | Y | Y | — | — | — | — |
| `memory-prospective-cue` | Cue Keeper | Memory | L2 | PASS | Y | — | — | — | — | — |
| `memory-running-order` | Running Order | Memory | L1 | SMOKE_ONLY | Y | — | — | — | — | — |
| `memory-sequence-memory` | Sequence Memory | Memory | L2 | PASS | Y | Y | Y | — | — | — |
| `spatial-coordinate-turn` | Coordinate Turn | Spatial | L2 | PASS | Y | Y | — | — | — | — |
| `spatial-fold-match` | Fold Match | Spatial | L2 | PASS | Y | Y | Y | — | — | — |
| `spatial-grid-nav` | Grid Navigator | Spatial | L2 | PASS | Y | Y | — | — | — | — |
| `spatial-mental-rotation` | Mental Rotation | Spatial | L2 | PASS | Y | Y | — | — | — | — |
| `spatial-transform-match` | Transform Match | Spatial | L2 | PASS | Y | Y | — | — | — | — |
| `speed-color-match` | Color Match | Speed | L1 | SMOKE_ONLY | Y | — | — | — | — | — |
| `speed-order-sweep` | Order Sweep | Speed | L2 | PASS | Y | Y | — | — | — | — |
| `speed-quick-compare` | Quick Compare | Speed | L2 | PASS | Y | Y | Y | — | — | — |
| `speed-reaction-time` | Reaction Time | Speed | L1 | SMOKE_ONLY | Y | — | — | — | — | — |
| `speed-tap-rush` | Tap Rush | Speed | L2 | PASS | Y | Y | — | — | — | — |

## Coverage gaps (honest)

- **Level 3 (full lifecycle)** was reached on 1 game(s). Reaching L3 requires driving a complete multi-round session to a final results screen; the deterministic tap driver reliably completes some session shapes but not all. Games at L2 exercised real input + feedback/round progression but did not complete a full session this run. Persistence, replay, and pause/resume/quit depth are verified separately in the gameplay-regression stream, not implied by this table.
- **4 game(s) remain at L1** (see `result: SMOKE_ONLY`): these use timed-stimulus or keypad input shapes the generic tap driver cannot yet complete deterministically. Exact untested behavior is recorded per game in the merged ledger's `remainingGap` field.
- Scoring **correctness** (whether a submitted answer was genuinely correct/incorrect under each game's rules) is verified on a representative subset in the gameplay-regression stream; this matrix establishes interaction + feedback, not per-answer scoring truth.

Artifacts (screenshots + UI hierarchy) per game: `qa-artifacts/080/sweep/<game-id>/` (gitignored runtime evidence; hashes recorded in the merged ledger).
