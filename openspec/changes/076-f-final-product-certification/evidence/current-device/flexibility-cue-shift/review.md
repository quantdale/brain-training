# Current-device acceptance — `flexibility-cue-shift`

- Date: 2026-10-11T18:39:14+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-flexibility-cue-shift`
- ARTEMIS session: `a101cf94-1086-4148-9eeb-cb7a4802856f` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# Game State Review Log — flexibility-cue-shift ("Cue Shift")
App: com.braintraining.app | Deep link: braintraining://game/flexibility-cue-shift | Difficulty: Normal
Intro screen (pre-play): Title "Cue Shift", category chip "Flexibility", desc "A rule cue changes every trial — read it, then match the target by color, shape, or number." Buttons: "Back to games", difficulty selector (Easy/Normal/Hard/Expert/Adaptive), "Start game", "How to play".

## 1. Active Play Board
Top bar: "Trial 1/10" + a horizontal progress bar (empty at start), a "Pause" button (top-right). Left chips: "Score 0" (top) and in-card "Score 0".
Rule cue chip (large): "Match by color".
Stimulus/target card: a BLUE TRIANGLE with a small badge number "4" at its bottom-right.
Instruction line: "Pick the matching card".
Answer cards (4): "blue circle 3", "red square 1", "green triangle 2", "green square 2" (each card = shape+color with a numeric badge).
Instructions visible: YES — rule cue ("Match by color") and task prompt ("Pick the matching card") both shown.
Legibility/hierarchy: clear; good contrast; rule cue is largest and centered, target above, answers in a grid below. No clipping.

## 2. Scored Feedback
Round 1 (Match by color, answered correctly): verdict headline "Correct!" (green, animated), sub-line "Matched by color: blue triangle 4", chosen card marked with a green check + label "Correct: blue circle 3". Score jumped 0 -> 100; top progress bar advanced to "1 of 10 rounds complete". A "Next trial" button appeared to continue.

## 3. Pause & Resume
Tapping the "Pause" button opened a full-screen dark overlay. Heading: "Paused". Sub-line: "The challenge is hidden and the timers are frozen." Buttons (2): "Resume" (red, left) and "Quit" (dark, right). The board/stimulus is fully hidden beneath the overlay. Tapping "Resume" returned to the live board with Trial/Score state intact and the round timer restarting.

## 4. Final Result Screen
Full result screen after Trial 10/10 (all 10 rounds answered, all "Correct!").
- Top chip: "Score" = 1000
- Card header: "Strong run"; card graphic with purple highlight bar
- Large stat: "1000"
- "Accuracy  100%"; "Speed  0%"; "After rule switches  100%"; "Best streak  10"; "Mistakes  0"; "XP  42"
- Reward banner (green): "Reward  +42 XP  ·  +8 coins" with sub-line "Progress saved"
- Buttons: "Play again" (red), "Done"
All text fully legible, no clipping.

## 5. Input & Exit
Input: every tap registered immediately — all answer-card taps (blue circle 3, blue triangle 2, blue square 4, red triangle 1, blue circle 4, green square 4, green square 4, green circle 1, green triangle 4, red circle 3), "Next trial", Pause, Resume and "See results" dispatched on the first attempt with a verdict/transition on the very next frame. No lag, no double-tap or missed-touch observed.
Exit: tapped "Done" on the result screen -> returned cleanly to the Games list ("Games" screen, filter chips All 42 / Memory 7 / Attention 5 / Speed 5, "Showing 42 of 42 games", cards Odd One Out, Signal Watch, Symbol Tracker, Target Count...). The result screen was dismissed without error.
Return: re-fired the deep link braintraining://game/flexibility-cue-shift from the Games list ("done" intent delivered to the top-most instance); the app returned to the Cue Shift intro screen with title "Cue Shift", category "Flexibility", the description "A rule cue changes every trial — read it, then match the target by color, shape, or number.", difficulty "Normal" highlighted, and "Start game"/"How to play" buttons — safe exit and return confirmed, no crash or data loss.

## 6. Defects
none observed — all four answer cards and the "Pause"/"Next trial"/"See results" controls were fully visible and reachable; text (titles, verdicts, stat rows, reward banner) was legible with no clipping; the "Cue switched!" notice and rule heading gave clear hierarchy; contrast between cards, verdict text and background was adequate; no overlapping UI or unresponsive input occurred.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
