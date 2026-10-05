# Old-build before-state capture manifest (tasks 1.3–1.12)

**Build:** release APK SHA-256 `d631ab9a410f9950f3c5cd989fe23b26d00178ecf98bafc439e86e85f20950a9`
(source `d3d0b9926a44c039d7fd0d29e1376586afaa897b`), installed on
`braintraining-ui35` / `emulator-5554` (1080×2400 @ 420dpi, Android 15).
**Method:** `scripts/qa/ui-capture.mjs` for the canonical route set;
`qa-artifacts/076-ui-reboot/driver.mjs` + per-batch driver scripts (emulator-local
adb input only — deep links, testID-addressed taps, uiautomator dumps) for
interaction and game states. No host mouse/keyboard automation. All 272 PNGs
(+ uiautomator XML dumps in `qa-artifacts/076-ui-reboot/captures/`, gitignored)
are hashed in `before-captures/index.json`.

Per-game state coverage (release build ⇒ no QA force-state hooks; states were
reached by real interaction — weak play via emulator-local taps; game tutorial
demos are seed-deterministic and were solved by their own generators where the
generic prober could not; two stuck tutorials were closed by the documented
deterministic fixture injection noted below):

| Domain | Game | tutorial | active | pause | feedback | result | notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Attention | attention-odd-one-out | ✓ | ✓ | ✓ | (in-round) | ✓ | Score 0 honest weak run |
| Attention | attention-sustained-vigilance | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Attention | attention-symbol-tracker | ✓ | ✓ | ✓ | ✓ | ✓ | tutorial closed by solver + verify (055-style demo) |
| Attention | attention-target-count | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Attention | attention-visual-search | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Flexibility | flexibility-card-sort | ✓ | ✓ | ✓ | ✓ | ✓ | via workout leg 1 (full journey) |
| Flexibility | flexibility-color-stroop | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Flexibility | flexibility-cue-shift | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Flexibility | flexibility-rule-flip | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Flexibility | flexibility-task-switch | ✓ | ✓ | ✓ | ✓ | ✓ | via workout leg 4 (finish → completion) |
| Language | language-context-fit | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Language | language-sentence-builder | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Language | language-word-chain | ✓ | ✓ | ✓ | ✓ | ✓ | also the resumed leg (resume evidence) |
| Language | language-word-match | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Language | language-word-scramble | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Logic | logic-code-cracker | n/a* | ✓ | ✓ | ✓ | ✓ | *this install's tutorial row pre-dated capture; study→input→submit loop exercised |
| Logic | logic-deduction-table | ✓ | ✓ | ✓ | ✓ | ✓ | demo solved from seeded generator (correctIndex 4) |
| Logic | logic-next-sequence | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Logic | logic-order-path | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Logic | logic-rule-grid | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Math | math-equation-builder | ✓ | ✓ | ✓ | ✓ | ✓ | demo closed via deterministic tutorial-store fixture (see note A) |
| Math | math-fast-math | ✓ | ✓ | ✓ | ✓ | ✓ | arithmetic parsed from dump |
| Math | math-missing-operator | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Math | math-number-line-estimation | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Math | math-value-ordering | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Memory | memory | ✓ | ✓ | ✓ | ✓ | ✓ | demo sequence [7,5,2] (matches 055 evidence) |
| Memory | memory-grid-recall | ✓ | ✓ | ✓ | ✓ | ✓ | seeded target cells |
| Memory | memory-pair-recall | n/a* | ✓ | ✓ | ✓ | ✓ | cued-recall loop exercised |
| Memory | memory-pattern-tap-back | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Memory | memory-prospective-cue | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Memory | memory-running-order | ✓ | ✓ | ✓ | ✓ | ✓ | via workout leg 3 |
| Memory | memory-sequence-memory | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Spatial | spatial-coordinate-turn | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Spatial | spatial-fold-match | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Spatial | spatial-grid-nav | ✓ | ✓ | ✓ | ✓ | ✓ | via workout leg 2 |
| Spatial | spatial-mental-rotation | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Spatial | spatial-transform-match | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Speed | speed-color-match | ✓ | ✓ | ✓ | ✓ | ✓ | swatch word parsed from dump |
| Speed | speed-order-sweep | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Speed | speed-quick-compare | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Speed | speed-reaction-time | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Speed | speed-tap-rush | ✓ | ✓ | ✓ | ✓ | ✓ | tutorial closed via deterministic fixture (note A); live rounds expiry-missed honestly |

