# Current-device acceptance — `memory-grid-recall`

- Date: 2026-10-11T21:11:36+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-memory-grid-recall`
- ARTEMIS session: `b08674cb-8b9a-4907-b165-2c8006ba601a` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# memory-grid-recall — current-device game-state acceptance journey
Device: 1080x2400 (Android). Identity: title screen = "Grid Recall" (category "Memory"), mechanic: "Study a pattern of highlighted cells, then rebuild it from memory after the board is hidden."
Launch: cold force-stop + deep link braintraining://game/memory-grid-recall.

## 1. Active Play Board
Screen: "Grid Recall" play view (reached via deep link, cold start). Cards/panels are dark with green/mint accents.
- Header chip: "Round 1/5" + sub-cue "Memorize 5 cells"; thin green progress bar under header.
- Control: "Pause" button (top-right, clickable, bounds 754,238-983,364).
- Score chip: label "Score" with value "0" (top-right of board panel).
- Instructions visible: YES — study cue "Memorize the highlighted pattern..." during the study phase, which then switches to the input-phase heading "Rebuild the pattern".
- Board: 4x4 grid of outlined rounded dark cells (16 cells, all clickable), centered on a dark board panel; each cell ~200x200px, uniform gaps => clear hierarchy, fully legible, no clipping.
- Stimulus: 5 cells highlighted pink during study phase — row1 col4, row2 col2, row2 col3, row4 col2, row4 col4.
- Auxiliary counter: 5 small pips (row of marks) at right of the "Rebuild the pattern" heading, i.e. 5 cells to place.

## 2. Scored Feedback
Round 1 submitted answer (5 taps matching the memorized cells) → verdict screen shown after "Check answer":
- Verdict text (exact): "Pattern rebuilt!" (green heading) with sub-line "You recalled 5 of 5 cells".
- Score chip updated from 0 to "100" (top-right of board panel).
- Feedback also rendered on the board: each correctly recalled cell outlined green with a green check badge (cells r1c4, r2c2, r2c3, r4c2, r4c4).
- Follow-on control appears: "Next round" (full-width red button). Header sub-cue changed to "1 of 5 rounds complete".
- No timer/round countdown chip is displayed during this feedback state.
Round 2 submitted answer (deliberately arbitrary 5 of the required 6 cells) → incorrect verdict:
- Verdict text (exact): "Not quite" (red/salmon heading) with sub-line "You recalled 1 of 6 cells (2 wrong taps)".
- Board feedback: correctly-hit cells outlined green with a green check badge; wrong cells outlined red with a red ✗ badge; the untouched cell stayed plain.
- Score chip unchanged at "100"; follow-on control again "Next round".
- So round 2 required 6 cells (pips row grows with round).

## 3. Pause & Resume
- Opened by the "Pause" control in the round header (bounds 754,238-983,364; resource-id ...pause) while a round was live.
- Overlay (full-screen, dark scrim; the board/challenge is hidden behind it):
  - Heading (exact text): "Paused"
  - Sub-line (exact text): "The challenge is hidden and the timers are frozen."
  - Buttons (exact labels): "Resume" (primary, pink/red filled) and "Quit" (secondary, dark grey).
- Timer freeze behaviour confirmed by the app's own copy: "the timers are frozen" while paused.
- Resume: tapped "Resume" → returned to the live Round 2/5 board ("Rebuild the pattern") with the game continuing normally.

## 4. Final Result Screen
Reached after submitting Round 5/5 and tapping "See results". Reached state = "Strong run".
- Headline: "Strong run" (resource-id memory-grid-recall.result-headline) above a mini 3x3 board preview of the game art.
- "Final score" label + value "490" (resource-id memory-grid-recall.score-final, large bold).
- Stat lines (literal label → value, each on its own row with a divider):
  - "Accuracy" → "80%" (memory-grid-recall.accuracy)
  - "Rounds passed" → "4/5" (memory-grid-recall.rounds-passed)
  - "Best recall" → "8" (memory-grid-recall.best-recall)
  - "Best streak" → "3" (memory-grid-recall.best-streak)
  - "XP" → "40" (memory-grid-recall.xp)
- Reward: XP 40 (the only reward element) plus the rank headline "Strong run"; the mini-board artwork and 5 shown as round marks.
- Reward banner (exact text): "Reward  +40 XP  ·  +8 coins" with sub-line "Progress saved" (green banner below the XP row).
- Controls: "Play again" (primary red/pink) and "Done" (secondary dark). No share/menu controls.
- Reading is unambiguous; all values clearly legible, no clipping.

## 5. Input & Exit
- Input responsiveness: individual taps registered immediately throughout — each grid-cell tap flipped its cell to filled purple on the very next frame, and the "Check answer"/"Next round"/"Pause"/"Resume" taps all took effect on the first press. The only non-registrations were (a) a submit fired as the 4th member of a rapid multi-tap burst on Round 4, which produced no immediate submit and needed one repeat tap, and (b) two mis-aimed taps caused by wrong x-coordinate math, not by unresponsive UI. Countdown/pause/resume all behaved normally.
- Exit: the result screen's "Done" control returned straight to the app's Games list ("Games" tab, "Browse all games", filters All 42 / Memory 7 / Attention 5 / Speed 5, cards Odd One Out, Signal Watch, Symbol Tracker, Target Count).
- Re-open (safe return): filtered the list with the "Search games…" field ("Grid" → "Showing 1 of 42 games", Memory 7 filter auto-selected) and tapped the sole "Grid Recall" card → its intro screen loaded again, identical to the cold-start entry: title "Grid Recall", category "Memory", mechanic "Study a pattern of highlighted cells, then rebuild it from memory after the board is hidden.", Difficulty = Normal, controls "Back to games" / "Start game" / "How to play" / "Try a demo". Identity re-confirmed; exit and return are safe and idempotent (a fresh game starts at Round 1/5 with Score 0).

## 6. Defects
None observed.
- No clipped/truncated text: every label, stat row and verdict string rendered fully (including the "Reward  +40 XP  ·  +8 coins" banner and the longest verdict "You recalled 8 of 8 cells").
- Contrast/legibility: dark board with mint/green accents; pink stimulus cells, purple filled cells, green check badges and red ✗ badges were all clearly distinguishable; the 4x4 grid kept a clear hierarchy at 1080x2400.
- No hidden/unreachable actions: "Pause", "Quit", "Resume", "Check answer", "Next round", "See results", "Play again" and "Done" were all reachable and responsive.
- No overlap: the pause overlay correctly covers and hides the board; no controls overlapped the grid.
- Input: taps registered immediately (see Section 5); the only non-effects were self-inflicted mis-aims / one submit masked inside a rapid multi-tap burst, not UI faults.
- Note: round timers were never observed to expire on screen — every round was answered before any countdown became visible; no timer chip was displayed in the round header or feedback state (Round timer is only implied by the pause copy "the timers are frozen"), which is worth flagging as a minor observability gap rather than a defect.
Appendix — later-round verdicts (evidence for Section 2 / Section 4 score progression):
Round 3 submitted (6/6 correct) → verdict "Pattern rebuilt!" (green) / "You recalled 6 of 6 cells"; Score 100 → 215; all six cells outlined green with check badges; header cue "3 of 5 rounds complete"; follow-on control "Next round".
Round 4 submitted (7/7 correct) → verdict "Pattern rebuilt!" (green) / "You recalled 7 of 7 cells"; Score 215 → 345; seven cells outlined green with check badges; header sub-cue "4 of 5 rounds complete"; follow-on control "Next round".
Round 5 (final): verdict "Pattern rebuilt!" (green) / "You recalled 8 of 8 cells"; Score 345 → 490; eight cells outlined green with check badges; follow-on control changed to "See results" (red, full-width).

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
