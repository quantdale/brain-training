# Current-device acceptance — `math-fast-math`

- Date: 2026-10-11T15:04:11+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-math-fast-math`
- ARTEMIS session: `de2e46b4-062a-4c1f-abf7-54e7c7a703b0` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# Game State Review — math-fast-math (com.braintraining.app)

Identity (cold start, deep link braintraining://game/math-fast-math): hub showed chip "Solve" | "Math", title "Fast Math", description "Solve arithmetic problems against the clock — every problem is validated to have an exact, non-negative answer." Difficulty row Easy/Normal/Hard/Expert/Adaptive with Normal selected. Controls: "Back to games", "Start game", "How to play". => CONFIRMED correct game.

## 1. Active Play Board
Header bar: "Problem 1/5" + segmented progress bar (1 segment filled), "Score 0", button "Pause".
Stimulus card: large equation ("12 − 7 = ?", later "8 × 4 = ?", "10 + 6 = ?") above a blue horizontal round-timer bar (~10s).
Below: button "Clear"; numeric keypad keys "1","2","3","4","5","6","7","8","9", a backspace (⌫) key, "0", and a blue submit button bearing only a checkmark (no text label).
Instructions text: NOT visible on the play board (only on the hub via "How to play").
Legibility: dark theme, white high-contrast digits, clear hierarchy; the equation is the largest element.

## 2. Scored Feedback
Timeout reveal (round 1, equation 12 − 7): card shows a timer icon + "Time's up" (amber), the problem reprinted as "12 − 7 = −" with an empty answer slot, the line "The answer was 5", and a pink button "Next problem". Header unchanged: "Problem 1/5", "Score 0" (no point awarded for the timeout). Exact verdict text: "Time's up" / "The answer was 5".

## 3. Pause & Resume
PAUSE overlay (opened via "Pause" in the round header): title "Paused", subtitle "The challenge is hidden and the timers are frozen.", buttons "Resume" (pink primary) and "Quit" (dark secondary). Board behind is fully hidden. Tapping "Resume" closed the overlay and returned to the live round (header advanced to "Problem 2/5", equation "8 × 4 = ?" with the timer running) — resume confirmed.

## 4. Final Result Screen
Reached after all 5 problems (all timed out). Layout: illustration card captioned "Keep training" at top, then stat rows:
- Score  0
- Accuracy  0%
- Correct  0/5
- Best streak  0
- Fastest answer  — (em dash, none recorded)
- XP  10
The reward panel: "Reward  +10 XP · +2 coins" with sub-line "Progress saved" beneath it.
Buttons: "Play again" (pink) and "Done" (dark).
Replay check: a second completed run reproduced the identical screen (Score 0, Accuracy 0%, Correct 0/5, Best streak 0, Fastest answer —, XP 10, "Reward +10 XP · +2 coins", "Progress saved"), so these stat lines and the reward are stable/verbatim.

## 5. Input & Exit
Taps/typing register immediately: the games-list search box filtered live ("Showing 1 of 42 games" right after typing the query); the "Pause" tap opened the overlay at once; the "Resume" tap restored the round at once; the "Done" tap on the result screen landed and left the game.
Exit: from the FINAL RESULT screen, tapping "Done" returned to the app's Games list (header "TRAIN YOUR BRAIN" / "Games", subtitle "Pick a game to train a skill. New games appear here as they are added.", search box, filter chips, "Showing 42 of 42 games") — clean exit, no crash.
Return (re-open): searched "Fast Math" in the games list (query filtered live to "Showing 1 of 42 games", card "Fast Math"), tapped the card -> detail screen with "Play Fast Math" -> tapped it and the Fast Math game HUB reappeared intact (title "Fast Math", chip "Solve"/"Math", full description, Difficulty row Easy/Normal/Hard/Expert/Adaptive with Normal selected, "Start game", "How to play"). Re-opening the game after a clean exit therefore works; no crash and no lost state.

## 6. Defects
- Unresponsive input: none observed. Typing in the games-list search box filtered the list instantly ("Showing 1 of 42 games"), "Pause" opened the overlay immediately, "Resume" restored the round immediately, "Done" exited immediately, and the "Next problem" advance fired on every timeout.
- Clipped / truncated text: none observed — all labels ("Problem 3/5", "Score 0", "Time's up", "The answer was 5", "Reward +10 XP · +2 coins") render fully.
- Low contrast: none observed — white digits on dark cards and the blue timer bar on dark background are clearly legible.
- Overlap / occlusion: none observed on the play board or result screen; the on-screen keyboard covered the lower half of the games list while typing but did not hide the searched card (a minor, expected occlusion for a keyboard).
- Hidden / unreachable action (minor): the answer submit control is icon-only (a blue checkmark with no text label), so its purpose is not self-describing; the play board also carries no visible instruction text (guidance exists only via the hub's "How to play" and a first-play tutorial). The round timer is shown only as an unlabelled draining bar with no numeric countdown (minor).
- No crash, no frozen screen, and no failed screen transition during the whole journey.

JOURNEY SUMMARY: cold-start deep link braintraining://game/math-fast-math -> identity confirmed (Fast Math) -> board/controls recorded -> scored timeout feedback captured -> pause/resume verified -> all 5 rounds exhausted to the FINAL RESULT screen (all stats + reward recorded) -> clean exit via "Done" to the Games list -> re-open via search + card + "Play Fast Math" -> replayed to the FINAL RESULT screen again. Journey ends on the math-fast-math FINAL RESULT screen.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
