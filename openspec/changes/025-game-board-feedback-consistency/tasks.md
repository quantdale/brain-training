# Tasks — Campaign 025

## Phase 0 — Activation

- [x] OpenSpec packet created; governance/state/ownership rebound; validators PASS.

## Phase 1 — Board feedback consistency (31 games, 8 packets)

- [x] P1 attention: `attention-sustained-vigilance`, `attention-target-count`.
- [x] P2 flexibility: `flexibility-color-stroop`, `flexibility-cue-shift`,
      `flexibility-rule-flip`, `flexibility-task-switch`.
- [x] P3 language: `language-context-fit`, `language-sentence-builder`,
      `language-word-chain`, `language-word-scramble`.
- [x] P4 logic: `logic-code-cracker`, `logic-deduction-table`,
      `logic-order-path`, `logic-rule-grid`.
- [x] P5 math: `math-missing-operator`, `math-number-line-estimation`,
      `math-value-ordering`.
- [x] P6 memory: `memory-grid-recall`, `memory-pair-recall`,
      `memory-pattern-tap-back`, `memory-prospective-cue`, `memory-running-order`,
      `memory-sequence-memory`.
- [x] P7 spatial: `spatial-coordinate-turn`, `spatial-fold-match`,
      `spatial-grid-nav`, `spatial-mental-rotation`.
- [x] P8 speed: `speed-color-match`, `speed-order-sweep`, `speed-quick-compare`,
      `speed-reaction-time`.

## Phase 2 — HUD round progress

- [x] Games with a known round count pass `roundProgress` to `GameHost`. (All finite-round games wired; `memory-sequence-memory` is a time-boxed score attack with no total in state and is deliberately left on the round chip per HUD R2. `attention-sustained-vigilance` reports trial progress from its finite trial stream.)

## Phase 3 — Verification

- [ ] Full matrix (Jest, tsc, lint, validators), autobot canaries.
- [ ] Native before/after captures for representative boards.
- [ ] Durable state updated; campaign closed with honest classifications.
