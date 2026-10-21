# Coverage reclassification — historical Campaign 080 evidence through contract 2.0

Generated: 2026-10-21T15:38:23.877Z  •  Contract: coverage-contract/2.0  •  Tool: scripts/qa/reclassify-historical.mjs

This is **historical reclassification**, not fresh runtime execution. The
original Campaign 080 ledgers are preserved byte-for-byte (see table) and were
NOT edited. Every figure below is derived from the evidence those ledgers
actually contain.

## 1. Original evidence preserved

| Source | Backup | Bytes | SHA-256 |
|---|---|---|---|
| `scripts/qa/native-coverage-ledger.json` | `scripts/qa/historical/080/original-native-coverage-ledger.json` | 346507 | `24083d3b1845cdb0406ab116a03413710f861cbd04b223e35103316bbe3a32b4` |
| `qa-artifacts/080/sweep-pass2.json` | `scripts/qa/historical/080/original-sweep-pass2.json` | 80483 | `69c5276454be6136851e770e810b29851a0cbda21f559b69b9f9d3c889ecb7d9` |

## 2. Original reported coverage (v1, unchanged)

- Claims: 14 at L1, 37 at L2, 1 at L3 (v1 definitions; v1 awarded L2 for attempted taps/Start presses — F-080-001).
- Runs replayed: 52 (native-coverage-ledger.json, sweep-pass2.json).

## 3. Corrected verdict for the historical runs

- **Certified level: L0 for every historical run.** The v1 ledger recorded no
  commit SHA, no APK hash, no package version and no device serial, and bound
  no action to before/after observations. Under contract 2.0 provenance
  (F-080-005) and transition proof (F-080-004) that evidence cannot certify a
  level. It is retained as historical observation, not discarded.
- **Evidence depth** (what the recorded control inventories would prove with
  complete provenance): 0 L1-depth, 0 L2-depth, 0 L3-depth, 52 below L1-depth.
- Every v1 L2/L3 claim that does not survive as equal-or-greater depth is a
  **downgrade**, itemized below.

## 4. Downgraded games (claimed level -> corrected depth) with explanations

| Game | Claimed | Depth | Why the claim does not hold |
|---|---|---|---|
| `attention-odd-one-out` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `attention-sustained-vigilance` | L3 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `attention-symbol-tracker` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `attention-target-count` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `attention-visual-search` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `flexibility-card-sort` | L1 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `flexibility-color-stroop` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `flexibility-cue-shift` | L1 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `flexibility-rule-flip` | L1 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `flexibility-task-switch` | L1 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `language-context-fit` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `language-sentence-builder` | L1 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `language-word-chain` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `language-word-match` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `language-word-scramble` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `logic-code-cracker` | L1 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `logic-deduction-table` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `logic-next-sequence` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `logic-order-path` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `logic-rule-grid` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `math-equation-builder` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `math-fast-math` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `math-missing-operator` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `math-number-line-estimation` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `math-value-ordering` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `memory` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `memory-grid-recall` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `memory-pair-recall` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `memory-pattern-tap-back` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `memory-prospective-cue` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `memory-running-order` | L1 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `memory-sequence-memory` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `spatial-coordinate-turn` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `spatial-fold-match` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `spatial-grid-nav` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `spatial-mental-rotation` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `spatial-transform-match` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `speed-color-match` | L1 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `speed-order-sweep` | L1 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `speed-quick-compare` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `speed-reaction-time` | L1 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `speed-tap-rush` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `flexibility-card-sort` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `flexibility-cue-shift` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `flexibility-rule-flip` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `flexibility-task-switch` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `language-sentence-builder` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `logic-code-cracker` | L1 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `memory-running-order` | L1 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `speed-color-match` | L1 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `speed-order-sweep` | L2 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |
| `speed-reaction-time` | L1 | L0 | smoke INCOMPLETE: safe exit not verified — L1 requires a proven post-exit destination |

## 5. Full per-game reclassification

Axis legend: V=VERIFIED, O=OBSERVED, A=ATTEMPTED, F=FAILED, NE=NOT EXECUTED.
Axes are what the historical dumps actually contain; the certified level is
nevertheless L0 because provenance and transition binding are missing.

