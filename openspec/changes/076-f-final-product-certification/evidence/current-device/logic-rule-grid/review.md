# Current-device acceptance — `logic-rule-grid`

- Date: 2026-10-11T20:13:00+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-logic-rule-grid`
- ARTEMIS session: `78612975-cdc2-4d50-88ab-f3d2f3f46102` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# Game-State Acceptance Review — logic-rule-grid (com.braintraining.app)

## 1. Active Play Board
- Header chips: "Round 1/7" + a horizontal round-progress timer bar (green, depleting) + "Pause" button (top-right); second line "Score 0".
- In-card score chip: label "Score" left, value "0" right.
- Instructions ARE visible on the board card: "Several cells are hidden. Deduce the marked one (?) by chaining row and column constraints."
- Stimulus: a Latin grid of digits — 4x4 (16 cells) rendered as a 5-per-row flow: row1 "2 3 4 1 | 1", row2 "? 3 2 ? | 2", row3 "1 3 3 1 | 2", plus a lone 16th cell "?" alone on the last line (highlighted, = the marked asked cell). Hidden cells shown as "?".
- Answer controls (all visible, red buttons): "2", "3", "1", "4" in a 2x2 arrangement. No other play controls (no undo/skip/hint).
- Legibility/hierarchy: clear — dark card, white digits, red answer buttons; hierarchy is good (round/score top, board center, answers below).

## 2. Scored Feedback
- TIMEOUT REVEAL (Round 1 of 7, board left unanswered — timer bar drained): a bordered gold/yellow overlay card appeared with a stopwatch icon and the exact texts:
  - Heading: "Time up!"
  - Sub-line: "The missing symbol was"
  - Answer: "4"
  - The answer buttons reappear inside the overlay (2, 3, 1, 4) with the correct one "4" highlighted green and prefixed with a check mark: "✓ 4".
- Score after this round remained "Score 0" / header "Score 0" (a timed-out round scores nothing).

## 3. Pause & Resume
- Tapping the top-right "Pause" button opened a full-screen overlay on an opaque near-black background (board hidden behind it).
- Heading: "Paused"
- Sub-line: "The challenge is hidden and the timers are frozen."
- Buttons (2): "Resume" (red/pink filled chip, left) and "Quit" (dark outlined chip, right). No other controls.
- RESUME: tapping "Resume" returned to the same live board (same Round 1/7, same grid/score) — resume works.

## 4. Final Result Screen
Reached after all 7 rounds (each timed out, board never answered). Exact on-screen lines:
- Headline: "Keep training"
- "Final score" — 0
- "Accuracy" — 0%
- "Rounds correct" — 0/7
- "Best streak" — 0
- "XP" — 10
- "Reward  +10 XP  ·  +2 coins"
- "Progress saved"
- Buttons: "Play again" (id logic-rule-grid.restart) and "Done" (id logic-rule-grid.quit).

## 5. Input & Exit
- Taps on real controls registered immediately: "Start game" (intro) opened the live board at once; "Pause" opened the overlay instantly; "Resume" returned to the board instantly; "Next round" advanced the round instantly.
- The timeout reveal card's red option buttons ("1","2","3","4" / green "✓ N") do NOT respond to taps — they are purely informational; the actual advance control ("Next round", and "See results" on the last round) sits below the fold (see Section 6).
- EXIT: on the result screen, tapped "Done" -> returned to the Games list (header "TRAIN YOUR BRAIN" / "Games", subtitle "Pick a game to train a skill. New games appear here as they are added.", games grid present). No crash, no stuck screen, focus stayed on com.braintraining.app/MainActivity.
- RETURN: re-fired the deep link `adb shell am start -a android.intent.action.VIEW -d braintraining://game/logic-rule-grid` -> the Rule Grid intro screen reloaded correctly: title "Rule Grid", category "Logic & Problem Solving", description "A Latin grid: every row and column contains each symbol exactly once.", difficulty Normal, button "Start game". Safe exit and return confirmed.

## 6. Defects
1. HIDDEN/UNREACHABLE ACTION (significant): after each round ends, the advance control ("Next round", and "See results" on round 7) is rendered BELOW the fold / partly clipped. At the default scroll position it is not visible or tappable; a scroll down is required before it works. Without scrolling, taps land on the non-interactive reveal option buttons and the round cannot be advanced.
2. OVERLAP / STALE TREE: the timeout reveal re-uses the live board's option ids (logic-rule-grid.symbol-option.*), so the advance button's bounds overlap the reveal option buttons — this produced a real pre-execution guard rejection ("Next round" reported occupied by "4"). Reveal options are exposed with class android.widget.Button yet are not interactive (misleading affordance).
3. GRID MIS-WRAP (layout): the 4x4 (16-cell) Latin grid is laid out 5 cells per row (3 rows of 5 + one lone cell below) instead of 4x4. With only 4 symbols, a displayed row of 5 (e.g. "1 ? 3 2 4") cannot satisfy the stated rule "every row and column contains each symbol exactly once", so the row/column structure is visually misleading.
4. No low-contrast or clipped *text* observed; labels ("Round n/7", "Score 0", "Pause", instruction line, result stats) are all fully legible.
5. Score stayed 0 across all rounds because every round timed out (no answer registered) — expected behaviour, not a defect.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
