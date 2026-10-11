# Current-device acceptance — `flexibility-task-switch`

- Date: 2026-10-11T13:00:29+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-flexibility-task-switch`
- ARTEMIS session: `b2f297da-e5e4-4cdd-a1d9-e510d76a3cfa` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

Game: Task Switch (flexibility-task-switch). Cold-launched via deep link braintraining://game/flexibility-task-switch. Intro screen: title "Task Switch", tag "Alternate", category "Flexibility", desc "Alternate between micro-tasks using the cue.", Difficulty options Easy/Normal(sel)/Hard/Expert/Adaptive, buttons "Back to games", "Start game", "How to play".

## 1. Active Play Board
- Header bar: "Trial 1/12" with progress bar labelled "0 of 12 rounds complete", "Score 0", "Pause" button (top-right).
- In-card score chip: "Score 0".
- Active cue/rule: "Parity".
- Stimulus card: blue rounded square with white up-arrow "▲", badge number "4" (bottom-right of card).
- Prompt: "Pick the answer for this task".
- Answer buttons: "Even" (left), "Odd" (right).
- Instructions: visible (prompt text present). Board legible, clear hierarchy.
- 12 trials total (Trial x/12).

## 2. Scored Feedback
- Round 1 (Parity, stimulus 4): tapped "Even". Immediate reveal verdict = "Correct!" with subtitle: Matched "Even" under the Parity task.
- Chosen button highlighted green with a check; other button dimmed. Score updated 0 -> 100. "Next trial" button shown to continue.
- Round timer counts down (approx 10-15s); timeout reveal also accepted as feedback.
- Round 2 (Magnitude, stimulus 5): board showed "Magnitude" + subtitle "Task switched!" (rule change cue). Tapped "High" -> verdict = "Correct!" / 'Matched "High" under the Magnitude task.' Score 100 -> 200.
- Verdict screen also shows the chosen option converted to a "Correct: option N, <label>" row and the other to "Option N: <label>, locked".
- Round 3 (Magnitude, stimulus 5): tapped "High" -> "Correct!" / 'Matched "High" under the Magnitude task.' Score 200 -> 300.
- Round 4 (Magnitude, blue token, badge 6): tapped "High" -> "Correct!" / 'Matched "High" under the Magnitude task.' Score 300 -> 400.
- Round 5 (Parity, green token, badge 3, "Task switched!" back to Parity): tapped "Odd" -> "Correct!" / 'Matched "Odd" under the Parity task.' Score 400 -> 500.
- Round 6 (Magnitude, green circle token, badge 5, "Task switched!"): tapped "High" -> "Correct!" / 'Matched "High" under the Magnitude task.' Score 500 -> 600.
- Round 7 (Magnitude, red square token, badge 8): tapped "High" -> "Correct!" / 'Matched "High" under the Magnitude task.' Score 600 -> 700.
- Round 8 (Magnitude, green circle token, badge 9): tapped "High" -> "Correct!" / 'Matched "High" under the Magnitude task.' Score 700 -> 800.
- Round 9 (Magnitude, red square token, badge 1): tapped "Low" -> "Correct!" / 'Matched "Low" under the Magnitude task.' Score 800 -> 900.
- Round 10 (Parity, blue square token, badge 3, "Task switched!"): tapped "Odd" -> "Correct!" / 'Matched "Odd" under the Parity task.' Score 900 -> 1000.
- Round 11 (Parity, blue square token, badge 8): tapped "Even" -> "Correct!" / 'Matched "Even" under the Parity task.' Score 1000 -> 1100.
- Round 12 (Parity, green square token, badge 7, FINAL): tapped "Odd" -> "Correct!" / 'Matched "Odd" under the Parity task.' Score 1100 -> 1200. Final trial's advance button reads "See results" instead of "Next trial".

## 3. Pause & Resume
- Tapping "Pause" opened overlay: heading "Paused", subtitle "The challenge is hidden and the timers are frozen."
- Overlay buttons quoted: "Resume" (red/primary, left) and "Quit" (dark/secondary, right). No other controls.
- Timers frozen while paused (per subtitle); underlying board tree retained. Resumed via "Resume".

## 4. Final Result Screen
Post Round 12 ("See results") the RESULT screen showed: hero banner with a purple "Task Switch" mini-icon; headline "Strong run"; big score "1200"; stat rows: Accuracy 100%, Speed 0%, Switch accuracy 100%, Switch cost 0 ms, Best streak 12, Mistakes 0, XP 46. Reward block (green): "Reward  +46 XP · +9 coins" with sub-line "Progress saved". Buttons: "Play again" (red) and "Done".

## 5. Input & Exit
- Input: every answer/advance tap registered on first press during play (12/12 rounds answered in one tap each). The only re-issued taps were my own mis-scaled coordinates (target intercepted before execution), never the game ignoring a press. The ~10-15s round timer never obstructed input.
- Exit: RESULT screen "Done" -> Games list ("Games", "Browse all games", "Showing 42 of 42 games", chips "All 42"/"Memory 7"/"Attention 5"/"Speed 5", "Search games…" field). Safe exit confirmed.
- Return: searched "Task Switch" in "Search games…" -> "Showing 1 of 42 games" -> tapped the "Alternate / Task Switch / Learning" card -> Task Switch detail sheet with "Play Task Switch" -> landed back on this game's own intro screen: "Task Switch", "Flexibility", "Alternate between micro-tasks using the cue.", difficulty "Normal" selected, "Back to games", "Start game", "How to play". Safe return confirmed.

## 6. Defects
- No blocking app defects observed: no clipped/truncated text, no overlapping controls, no hidden or unreachable action, no unresponsive input. All 12 rounds, Pause/Resume, results and exit/return worked.
- Minor (data): RESULT screen shows "Speed 0%" directly beside "Accuracy 100%" and "Best streak 12" - an apparently empty/zero speed metric on a flawless run (possible metric bug or unlabelled unit).
- Minor (contrast): on verdict cards the unselected row ("Option N: <label>, locked") renders in very dim grey - low contrast against the dark card.
- Non-app note: 'adb shell uiautomator dump' repeatedly aborted with "Segmentation fault" right after the stat nodes (host tooling limitation, not an app defect); screenshots were used as the source of truth.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
