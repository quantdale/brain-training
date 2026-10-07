# Game-state evidence audit — Campaign 076 (closure edition)

**Status: core 42-game state matrix COMPLETE (168/168), each state frame
individually visually reviewed.** The 22 previously missing state frames were
captured and reviewed against the final candidate APK SHA-256
`b2913bca9149eee752704b2529a1ddf13c877b26290b5d576d1be42355fe5d31`
(source `4a6fc5349c334b4324e4ea02421ebd06d87c5f64`, package
`com.braintraining.app` 0.1.0/1000, canonical x86_64 release build). The
historical 146 per-game frames remain mixed-build captures (see `index.json`
`build`); they were state-verified in the earlier audit and are labeled as
historical. A per-frame APK binding exists for the 22 closure frames; the
index verifier reports 194 retained + 16 quarantined PNGs and
`--require-complete` now passes: **A 42/42 · F 42/42 · P 42/42 · R 42/42**.

Legend: `A` = playable active board, `F` = in-round scored/timeout feedback,
`P` = Paused overlay, `R` = saved result. Every ✓ below is backed by a frame
this run opened and inspected (or the earlier per-frame audit for historical
frames); none were upgraded from filenames or script status.

| Game | A | F | P | R | Closure-frame observation (final APK) |
| --- | --- | --- | --- | --- | --- |
| attention-odd-one-out | ✓ | ✓ | ✓ | ✓ | Time's up: odd square revealed green + ✓ among dots; Next round. |
| attention-sustained-vigilance | ✓ | ✓ | ✓ | ✓ | Resolved verdicts "Held — nice"/"Missed one" with GO disabled. |
| attention-symbol-tracker | ✓ | ✓ | ✓ | ✓ | "You found 0 of 1 tracked symbols"; tracked star revealed. |
| attention-target-count | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| attention-visual-search | ✓ | ✓ | ✓ | ✓ | "Round failed — the odd tile was tile 1"; tile filled. |
| flexibility-card-sort | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| flexibility-color-stroop | ✓ | ✓ | ✓ | ✓ | Active: Rule INK + conflict/neutral stimulus + 4 swatches. |
| flexibility-cue-shift | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| flexibility-rule-flip | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| flexibility-task-switch | ✓ | ✓ | ✓ | ✓ | "Not quite" + correct/incorrect option marks; HUD score integer. |
| language-context-fit | ✓ | ✓ | ✓ | ✓ | Pause: shared overlay, game-scoped markers. |
| language-sentence-builder | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| language-word-chain | ✓ | ✓ | ✓ | ✓ | Time's up: full chain reveal + correct option ✓. |
| language-word-match | ✓ | ✓ | ✓ | ✓ | Pause: shared overlay, game-scoped markers. |
| language-word-scramble | ✓ | ✓ | ✓ | ✓ | Correct!/Wrong! verdicts with reveal panel and option marks. |
| logic-code-cracker | ✓ | ✓ | ✓ | ✓ | Budget exhausted + code reveal + 10/10 guess history. |
| logic-deduction-table | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| logic-next-sequence | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| logic-order-path | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| logic-rule-grid | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| math-equation-builder | ✓ | ✓ | ✓ | ✓ | Time's up + solution reveal; pause overlay. |
| math-fast-math | ✓ | ✓ | ✓ | ✓ | "Not quite / 7 + 4 = 0 / The answer was 11". |
| math-missing-operator | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| math-number-line-estimation | ✓ | ✓ | ✓ | ✓ | "Too far off": full-width line, ✕ guess at 5 vs flag at 7. |
| math-value-ordering | ✓ | ✓ | ✓ | ✓ | "Correct order: 4 < 13 < 19" vs "no tiles placed yet". |
| memory | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| memory-grid-recall | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| memory-pair-recall | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| memory-pattern-tap-back | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| memory-prospective-cue | ✓ | ✓ | ✓ | ✓ | Active: live GO/SIGNAL stream with glyph + window bar. |
| memory-running-order | ✓ | ✓ | ✓ | ✓ | "You recalled 1 of 2 in order" with ✕/✓ tiles vs Target row. |
| memory-sequence-memory | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| spatial-coordinate-turn | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| spatial-fold-match | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| spatial-grid-nav | ✓ | ✓ | ✓ | ✓ | "Correct!" with green route cells in both grids. |
| spatial-mental-rotation | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| spatial-transform-match | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| speed-color-match | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| speed-order-sweep | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| speed-quick-compare | ✓ | ✓ | ✓ | ✓ | Active: live "Are the two values the same?" + controls. |
| speed-reaction-time | ✓ | ✓ | ✓ | ✓ | Historical frames (audit-verified). |
| speed-tap-rush | ✓ | ✓ | ✓ | ✓ | "Round failed / 0 hit · 8 missed · 0 wrong"; demo completed by real taps. |

