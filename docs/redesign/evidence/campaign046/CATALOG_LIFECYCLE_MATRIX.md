# Campaign 046 Catalog Lifecycle Matrix

The generated registry was frozen at 42 IDs from
`apps/mobile/src/registry/registry.generated.ts`. `D/S/F` means detail,
start/tutorial, and first-interactive state. `R/P/B` means terminal result,
durable persistence, and return navigation. Every row below was covered by the
catalog runner or the manual follow-up; the persisted result column is also
independently supported by the database audit.

| Domain | Game IDs | D/S/F | R/P/B | Terminal evidence class |
| --- | --- | --- | --- | --- |
| Attention (5) | `attention-odd-one-out`, `attention-sustained-vigilance`, `attention-symbol-tracker`, `attention-target-count`, `attention-visual-search` | PASS | PASS | Supported QA completion where needed |
| Flexibility (5) | `flexibility-card-sort`, `flexibility-color-stroop`, `flexibility-cue-shift`, `flexibility-rule-flip`, `flexibility-task-switch` | PASS | PASS | Supported QA completion where needed |
| Language (5) | `language-context-fit`, `language-sentence-builder`, `language-word-chain`, `language-word-match`, `language-word-scramble` | PASS | PASS | Supported QA completion where needed |
| Logic (5) | `logic-code-cracker`, `logic-deduction-table`, `logic-next-sequence`, `logic-order-path`, `logic-rule-grid` | PASS | PASS | Supported QA completion where needed |
| Math (5) | `math-equation-builder`, `math-fast-math`, `math-missing-operator`, `math-number-line-estimation`, `math-value-ordering` | PASS | PASS | Supported QA completion where needed |
| Memory (7) | `memory`, `memory-grid-recall`, `memory-pair-recall`, `memory-pattern-tap-back`, `memory-prospective-cue`, `memory-running-order`, `memory-sequence-memory` | PASS | PASS | Supported QA completion where needed; `memory` repeated |
| Spatial (5) | `spatial-coordinate-turn`, `spatial-fold-match`, `spatial-grid-nav`, `spatial-mental-rotation`, `spatial-transform-match` | PASS | PASS | Supported QA completion where needed |
| Speed (5) | `speed-color-match`, `speed-order-sweep`, `speed-quick-compare`, `speed-reaction-time`, `speed-tap-rush` | PASS | PASS | Supported QA completion where needed |

## Durable cross-check

The final pulled database contained:

- 44 `game_sessions` rows and 42 distinct `game_id` values;
- at least one completed row for every expected registry ID;
- 44 gameplay currency-ledger rows and no orphan ledger entries;
- 87 rating-history rows and no orphan rating entries; and
- no duplicate session IDs, rating natural keys, or non-null currency
  operation IDs.

The catalog lifecycle class is therefore a route/result/persistence check. It
is not a claim that all 42 games received a human-quality mechanic playthrough;
that separate coverage is recorded in [MECHANIC_COVERAGE.md](MECHANIC_COVERAGE.md).
