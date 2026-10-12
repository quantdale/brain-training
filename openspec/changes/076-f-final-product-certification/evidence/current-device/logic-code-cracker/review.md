# Current-device acceptance — `logic-code-cracker`

- Date: 2026-10-11T14:33:28+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-logic-code-cracker`
- ARTEMIS session: `1a6f72cd-d1b3-4294-bb87-d2b8f2caa01d` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

Game: com.braintraining.app — Code Cracker (logic-code-cracker), "Deduce" / "Logic & Problem Solving"
Journey started from cold: adb force-stop + deep link braintraining://game/logic-code-cracker.
Pre-game screen (identity confirmed): title "Code Cracker"; badge "Deduce"; category "Logic & Problem Solving"; description "Crack a hidden color code using logic and deduction."; Difficulty selector: Easy / Normal (selected, red) / Hard / Expert / Adaptive; buttons "Back to games", "Start game", "How to play".

## 1. Active Play Board
- Header chips: "Round 1/4" with a green progress bar labeled "1 of 4 rounds complete"; "Score 0" (top row) and a "Score" label with counter "0" inside the board card.
- Stimulus: a row of 4 empty dark-grey code slots (the hidden/secret code placeholders, unfilled at round start).
- Controls (literal labels): "Pause" button (top-right); six color swatch buttons labeled: Red, Blue, Green, Yellow, Purple, Orange; "Submit guess" button (rendered dim dark-red = disabled/unauthorised until 4 slots are filled).
- Round/score/timer chips: Round 1/4 + score 0 present; NO visible countdown timer chip on the board.
- Instructions: no instruction text visible on the play board itself (the "Crack a hidden color code…" text was only on the pre-game screen).
- Legibility: high contrast (light text on near-black), clear hierarchy; board fully legible, nothing clipped.
- Input test: single tap on the Red swatch registered IMMEDIATELY — slot 1 filled Red and a "Clear" button appeared under the slots (no lag, no miss).



## 2. Scored Feedback
- Submitted "Guess 1/10" = Red, Blue, Green, Yellow. EXACT verdict text rendered beside the guess: "1 exact, 0 color only" (with a small blue dot marker at the end of the row). The board cleared back to 4 empty slots for the next guess.


## 3. Pause & Resume
- Tapped "Pause" (top-right of board). PAUSE overlay opened: heading "Paused", subtitle "The challenge is hidden and the timers are frozen." Buttons (literal labels): "Resume" (red/primary) and "Quit" (dark/secondary).
- The code board is hidden beneath the overlay while paused (consistent with the subtitle).

- uiautomator dump under the overlay confirmed board state is retained while paused (Round 1/4, Score 0, Guess 1/10, all six colour swatches) alongside overlay text "Paused"/"Resume"/"Quit".
- Tapped "Resume" — overlay closed and the live colour board returned with "Guess 1/10" retained. Pause/Resume works.

- Round-end reveal (Round 1/4, guess budget spent): overlay heading "Budget exhausted" with "The code was:" and the secret code revealed as Purple, Orange, Orange, Orange. Behind it the guess ledger "Guess 10/10" lists ≥10 per-guess verdicts: nine rows "1 exact, 0 color only" and one row "1 exact, 1 color only".

## 4. Final Result Screen
Reached after all 4 rounds (each resolved by exhausting the 10-guess budget; none solved).
- Top reward/hero card: game icon with "Keep training" heading.
- "Final score" = 0
- Stat rows: "Accuracy" = 0%; "Rounds solved" = 0/4; "Best streak" = 0; "Total guesses" = 40/40; "XP" = 10
- Reward block: "Reward +10 XP · +2 coins" with subtitle "Progress saved"
- Buttons: "Play again" (red/primary) and "Done" (dark/secondary)

## 5. Input & Exit
- Input registration: colour swatch taps registered immediately with no lag or misses — a single tap filled the next answer slot instantly and a "Clear" button appeared; "Submit guess" registered each time and produced a verdict row.
- Exit: tapped "Done" on the Final Result screen — returned cleanly to the Games list (search bar "Search games…", category filter chips "All, 42" / "Memory, 7" / "Attention, 5" / "Speed, 5" / "Math, 5", game cards, and Home/Progress/Profile bottom nav). No crash, no error dialog.
- Return: re-fired the deep link braintraining://game/logic-code-cracker — the Code Cracker intro screen loaded again ("Code Cracker" / "Deduce" / "Logic & Problem Solving" / "Crack a hidden color code using logic and deduction." / difficulty Easy·Normal·Hard·Expert·Adaptive / "Start game"). Safe exit and return verified.

## 6. Defects
- Hidden/unreachable continue action: on each round-end "Budget exhausted" reveal card, the only continue control ("Next round", and "See results" on the final round) sat BELOW the fold at the bottom of a scrollable card and was not visible without scrolling; the visible "✕" pill at the top of the card did NOT dismiss/advance (tap had no effect). A user could easily think the round-end screen is stuck.
- Clipped/oversized scroll content: the round-failed card's guess ledger (10 rows) overflows the viewport, pushing the continue button off-screen (the root cause of the above).
- No visible round countdown timer: the board never showed a countdown; rounds only end via the 10-guess budget ("Budget exhausted"), so there is no time pressure for the player and no timeout-reveal path.
- Otherwise: colour board is legible with clear hierarchy; swatch labels Red/Blue/Green/Yellow/Purple/Orange have adequate contrast; no text clipping observed on the main board or result screen; no input lag observed.


## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.

## 2026-10-12 addendum — 076-f D3 disabled-control re-observation

The disabled action control above is one of the two 42-row surfaces that
change 076-f's shared-Button repair actually repaints, so it was
re-observed on the new terminal APK
`c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6`
(48,888,528 bytes, source `d5787ec2857b0fd856d2e04ad346316d70951f6c`), read
straight off the live board from the accessibility hierarchy
(`logic-code-cracker.submit-guess` [Submit guess], enabled=false, bounds [97,968][983,1094]).

Decoding the device screenshot and computing WCAG 2.x contrast between the
control's fill and its label glyphs:

- light: fill #ECEAE5, label #4A4B4E — 7.25:1
- dark: fill #17181B, label #B9BABC — 9.14:1

Both are above the 4.5:1 AA threshold and both equal the tokens the
repair specifies (backgroundElement / textSecondary), which is the
pixel-level proof that the whole-control `opacity: 0.5` collapse is
gone; the previous collapse sat near 1.63:1. The label glyph count is
identical across the two themes for the same control, which confirms the
measurement is reading the text and not antialiasing.

Evidence:
`openspec/changes/076-f-final-product-certification/evidence/d3-affected-games-reobserved.json`

Every other state asserted in this row — the active board, the quoted
scored feedback, pause/resume with the timer proven frozen, the itemised
final result, immediate input, and the game's own mechanic — is asserted
about ENABLED controls, which the repair does not repaint, and about
behaviour, which it does not touch. Those assertions therefore still hold
unchanged on this new APK; only the disabled-control appearance above is
superseded.

## Addendum verdict

Row still PASS on `c8c3d46c` — the superseded disabled-control appearance
has been replaced with measured, token-exact, AA-passing evidence in both
themes.
