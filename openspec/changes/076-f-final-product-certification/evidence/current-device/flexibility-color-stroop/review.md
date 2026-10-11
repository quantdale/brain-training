# Current-device acceptance — `flexibility-color-stroop`

- Date: 2026-10-11T12:40:44+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-flexibility-color-stroop`
- ARTEMIS session: `42e051aa-3099-492f-b66e-757ccef85bca` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# Color Stroop (flexibility-color-stroop) — device acceptance journey
Cold-start via `am force-stop com.braintraining.app` + deep link `braintraining://game/flexibility-color-stroop`. Identity CONFIRMED on intro screen: title "Color Stroop", tags "Switch / Flexibility", desc "Identify the ink color of color words, tracking rule flips between 'ink' and 'word' modes."; difficulty Easy/Normal/Hard/Expert/Adaptive (Normal selected); buttons "Back to games", "Start game", "How to play". Note key for all evidence: game_state_review_log.

## 1. Active Play Board
Observed on Trial 1 (post "Start game"). Dark theme.
- Header strip (root id `flexibility-color-stroop.screen`): "Trial 1/15" (id `flexibility-color-stroop.trial.1`), "Score 0" (id `flexibility-color-stroop.score`), "Rule: INK" (id `flexibility-color-stroop.rule`), thin progress bar with content-desc "1 of 15 rounds complete" (id `session-progress`, fill `session-progress-fill`).
- Control: button labeled "Pause" (id `flexibility-color-stroop.pause`, content-desc "Pause") at top-right.
- Stage (id `flexibility-color-stroop.stage`): live "Score" counter "0" (id `flexibility-color-stroop.score-live`) and the stimulus word rendered large — "BOOK" (id-less TextView, content-desc "Word: BOOK, ink color: red"), i.e. the word BOOK printed in RED ink.
- Answer controls: a row of 4 color buttons, literal labels "red", "blue", "green", "yellow".
- Instructions: no instruction body text on the play board itself; the governing rule is shown only as the "Rule: INK" chip (full instructions live on the pre-game intro screen behind a "How to play" button).
- Legibility: clear hierarchy (rule/score chips -> big stimulus -> answer row); high contrast white/colored text on near-black; board is legible, nothing clipped.

## 2. Scored Feedback
TIMEOUT reveal on Trial 1 (Rule INK, stimulus "BOOK" in red ink) after the round timer expired. EXACT verdict text:
- "Time's up!"  (with ⏱ icon)
- "It was red"
- "1500ms"
- action button: "Next trial" (id `flexibility-color-stroop.next-trial`)
Score remained 0 (no point awarded on timeout).

## 3. Pause & Resume
PAUSE opened by tapping the "Pause" button (`flexibility-color-stroop.pause`) during an active round; overlay id `flexibility-color-stroop.pause-overlay`.
Overlay contents (verbatim):
- Title: "Paused"  (id `flexibility-color-stroop.pause-title`)
- Subtitle: "The challenge is hidden and the timers are frozen."
- Button: "Resume"  (id `flexibility-color-stroop.resume`)
- Button: "Quit"  (id `flexibility-color-stroop.quit`)
While paused the timers are frozen (round timer does not advance). RESUME: tapped "Resume" — the overlay closed and the same halted round continued (Trial 3/15, stimulus "YELLOW" the word with red ink, Rule INK), i.e. resume restored the in-progress round rather than restarting it.

## 4. Final Result Screen
Reached after Trial 15/15 reveal via the "See results" button (button relabels from "Next trial" to "See results" on the last round).
Stat block (verbatim, top to bottom):
- Hero header card: "Keep training" (with purple progress illustration)
- Score (large): "0"
- "Accuracy  0%"
- "Correct  0/15"
- "Best streak  0"
- "Post-flip correct  0"
- "XP  10"
- Reward banner: "Reward  +10 XP · +2 coins" (sub-line "Progress saved")
Buttons on the screen: "Play again" (red) and "Done" (dark). No error/crash and no clipped text on this screen.

## 5. Input & Exit
Input responsiveness: every tap registered immediately and on the first attempt — "Start game", the "Pause" control, "Resume", the four answer swatches, the reveal button ("Next trial" ~14 times, relabelled "See results" on the last round) and "Done". No dead zones, no double-tap needed. (The single non-app failure was a stale-coordinate tap that the harness pre-execution safety net blocked because the round had already timed out at that instant — not app unresponsiveness.)
Exit: on the RESULT screen I tapped "Done" and the app returned cleanly to the Games list: header "Games" / "TRAIN YOUR BRAIN", "Browse all games", filter chips "All 42 / Memory 7 / Attention 5 / Speed 5", "Showing 42 of 42 games", bottom tabs Home/Games/Progress/Profile. No crash, no blank/frozen screen.
Return: re-fired `adb shell am start -a android.intent.action.VIEW -d braintraining://game/flexibility-color-stroop`; the Color Stroop intro screen re-opened (its "Start game" button present, resource-id `flexibility-color-stroop.start`), confirming safe exit and return. (A native BACK press from the board was not separately exercised.)

## 6. Defects
none observed on the Color Stroop play board or result screen: no clipped/truncated text, no low-contrast or unreadable labels, no overlapping controls, no hidden/unreachable actions, and no unresponsive input.
Minor, non-defect observations: (1) score is displayed twice on the play board (header chip "Score 0" and a large "Score 0" inside the board); (2) the round timer is shown only as an unlabelled green progress bar with no numeric countdown, so the remaining time is not readable; (3) outside this game, on the app Home page, the third "Today's plan" row text ("Reaction Time ...") was clipped/truncated.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
