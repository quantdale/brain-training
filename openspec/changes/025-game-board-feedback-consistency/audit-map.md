# Audit map — Campaign 025

Baseline SHA `2a1ba4e` (Campaign 024 closed VALIDATED).

## What Campaign 024 already unified

Shell surfaces (Home, Games, Progress, Profile, Rewards, Data management,
Results), the shared game chrome (intro hero, session HUD, results) and the
kit (`components/ui/**`). Board-level verdict language landed in eight category
canaries plus the three late-tap games:

| Game | Reference it demonstrates |
|---|---|
| `memory` | recall grid verdict + animated score |
| `attention-symbol-tracker` | cell verdict (fill + border + glyph) |
| `speed-tap-rush` | speed-round dye + `TapVerdictCue` |
| `math-equation-builder` | equation verdict panel |
| `language-word-match` | option verdict + round explanation |
| `logic-next-sequence` | option verdict on a dark board |
| `flexibility-card-sort` | wrong pick shown with the correct card |
| `spatial-transform-match` | option verdict with both states visible |
| `attention-odd-one-out`, `attention-visual-search`, `math-fast-math` | authoritative (post-deadline) feedback |

## Remaining boards (this campaign)

31 games grouped by mechanic family:

- attention: `attention-sustained-vigilance`, `attention-target-count`
- flexibility: `flexibility-color-stroop`, `flexibility-cue-shift`,
  `flexibility-rule-flip`, `flexibility-task-switch`
- language: `language-context-fit`, `language-sentence-builder`,
  `language-word-chain`, `language-word-scramble`
- logic: `logic-code-cracker`, `logic-deduction-table`, `logic-order-path`,
  `logic-rule-grid`
- math: `math-missing-operator`, `math-number-line-estimation`,
  `math-value-ordering`
- memory: `memory-grid-recall`, `memory-pair-recall`, `memory-pattern-tap-back`,
  `memory-prospective-cue`, `memory-running-order`, `memory-sequence-memory`
- spatial: `spatial-coordinate-turn`, `spatial-fold-match`, `spatial-grid-nav`,
  `spatial-mental-rotation`
- speed: `speed-color-match`, `speed-order-sweep`, `speed-quick-compare`,
  `speed-reaction-time`

## Known per-game constraints carried into the packets

- `attention-sustained-vigilance`: a never-idle 250 ms ticker means the verdict
  must not introduce layout churn; the digit stays visible by design (recorded as
  a Low cosmetic item in Campaign 023, revisited here only if the verdict layer
  changes it).
- `spatial-coordinate-turn`: adaptive axes are internally inconsistent
  (Campaign 023 Medium finding); this campaign changes presentation only and must
  not "fix" the adaptive model.
- `flexibility-color-stroop`: the game teaches colour/word conflict, so verdict
  colours must not collide with the game's own stimulus colours — use the
  verdict border + glyph as the primary channel and keep stimulus hues literal.
- `speed-*` games: sub-3-second rounds use the dye model, not a feedback sheet.

## Evidence to produce

Per packet: a one-line mapping of the game's verdict states onto the shared
vocabulary, focused behavioural tests, the game's unit suites still green, and a
board capture before/after where the board is reachable from the capture harness.