## Closure table — the 22 gap states (final APK `b2913bca…`)

Each row: captured with atomic PNG + accessibility hierarchy (fail-closed
markers: app root, actual-state markers present, wrong-state markers absent,
non-blank frame, installed-APK hash match), then the PNG was opened and the
frame answered the seven review questions (app foreground, game visible,
requested state visible, mechanic evidence, correct state class, controls
usable, no clipping/contrast/overlap defect).

| Game | State | Attempt | Screenshot valid? | Hierarchy valid? | Visual review | Final status |
| --- | --- | --- | --- | --- | --- | --- |
| flexibility-color-stroop | active | 2 (1 early-timer reject) | yes | yes | inspected | PASS |
| memory-prospective-cue | active | 2 (1 marker reject) | yes | yes | inspected | PASS |
| speed-quick-compare | active | 1 | yes | yes | inspected | PASS |
| attention-odd-one-out | feedback | 1 | yes | yes | inspected | PASS |
| attention-sustained-vigilance | feedback | 1 | yes | yes | inspected | PASS |
| attention-symbol-tracker | feedback | 1 | yes | yes | inspected | PASS |
| attention-visual-search | feedback | 1 | yes | yes | inspected | PASS |
| flexibility-task-switch | feedback | 1 | yes | yes | inspected | PASS (HUD float defect found+fixed) |
| language-word-chain | feedback | 1 | yes | yes | inspected | PASS |
| language-word-scramble | feedback | 1 | yes | yes | inspected | PASS |
| logic-code-cracker | feedback | 2 (1 stale-enable reject) | yes | yes | inspected | PASS |
| math-equation-builder | feedback | 2 (1 marker-set reject) | yes | yes | inspected | PASS |
| math-fast-math | feedback | 1 | yes | yes | inspected | PASS |
| math-number-line-estimation | feedback | 1 | yes | yes | inspected | PASS (line-collapse defect found+fixed) |
| math-value-ordering | feedback | 1 | yes | yes | inspected | PASS |
| memory-running-order | feedback | 1 | yes | yes | inspected | PASS |
| spatial-grid-nav | feedback | 1 | yes | yes | inspected | PASS |
| speed-tap-rush | feedback | 2 (1 hit-test defect block) | yes | yes | inspected | PASS (hit-test defect found+fixed) |
| attention-sustained-vigilance | pause | 1 | yes | yes | inspected | PASS |
| language-context-fit | pause | 1 | yes | yes | inspected | PASS |
| language-word-match | pause | 1 | yes | yes | inspected | PASS |
| math-equation-builder | pause | 2 (1 driver timeout) | yes | yes | inspected | PASS |

## Runtime defects found and repaired during certification

All three were device-captured, then fixed with focused commits and regression
guards; the closure frames above were recaptured on the post-fix build.

1. **speed-tap-rush hit test (Critical — primary mechanic unusable).** The
   target marker View intercepted touches, so Android reported gesture
   `locationX/Y` relative to the marker child and the field's normalized hit
   test missed every on-target tap (18+ device taps, zero hits; the mandatory
   tutorial demo was unreachable). Fix `e259171`: marker is
   `pointerEvents="none"` (same pattern as the in-repo number line) + a
   structural guard test. Proof: the tutorial demo (three required hits)
   completed with real taps on the fixed build.
2. **flexibility-task-switch HUD score (Medium).** Raw float rendered in the
   stage HUD ("Score 144.1511312699999") while the board readout rounded.
   Fix `4a6fc53`: the HUD boundary formats numeric score strings as integers;
   scoring values/rules untouched. Guard: `hud-score-format` test.
3. **math-number-line-estimation feedback geometry (Medium).** The resolved
   number line collapsed to a ~60px pill with squashed min/max labels inside
   the centered feedback card (wrapper shrink-wrapped absolute children).
   Fix `4a6fc53`: wrapper `alignSelf: 'stretch'` + geometry guard test. Proof:
   closure frame shows a 750px-wide track with edge labels, ticks, ✕ guess
   marker and flag.

## Residual honest boundaries

- The 146 historical frames do not carry per-file APK binding; they remain
  labeled historical in `index.json` and are not final-build certification.
- Touch-target (48dp Android / 44pt iOS), theme, font-scale, compact/large and
  reduced-motion acceptance are measured by the final surface/profile matrix
  and its audits, not by these game-state frames.
- ARTEMIS Pro remains the external provider-gated lane; iOS runtime remains
  NOT VALIDATED.