| Game | v1 claimed | v1 result | Depth | Play | InputOK | Feedback | RoundAdv | SessEnd | Results | SafeExit | Blocking evidence gap |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `attention-odd-one-out` | L2 | PASS | L0 | VERIFIED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ATTEMPTED | NOT EXECUTED | FAILED | safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `attention-sustained-vigilance` | L3 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | FAILED | Start only, no gameplay input; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `attention-symbol-tracker` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `attention-target-count` | L2 | PASS | L0 | VERIFIED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ATTEMPTED | NOT EXECUTED | FAILED | safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `attention-visual-search` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; tap issued, no application response; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `flexibility-card-sort` | L1 | SMOKE_ONLY | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; safe exit claimed without destination proof (F-080-002) |
| `flexibility-color-stroop` | L2 | PASS | L0 | VERIFIED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ATTEMPTED | NOT EXECUTED | FAILED | Start only, no gameplay input; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `flexibility-cue-shift` | L1 | SMOKE_ONLY | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; safe exit claimed without destination proof (F-080-002) |
| `flexibility-rule-flip` | L1 | SMOKE_ONLY | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; safe exit claimed without destination proof (F-080-002) |
| `flexibility-task-switch` | L1 | SMOKE_ONLY | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; safe exit claimed without destination proof (F-080-002) |
| `language-context-fit` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; tap issued, no application response; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `language-sentence-builder` | L1 | SMOKE_ONLY | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; safe exit claimed without destination proof (F-080-002) |
| `language-word-chain` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; tap issued, no application response; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `language-word-match` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; tap issued, no application response; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `language-word-scramble` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; tap issued, no application response; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `logic-code-cracker` | L1 | SMOKE_ONLY | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; safe exit claimed without destination proof (F-080-002) |
| `logic-deduction-table` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; tap issued, no application response; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `logic-next-sequence` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; tap issued, no application response; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `logic-order-path` | L2 | PASS | L0 | VERIFIED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ATTEMPTED | NOT EXECUTED | FAILED | safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `logic-rule-grid` | L2 | PASS | L0 | VERIFIED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ATTEMPTED | NOT EXECUTED | FAILED | safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `math-equation-builder` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; tap issued, no application response; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `math-fast-math` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; tap issued, no application response; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `math-missing-operator` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; tap issued, no application response; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `math-number-line-estimation` | L2 | PASS | L0 | VERIFIED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ATTEMPTED | NOT EXECUTED | FAILED | safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `math-value-ordering` | L2 | PASS | L0 | VERIFIED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ATTEMPTED | NOT EXECUTED | FAILED | safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `memory` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `memory-grid-recall` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `memory-pair-recall` | L2 | PASS | L0 | VERIFIED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ATTEMPTED | NOT EXECUTED | FAILED | Start only, no gameplay input; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `memory-pattern-tap-back` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; tap issued, no application response; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `memory-prospective-cue` | L2 | PASS | L0 | VERIFIED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ATTEMPTED | NOT EXECUTED | FAILED | Start only, no gameplay input; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `memory-running-order` | L1 | SMOKE_ONLY | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; safe exit claimed without destination proof (F-080-002) |
| `memory-sequence-memory` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `spatial-coordinate-turn` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; tap issued, no application response; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `spatial-fold-match` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `spatial-grid-nav` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; tap issued, no application response; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `spatial-mental-rotation` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; tap issued, no application response; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `spatial-transform-match` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; tap issued, no application response; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `speed-color-match` | L1 | SMOKE_ONLY | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; safe exit claimed without destination proof (F-080-002) |
| `speed-order-sweep` | L1 | SMOKE_ONLY | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; safe exit claimed without destination proof (F-080-002) |
| `speed-quick-compare` | L2 | PASS | L0 | VERIFIED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | ATTEMPTED | NOT EXECUTED | FAILED | safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `speed-reaction-time` | L1 | SMOKE_ONLY | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; safe exit claimed without destination proof (F-080-002) |
| `speed-tap-rush` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; tap issued, no application response; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `flexibility-card-sort` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; tap issued, no application response; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `flexibility-cue-shift` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; tap issued, no application response; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `flexibility-rule-flip` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `flexibility-task-switch` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; tap issued, no application response; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `language-sentence-builder` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; tap issued, no application response; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `logic-code-cracker` | L1 | SMOKE_ONLY | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; safe exit claimed without destination proof (F-080-002) |
| `memory-running-order` | L1 | SMOKE_ONLY | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; safe exit claimed without destination proof (F-080-002) |
| `speed-color-match` | L1 | SMOKE_ONLY | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; safe exit claimed without destination proof (F-080-002) |
| `speed-order-sweep` | L2 | PASS | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; tap issued, no application response; safe exit claimed without destination proof (F-080-002); v1 PASS not substantiated (F-080-001) |
| `speed-reaction-time` | L1 | SMOKE_ONLY | L0 | ATTEMPTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | FAILED | tutorial never cleared; safe exit claimed without destination proof (F-080-002) |

## 6. Contract defects this replay demonstrates

- **F-080-001** — v1 `classifyLevel` awarded L2 on `inputSubmitted || started`,
  so tutorial-side taps and Start presses produced L2 PASS. Under contract 2.0
  those are ATTEMPTED actions with no accepted gameplay transition.
- **F-080-002** — v1 set `safeExit = true` unconditionally after sending Back.
  No historical run contains a post-exit observation, so no historical run can
  certify L1 complete smoke.
- **F-080-003** — the v1 merger spread milestone objects instead of OR-ing;
  this replay never merges across runs (see merge-coverage.mjs 2.0 semantics).
- **F-080-004** — v1 milestones recorded actions, not outcomes.
- **F-080-005** — no build/APK/device binding exists for any historical run.

Fresh runtime execution (schema-2 ledgers from the corrected sweep harness)
is the authoritative coverage source; this replay exists to keep the historical
record honest and to quantify exactly how far the v1 claims overreached.
