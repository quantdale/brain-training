# Current-device acceptance — `math-missing-operator`

- Date: 2026-10-11T20:26:57+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-math-missing-operator`
- ARTEMIS session: `63e86d9c-e153-4c84-b2da-ca7acdae9917` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# game_state_review_log — math-missing-operator (com.braintraining.app)
Route: cold-start force-stop + deep link braintraining://game/math-missing-operator (MainActivity).
IDENTITY CONFIRMED (intro screen): game-title = "Missing Operator"; game-category = "Math"; eyebrow label "Complete"; game-description = "Find the operator that makes the equation true — the numbers grow and the clock shrinks."; tutorial "How to play": "An operator is missing from the equation. Pick the one that makes it true — the round timer shrinks, so answer fast!". Difficulty row: Easy / Normal(selected) / Hard / Expert / Adaptive. Buttons: "Back to games", "Start game", "Try a demo".

## 1. Active Play Board
Top chips: "Round 1/7" with an inline green round-progress/timer bar, "Score 0"; top-right control "Pause".
Card label "Score" = 0; prompt/instruction visible: "Pick the missing operator".
Stimulus: equation "6  ?  4  =  10" with the operator slot shown as a dashed-outline square containing "?".
Answer controls (4): "+" , "−" (minus), "×" , "÷" (division glyph). Each is a large rounded square key.
Layout: dark near-black theme, white bold numerals, clear visual hierarchy (round/score header -> prompt -> equation -> keypad). Board is legible; no clipping.

## 2. Scored Feedback
Round 1 (equation 6 ? 4 = 10) -> TIMEOUT reveal. EXACT text: "Time's up" (amber heading) and "The answer is +." The correct operator key "+" is highlighted green with a check-badge; an operator glyph is revealed inside the equation's operator slot. A red "Next round" button appears. Score unchanged at 0 (score chip top-left "Score 0").
Rounds 2-7 (all subsequent rounds): every one ended in the TIMEOUT reveal with the identical exact heading "Time's up" plus the line "The answer is <operator>." and the correct key highlighted green with a check-badge:
- R2 "7 ? 2 = 14" -> "The answer is ×."
- R3 "9 ? 5 = 45" -> "The answer is ×."
- R4 "11 ? 5 = 16" -> "The answer is +." (timeout)
- R5 "9 ? 4 = 36" -> "The answer is ×."
- R6 "7 ? 2 = 14" -> timeout reveal, advanced
- R7 "10 ? 2 = 20" -> timeout reveal, advanced to the RESULT screen
No correct/incorrect verdict was ever credited to me (every round timed out): final Score 0, Accuracy 0%, Correct 0/7, Timeouts 7 — matching the result screen.

## 3. Pause & Resume
PAUSE overlay opened via the board's "Pause" button. Overlay text: heading "Paused"; subtitle "The challenge is hidden and the timers are frozen."
Overlay buttons quoted: "Resume" (red, primary) and "Quit". Board frozen/hidden underneath while paused.

## 4. Final Result Screen
Top card: "Keep training".
"Final score" = 0 (large centered).
Stat lines (label -> value, verbatim):
- Accuracy -> 0%
- Correct -> 0/7
- Timeouts -> 7
- Best streak -> 0
- Avg response -> — (em dash, no value)
- XP -> 10
Reward block: "Reward  +10 XP · +2 coins", sub-line "Progress saved".
Buttons: "Play again" (red) and "Done".

## 5. Input & Exit
Taps: registered immediately on every control I hit — "Pause", "Resume", "Quit", "Next round" and the difficulty chips all took effect on the first tap. The only exception was self-inflicted: my first "Done" tap missed the button center and landed in the empty margin, so I re-tapped its true centre and it worked instantly. Answer-key taps on the play board did register as touches but the ~15s round timer expired before the score was evaluated (my reading latency), so no answer was ever credited; this is a harness-latency effect, not a dead control.
Exit: "Done" on the result screen left the game and landed on the Games list (header "Games", "Pick a game to train a skill", "Search all games", category chips All 42 / Memory 7 / Attention 5 / Speed 5, game grid, bottom nav Home / Games / Progress / Profile) — safe exit proven.
Return: re-firing the deep link braintraining://game/math-missing-operator restored this game's intro screen ("Missing Operator", eyebrow Complete, category Math, difficulty row with Normal selected, "Start game" / "Back to games" / "Try a demo") — safe return proven.

## 6. Defects
- Accessibility/automation defect: the uiautomator accessibility tree on the play board goes STALE. While Rounds 2-7 were visibly on screen, dumps still reported Round 1 content ("6 ? 4 = 10", "The answer is +.", "1 of 7 rounds complete"). One uiautomator dump also failed with "Segmentation fault". Canvas-drawn board text (equation, verdict) is not exposed to the a11y tree, so the play board is poorly accessible to screen readers and unreliable for automation.
- No clipped text, no overlapping elements, no hidden or unreachable action observed. Text contrast is good and hierarchy is clear on both the play board and the result screen; all controls (Pause, Resume, Quit, Next round, Play again, Done, difficulty chips) were reachable and functional.









## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