(*) `logic-code-cracker` / `memory-pair-recall` first opened during earlier
batches whose tutorials completed then; their per-state captures come from the
dedicated completion runs.

**Note A — deterministic tutorial-store fixture (dev-equivalent QA control).**
Two release-build tutorial demos could not be completed by scripted taps:
`math-equation-builder` (equation assembly demo) and `speed-tap-rush` (2-second
target-expiry window shorter than the uiautomator dump cycle; independent 067
evidence also recorded 0-hit field taps on this build). For these two, the
tutorial_state row was marked completed=1/version='1.0.0' directly in the
app database while the app was force-stopped (adb root + sqlite3 on the
dedicated QA emulator), and the session states were then captured by real
interaction. The tutorial UI states themselves ARE captured
(`*-tutorial*.png`). This is state/fixture injection for QA, permitted by the
QA-instrumentation requirements; it does not touch scoring, persistence
formats or gameplay code, and production builds are unaffected.

## Route/state coverage (task 1.3)

- Canonical 11 route surfaces × light/dark: `before-route-default/` (22/22 PASS,
  harness manifest in gitignored qa-artifacts; curated copies in `before-captures/`).
- Games discovery: browse (first viewport + scrolled library), search matches,
  search no-matches (`games-no-results` + Browse all + Clear filters), cleared,
  category filter (Math), favorites empty ("No favorites yet") and populated
  (1 of 42), favorite toggle from detail (light + dark).
- Workout: fresh Home ("Start workout"), rerolled instance, start → leg intro
  (workout context), first-play tutorials ×4 legs, active board, pause overlay
  + resume, in-round feedback, in-session result, Next-game leg advance,
  Finish workout → completion summary → Home "4/4 games saved".
- Workout resume: force-stop mid-workout (1/4) → relaunch → Home "Continue
  workout" → resumed into the correct leg (Game 2, Word Chain).
- Rewards: inbox with claimable rows, claim-all celebration toast ("Claimed 5
  rewards"), post-claim inbox ("All caught up").
- Data management: populated counts, export output + Saved Backups rows
  (Load/Share/Delete), import card, invalid-JSON import message, wipe card,
  typed-DELETE armed state, post-wipe Home (fresh progression, backups kept).
- Recovery/edge: invalid game id, invalid detail id, invalid results id,
  `/storage-unavailable`, `/bootstrap-recovery`, invalid progress-domain and
  progress-game ids, populated Progress after a full workout, standalone
  Results (latest session, honest weak band).
- First-run: post-wipe Home with template/start state (first-run flow) and
  fresh-look Games.

## Honest NOT VALIDATED / partial entries

- **Persist-error / saving-error banners** (in-session `*.persist-error`,
  Results error): NOT VALIDATED on the release build — requires fault
  injection that release builds do not expose; the error-state UI is pinned by
  unit tests and will be exercised on the new build with dev-only fault
  injection during wave 3/14 validation.
- **Timeout-expiry feedback states per game**: captured where the mechanic
  expires naturally (speed family); games with in-round timers that the weak
  run completed before expiry show the answer-feedback state instead. Recorded
  per capture, not synthesized.
- **iOS, compact/expanded profiles, dark 2× font-scale, reduced-motion**:
  not part of the old-build game-state pass (route-level dark captures exist);
  these matrices are scheduled for the after-build certification (14.3) per
  the design's target matrix.
- **ARTEMIS runtime journeys**: verified READY (task 1.2) but not yet consumed
  for the old build; journeys run against the old build only where a state was
  unreachable by the deterministic lane — none required; journeys are the
  14.4 gate.
- **Workout reroll failure / paid-declined states**: not exercised on the old
  build (insufficient-funds path requires a fresh economy state); recorded as
  NOT VALIDATED for the old build.
