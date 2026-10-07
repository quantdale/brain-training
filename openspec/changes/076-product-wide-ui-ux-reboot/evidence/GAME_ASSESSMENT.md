# Game-state evidence audit — Campaign 076 (review correction)

**Status: NOT VALIDATED for full 42-game/final-build certification.** These are
historical Android captures from the game-play/review-fix waves (including APK
`0556520f…`); `after-captures-games/index.json` does **not** bind each PNG to an
exact APK. The final board-still build is `c3b3e4d95f31f73a80dc02f4f05843fae5ecb0e44ca274cfb11044ed7f2a5b50`.
Changed shared button/touch presentation and board-still identity cannot be
certified by these earlier screenshots. The previous 42/42 `ok` driver status
in `after-game-status.jsonl` records completion of scripts, **not** a truthful
state-label or visual verdict.

I opened contact sheets of **all 42 active, 40 originally labelled feedback,
38 pause and 42 result frames** and compared each frame to its claimed state.
Only actual state-bearing, SHA-256-matched PNGs are listed below. `A` = playable
active board, `F` = in-round scored/timeout feedback, `P` = Paused overlay,
`R` = saved result; `—` means **NOT VALIDATED**, never inferred from a test,
shared shell, adjacent game, or mislabeled capture. Contact sheets are local
review aids under ignored `qa-artifacts/076-ui-reboot/`; the individual retained
PNGs are in `after-captures-games/`. `rejected/` retains disqualified PNGs
with reasons and hashes in the index. One Code Cracker guessing frame was
reclassified from a mislabeled feedback file to its genuine active state.

