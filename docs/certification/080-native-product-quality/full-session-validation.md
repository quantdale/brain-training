# Full-session validation report — Campaign 080 continuation

Date: 2026-10-21
Evidence: `scripts/qa/native-coverage-ledger-v2.json` (fresh run) +
`native-coverage-merged.json` (with historical runs preserved).
Contract: `coverage-contract/2.0`. A session counts ONLY when one coherent
execution attempt proves gameplay entry → legitimate terminal state → results
**attributable to that session** (results-currency check).

## L3 certified — 5 of 42 (answer-driven unless noted)

| Game | Completion method | Proof |
|---|---|---|
| `attention-odd-one-out` | answer-driven rounds + round verdicts → results | playing→results transition event in-run |
| `attention-visual-search` | answer-driven rounds → results | same |
| `math-number-line-estimation` | answer-driven rounds → results | same |
| `spatial-transform-match` | answer-driven rounds → results | same |
| `speed-quick-compare` | timed answer-driven rounds → results | same |

Every row's terminal observation follows that run's own playing observations
with no intervening exit/restart — no cross-run blending exists in the merger
(see `native-qa-correction.md` F-080-003).

## L2 verified interaction — 9 games

`attention-target-count`, `flexibility-task-switch`, `language-word-chain`,
`logic-order-path`, `logic-rule-grid`, `memory-pair-recall`,
`spatial-coordinate-turn`, `speed-color-match`, `speed-reaction-time`.

All nine have an accepted input (observed gameplay-state change after the tap)
or an observed input-independent progression, plus feedback/round response.
`speed-color-match` and `speed-reaction-time` are **upgrades from the four
formerly-L1-only games** (both were untestable to the v1 driver).

## L1 verified smoke — 4 games

`attention-sustained-vigilance`, `flexibility-color-stroop`,
`logic-next-sequence`, `memory-prospective-cue` — launch + identity + render +
**verified post-exit destination**. Deeper interaction not proven this run.

## Below L1 — 24 games: exact blocking transition

**Dominant blocker (22 games): guided TUTORIAL DEMO requires an answer-driven
completion the generic driver does not yet solve.** Evidence (captured prompts
in ledger `boardValues`):
- `math-fast-math` and the math family: demo quests like
  **"Solve 2 more problems."** — requires reading the problem and typing the
  correct answer on the keypad (driver typed digits blindly → no completion).
- `memory-grid-recall`: demo validates a **pattern rebuild** (deterministic set
  `[3,5]` from `TUTORIAL_DEMO_SEED`, computed and tapped; per-press verdict
  display + prompt-driven progression not fully driven).
- `spatial-mental-rotation`: demo asks **same/different judgments**
  (`tutorial-same`/`tutorial-different`) requiring shape comparison.
- Others show the same pattern: `tutorial-demo-status` prompt + answer surface.
Back is inert on these tutorial surfaces and no `tutorial-skip` is offered, so
safe exit is likewise blocked → L0 with axes preserved.

**Remaining 2 (`memory`, `attention-symbol-tracker`-class edge cases):**
gameplay surfaces reached but entry/exit transitions not fully captured this
run; re-run with the demo solvers.

**Attempted approaches:** nav-control traversal (skip/done/next), guided-demo
interaction (generic selector rotation), per-game demo contracts
(`memory-grid-recall` [3,5]; `speed-color-match` label→button resolver — the
latter **cleared the demo and reached L2**, proving the approach scales).

**Best next action:** per-family demo answer resolvers keyed off the captured
`tutorial-demo-status` prompts and problem surfaces (keypad-answer resolver for
the math family; same/different comparator using the deterministic tutorial
content; sequence replay for memory demos). The prompts are already captured in
the evidence, so each resolver can be validated offline before device runs.

## Comparison with Campaign 080 v1 claims

| | v1 claimed | corrected (this run) |
|---|---|---|
| ≥L2 | 38 (unsubstantiated) | **14 proven** (9 L2 + 5 L3) |
| L3 | 1 | **5 proven** |
| L1 complete | 42 | 4 (+ 9/5 counted above) |
| proof standard | action attempted | action **accepted** + state transitions observed |
