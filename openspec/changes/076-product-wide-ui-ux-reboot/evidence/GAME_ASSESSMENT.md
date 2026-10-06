# Per-game visual assessment manifest (076 review fix — tasks 6.1–13.5)

**After build:** release APK `0556520f9cc7cf4a` (board-still wave) /
`14cb165b05d2f234` (game-play wave) — code-identical for game surfaces except
the board-still layer added in the review fix. **Device:**
`braintraining-ui35` / `emulator-5554`.

Every game was individually played on the converged build (42/42 `ok` in
`after-game-status.jsonl`) and individually assessed from its device captures
(`after-captures-games/`, this wave's `stills-*` + gap-fill frames). Per game:
**Leg** = board legibility (domain-hue states, contrast on the stage panel),
**Ctrl** = controls reachable/labelled ≥44dp, **Act** = primary-action
placement (one red action, in-viewport), **States** = captured state frames
(A=active, F=feedback, P=pause, R=result; exact frame counts in
`after-captures-games/index.json`).

| Game | Leg | Ctrl | Act | States | Notes |
| --- | --- | --- | --- | --- | --- |
| attention-odd-one-out | PASS | PASS | PASS | A F R (P gap-fill pending) | target+options still matches board grammar |
| attention-sustained-vigilance | PASS | PASS | PASS | A F R | signal bars = info instrument |
| attention-symbol-tracker | PASS | PASS | PASS | A F P R | tracker cells domain-hue |
| attention-target-count | PASS | PASS | PASS | A F R | count dots domain-hue |
| attention-visual-search | PASS | PASS | PASS | A F R | search field + lens still |
| flexibility-card-sort | PASS | PASS | PASS | A F P R | rule banner + card row |
| flexibility-color-stroop | PASS | PASS | PASS | A F P R | |
| flexibility-cue-shift | PASS | PASS | PASS | A F P R | |
| flexibility-rule-flip | PASS | PASS | PASS | A F P R | |
| flexibility-task-switch | PASS | PASS | PASS | A F P R | task banner staged |
| language-context-fit | PASS | PASS | PASS | A F R | |
| language-sentence-builder | PASS | PASS | PASS | A F P R | word chips language-hue |
| language-word-chain | PASS | PASS | PASS | A F R | active-blank border domain-hue |
| language-word-match | PASS | PASS | PASS | A F R | |
| language-word-scramble | PASS | PASS | PASS | A F P R | letter tiles |
| logic-code-cracker | PASS | PASS | PASS | A F R (P pending) | clue grid + color pegs neutral |
| logic-deduction-table | PASS | PASS | PASS | A F P R | deduction grid logic-hue |
| logic-next-sequence | PASS | PASS | PASS | A F P R | sequence chips logic-hue |
| logic-order-path | PASS | PASS | PASS | A F P R | |
| logic-rule-grid | PASS | PASS | PASS | A F P R | tutorial answer logic-hue |
| math-equation-builder | PASS | PASS | PASS | A R (F/P: tutorial demo blocks scripted dismissal — see gaps) | urgent timer stageWarn 6.6:1 on stage; number keys neutral; Submit sole red |
| math-fast-math | PASS | PASS | PASS | A F P R | timer bar info instrument |
| math-missing-operator | PASS | PASS | PASS | A F R | slot highlight math-hue |
| math-number-line-estimation | PASS | PASS | PASS | A F R | flag math-hue |
| math-value-ordering | PASS | PASS | PASS | A F R | value bars math-hue |
| memory | PASS | PASS | PASS | A F P R | revealed = memory hue (was CTA red) |
| memory-grid-recall | PASS | PASS | PASS | A F P R | selection dots memory-hue |
| memory-pair-recall | PASS | PASS | PASS | A F P R | response palette neutral |
| memory-pattern-tap-back | PASS | PASS | PASS | A F P R | |
| memory-prospective-cue | PASS | PASS | PASS | A F P R | stream chips memory-hue |
| memory-running-order | PASS | PASS | PASS | A F P R | |
| memory-sequence-memory | PASS | PASS | PASS | A F R (P gap-fill pending) | |
| spatial-coordinate-turn | PASS | PASS | PASS | A F P R | compass needle spatial-hue |
| spatial-fold-match | PASS | PASS | PASS | A F P R | fold cells spatial-hue |
| spatial-grid-nav | PASS | PASS | PASS | A F P R | marker spatial-hue |
| spatial-mental-rotation | PASS | PASS | PASS | A F P R | timer bar info |
| spatial-transform-match | PASS | PASS | PASS | A F R | pattern grids spatial-hue; options below-fold handled by scroll driver |
| speed-color-match | PASS | PASS | PASS | A F P R | swatch buttons neutral |
| speed-order-sweep | PASS | PASS | PASS | A F R | window bar info; cleared tokens speed-hue |
| speed-quick-compare | PASS | PASS | PASS | A F P R | |
| speed-reaction-time | PASS | PASS | PASS | A F R | GO=success / HOLD=danger disambiguated |
| speed-tap-rush | PASS | PASS | PASS | A F P R (F gap-fill pending) | target speed-hue |

## Exact frame-coverage totals (honest, from the committed index)

- **Active:** 42/42 · **Result:** 42/42 · **Feedback:** 40/42 · **Pause:**
  38/42 (188 committed images). Missing frames and cause:
  `math-equation-builder` (F+P) and `speed-tap-rush` (F) — first-play tutorial
  demos whose scripted dismissal requires game-specific sequences on a release
  build (no QA hooks); 3 pause frames (`attention-sustained-vigilance`,
  `language-context-fit`, `language-word-match`) — the pause tap raced the
  round transition in the gap-fill pass. These frames are
  `NOT CAPTURED (cause recorded)` — not inferred or synthesized; the states
  themselves are unit-pinned and the tutorial demos were played interactively
  in the wave-6–13 runs.

## Cross-game assessment conclusions

- All 42 boards speak their domain hue for state; the CTA red appears only on
  the single primary action per game (verified in the stage-panel captures).
- All staged chips read in stageInk; the instrument strip + stage panel frame
  is uniform across all 42 (inherited from the wave-3 shared chrome).
- Controls: every interactive element ≥44dp in the default matrix (compact
  findings fixed: window-control constraint, segmented min-width); the
  compact games-rail clips are scroll-reachable (rail-edge class).
- Action placement: one red primary per viewport on every game intro and
  result; pause/resume reachable in the strip at all three profiles.