| Game | A | F | P | R | Individual observation / gap |
| --- | --- | --- | --- | --- | --- |
| attention-odd-one-out | ✓ | — | ✓ | ✓ | Distinct target in selectable grid; supposed feedback shows unanswered grid. |
| attention-sustained-vigilance | ✓ | — | — | ✓ | GO/hold instrument present; supposed feedback is already a saved result. |
| attention-symbol-tracker | ✓ | — | ✓ | ✓ | Tracker cells and Check answer; supposed feedback only shows a selection. |
| attention-target-count | ✓ | ✓ | ✓ | ✓ | Count grid and scored incorrect-answer card visible. |
| attention-visual-search | ✓ | — | ✓ | ✓ | Search grid present; supposed feedback still shows active board. |
| flexibility-card-sort | ✓ | ✓ | ✓ | ✓ | Card options and marked correct/wrong answer. |
| flexibility-color-stroop | — | ✓ | ✓ | ✓ | Supposed active screenshot is Time's up, not a response window. |
| flexibility-cue-shift | ✓ | ✓ | ✓ | ✓ | Rule/shape cards and marked feedback. |
| flexibility-rule-flip | ✓ | ✓ | ✓ | ✓ | Rule cue and marked card feedback. |
| flexibility-task-switch | ✓ | — | ✓ | ✓ | Parity choices visible; supposed feedback still awaits an answer. |
| language-context-fit | ✓ | ✓ | — | ✓ | Sentence options and scored choice; pause not retained. |
| language-sentence-builder | ✓ | ✓ | ✓ | ✓ | Word-order tokens and failed-order explanation. |
| language-word-chain | ✓ | — | ✓ | ✓ | Chain options visible; supposed feedback has no scored answer. |
| language-word-match | ✓ | ✓ | — | ✓ | Synonym options and marked answer; pause not retained. |
| language-word-scramble | ✓ | — | ✓ | ✓ | Choice selected but not submitted in supposed feedback. |
| logic-code-cracker | ✓ | — | ✓ | ✓ | Guessing controls reclassified from feedback; actual feedback not retained. |
| logic-deduction-table | ✓ | ✓ | ✓ | ✓ | Clues/table and scored answer. |
| logic-next-sequence | ✓ | ✓ | ✓ | ✓ | Sequence choices and marked next term. |
| logic-order-path | ✓ | ✓ | ✓ | ✓ | Ordering clues and solution feedback. |
| logic-rule-grid | ✓ | ✓ | ✓ | ✓ | Deduction grid and scored symbol. |
| math-equation-builder | ✓ | — | — | ✓ | Expression keyboard visible; no feedback/pause frame. |
| math-fast-math | ✓ | — | ✓ | ✓ | Answer keypad visible; supposed feedback still awaits input. |
| math-missing-operator | ✓ | ✓ | ✓ | ✓ | Operator slot and corrected answer. |
| math-number-line-estimation | ✓ | — | ✓ | ✓ | Number-line flag visible; supposed feedback shows unanswered line. |
| math-value-ordering | ✓ | — | ✓ | ✓ | Values awaiting ordering in both active and supposed feedback. |
| memory | ✓ | ✓ | ✓ | ✓ | Recall grid and wrong-tap feedback. |
| memory-grid-recall | ✓ | ✓ | ✓ | ✓ | Recall grid and correct-cell feedback. |
| memory-pair-recall | ✓ | ✓ | ✓ | ✓ | Pair options and previous-answer feedback panel. |
| memory-pattern-tap-back | ✓ | ✓ | ✓ | ✓ | Grid recall and marked wrong tap. |
| memory-prospective-cue | — | ✓ | ✓ | ✓ | Supposed active capture is pre-stream Start; timed-out stream is feedback. |
| memory-running-order | ✓ | — | ✓ | ✓ | Recall tokens visible; supposed feedback still awaits Submit. |
| memory-sequence-memory | ✓ | ✓ | ✓ | ✓ | Colored recall pads and wrong-tap feedback. |
| spatial-coordinate-turn | ✓ | ✓ | ✓ | ✓ | Compass prompt followed by marked direction answer. |
| spatial-fold-match | ✓ | ✓ | ✓ | ✓ | Fold grids and marked correct/wrong choices. |
| spatial-grid-nav | ✓ | — | ✓ | ✓ | Navigation grid/instructions; supposed feedback is unanswered grid. |
| spatial-mental-rotation | ✓ | ✓ | ✓ | ✓ | Target/candidate shapes and scored same/different response. |
| spatial-transform-match | ✓ | ✓ | ✓ | ✓ | Transformation grids and marked options (scroll needed for bottom). |
| speed-color-match | ✓ | ✓ | ✓ | ✓ | Swatch options and explicit Missed state. |
| speed-order-sweep | ✓ | ✓ | ✓ | ✓ | Number sweep grid and Time's up response. |
| speed-quick-compare | — | ✓ | ✓ | ✓ | Supposed active capture already says Timed out/Too slow. |
| speed-reaction-time | ✓ | ✓ | ✓ | ✓ | GO target and No reaction feedback. |
| speed-tap-rush | ✓ | — | ✓ | ✓ | Tap target shown; no scored feedback retained. |

**Core per-game coverage after visual classification:** A **39/42**, F
**27/42**, P **38/42**, R **42/42** (146/168 desired states).
`index.json` contains **172 retained PNGs** (the 146 per-game states plus
26 workout/other captures) and 16 quarantined/disqualified frames; filenames
or script status alone must not upgrade these counts. Missing core states:
3 A, 15 F, 4 P. The eight previously identified F/P holes across seven games were only the
first pass; inspecting every screenshot exposed 14 more state-label gaps.

**Visual-only interpretation:** playable boards that actually appear in the
retained frames have discernible primary actions and mechanic-specific forms;
this is not a measured game-by-game touch, large-text, theme or ARTEMIS
acceptance test. The earlier 90-frame `00024954…` route matrix (0 a11y
violations on six audits, 48dp Android criterion) does not measure every game
control or certify the later `c3b3e4d9…` APK. Android requires **48dp**, iOS
**44pt**; individual game control sizes on final build remain NOT VALIDATED.
Source/test fixes and historical snapshots cannot close the 22 missing
state frames, final-build matrix, provider-blocked ARTEMIS Pro, or iOS.
