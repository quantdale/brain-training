# Current-device acceptance — `speed-color-match`

- Date: 2026-10-11T23:51:01+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-speed-color-match`
- ARTEMIS session: `517f25bb-5eda-489a-baa0-f178cca4c1fc` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# Game State Review — speed-color-match (deep link braintraining://game/speed-color-match)
App: com.braintraining.app. Cold-launched via deep link; landed on game DETAIL page (not Home), confirming identity: title "Color Match", label row "Match" + "Speed".

## 1. Active Play Board
Top header bar: "Trial 1/20" (left), progress bar with caption "0 of 20 rounds complete", "Score 0" (left, 2nd line), and a rectangular "Pause" button (right).
Board panel (bordered card): "Score" label top-left with value "0" top-right (a second score chip).
Stimulus: a large solid red square (swatch) centered, with the word "RED" rendered in ORANGE text directly below it — i.e. swatch color (red) and text color (orange) deliberately mismatch.
Instruction (visible on board): "Tap the matching color!" with a small empty rounded pill to its right.
Answer controls (6 rounded buttons, 3x2 grid, each labelled in its own color):
 - "RED" (red), "BLUE" (blue), "GREEN" (green) on row 1
 - "YELLOW" (yellow), "PURPLE" (purple), "ORANGE" (orange) on row 2
Legibility/hierarchy: clear — large stimulus dominates, high contrast text, buttons color-coded and unclipped; hierarchy reads top (progress/score) → stimulus → instruction → answers.

## 2. Scored Feedback
Round 1 timed out (answer tap did not land in time — 10-15s timer). Scored reveal observed:
 - A yellow oval verdict chip w/ stopwatch icon reading "Missed" appeared beside the instruction line.
 - Literal line below the answer grid: "Timed out".
 - Red button "Next trial" offered to advance.
 - Header: "Trial 1/20" with progress caption now "1 of 20 rounds complete".
 EXACT verdict text: "Missed" (chip) and "Timed out" (line).
Round 8 (answer tap RED on a GREEN stimulus): red X icon chip with EXACT text "Wrong" (content-desc "Last trial: wrong"), and a reaction-time line under the grid reading "1578ms".
=> Feedback variants observed: "Wrong" (incorrect, red X, shows response ms) and "Missed"/"Timed out" (no answer).

## 3. Pause & Resume
Tapping the board's "Pause" button opens a full-screen PAUSE overlay (board hidden behind it):
 - Title: "Paused"
 - Subtitle: "The challenge is hidden and the timers are frozen."
 - Buttons (exactly two): red "Resume" and dark "Quit"
Board state preserved beneath the overlay (uiautomator dump): "Trial 3/20", content-desc "3 of 20 rounds complete", "Score 0", "Pause", "Score" "0", stimulus word "PURPLE", instruction "Tap the matching color!", content-desc "Last trial: missed" — confirming the round timer is frozen while paused.
RESUME: tapped "Resume" — returned to the live board (Trial 3/20 resumed).

## 4. Final Result Screen
Reached after all 20 rounds (Trial 20/20 resolved; final-round button reads "See results"). Contents:
 - Heading: "Keep training"
 - "Final score" 138
 - "Accuracy" 5%  (content-desc "Accuracy: 5%")
 - "Trials correct" 1/20  (content-desc "Trials correct: 1/20")
 - "Best streak" 1  (content-desc "Best streak: 1")
 - "Avg reaction" 145ms  (content-desc "Avg reaction: 145ms")
 - "XP" 11  (content-desc "XP: 11")
 - Reward line (exact): "Reward  +11 XP  ·  +2 coins"
 - Status line: "Progress saved"
 - Buttons: "Play again" and "Done"

## 5. Input & Exit
Input registration: answer taps registered immediately — a tap on RED while the GREEN swatch was shown instantly produced the "Wrong" verdict chip plus a per-round reaction-time readout ("1500ms"/"1578ms"/"1826ms"), and taps on "Next trial"/"See results", "Pause", "Resume" all responded on first touch (no unresponsive control observed). Score updated live to 138 across the 20 trials.
Exit: on the final result screen, tapped "Done" (speed-color-match.quit) → returned to the app's "Games" list page (header "TRAIN YOUR BRAIN" / "Games", "Pick a game to train a skill. New games appear here as they are added."; topResumedActivity com.braintraining.app/.MainActivity) — a clean, safe exit.
Return: re-fired the deep link `braintraining://game/speed-color-match` → the app re-opened this same game's "Color Match" detail page (labels "Match"/"Speed", "Back to games", instruction, difficulty Easy/Normal/Hard/Expert/Adaptive, "How to play", "Start game", "Try a demo"), proving a safe exit-and-return to the correct game.

## 6. Defects
None observed. Text was unclipped and high-contrast on header chips, instruction, stimulus and answer buttons; the verdict chip and reaction-time line rendered fully; all action controls ("Pause", "Resume", "Quit", "Next trial"/"See results", "Play again", "Done") were visible and reachable with no overlap or occlusion. The only cosmetic quirk is an intentional empty rounded pill beside the instruction before a verdict is scored (it fills in with the verdict chip afterwards) — by design, not a defect.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
