# Current-device acceptance — `math-equation-builder`

- Date: 2026-10-11T14:51:21+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-math-equation-builder`
- ARTEMIS session: `138ce016-2f6d-4e8d-9547-5044493e2676` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# Game State Review — math-equation-builder (Brain Training)

Deep link: braintraining://game/math-equation-builder (cold start after force-stop). Identity CONFIRMED: title "Equation Builder", category Build / Math, mechanic "Build an equation using all the given numbers and operators to reach the target number."

## 1. Active Play Board
- Pre-game screen: "Equation Builder" (Build / Math), "Back to games", description quoted above, "Difficulty" selector with "Easy" / "Normal" (selected, red) / "Hard" / "Expert" / "Adaptive", "Start game" (red), "How to play".
- Live board after "Start game": header row chips "Round 1/5", "Score 0", timer "50s" (counts down), progress bar with "1 of 5 rounds complete", "Score 0", "Pause" button.
- Stimulus: "Target" = 43; equation row shows "? = ?".
- Controls (literal labels): number tiles "7", "6", "3", "2"; operators "+", "−", "×"; "Group ( )", "Undo", "Clear"; primary "Submit" (red).
- Instructions: no inline instruction text on the play board (only the pre-game description + "How to play"); nothing on the board explains the rule in-play.
- Legibility/hierarchy: dark theme, high contrast, target number in large red top-right, tiles in a clear 2-col number grid then operator row; hierarchy clear and legible.

## 2. Scored Feedback
Scored verdict (Round 1, target 43, equation 7 × 6 + 3 − 2): board turns green with a check circle and the exact texts "✓ Correct!" and "Correct!", plus the status line "Target was 43" and "Correct: 7 × 6 + 3 − 2 equals 43". Score chip advanced from "Score 0" to "Score 228". Action button offered: "Next round".

## 3. Pause & Resume
Incorrect variant (Round 2, target 50, typed "8 × 7 − 3 × 2"): feedback panel turns red-bordered and shows an ✗ icon with the exact strings "Wrong answer" (heading), "Your answer: 106", "Target was 50" and "Solution: 8 + ( 7 × ( 3 × 2 ) ) = 50", plus the action button "Next round". Note: the game evaluates left-to-right without operator precedence (8×7−3×2 = 106), so the intended solve needs the "Group ( )" control. Score still advanced 228 → 278.

TIMEOUT variant (Round 3, target 32, typed "7 − 3 × 2", never completed): on timer expiry the stimulus card turns red and a reveal panel appears with the exact strings "Time's up!" (heading), "Target was 32", "Solution: ( 7 − 3 ) × ( 2 × 4 ) = 32", plus the action button "Next round". Score chip stayed at "Score 278" (no timeout penalty observed).

Tapped the board's "Pause" button (top-right of header). Overlay appeared: title "Paused", subtitle (verbatim) "The challenge is hidden and the timers are frozen.", with two buttons: "Resume" (red/primary) and "Quit". The challenge board is hidden beneath the overlay and the round timer chips are hidden/frozen — confirms the timer freeze behaviour. RESUME was then tapped and returned to the live Round 2 board at the same timer value.

## 4. Final Result Screen
Reached after Round 5 via the "See results" button. Headline banner: "Keep going" with a tile-progress graphic. Verbatim stat block:
- "Final score" 778
- "Accuracy" 60%
- "Rounds passed" 3/5
- "Best streak" 2
- "XP" 25
Reward line (verbatim): "Reward  +25 XP  ·  +5 coins", with sub-line "Progress saved".
Actions offered: "Play again" (red/primary) and "Done" (secondary).
Round-by-round: R1 correct (7×6+3−2, target 43) → 228; R2 wrong (answer 106 vs target 50) → 278; R3 timed out (target 32) → 278; R4 correct (9×4+3−2, target 37) → 538; R5 correct (10×5−3+2, target 49) → 778.

Second confirmation run (re-open, all 5 rounds deliberately timed out): same screen layout, banner "Keep training", "Final score" 0, "Accuracy" 0%, "Rounds passed" 0/5, "Best streak" 0, "XP" 10, reward line "Reward  +10 XP  ·  +2 coins" with "Progress saved"; actions "Play again" (red) and "Done". The journey was ended on this second Final Result screen.

## 5. Input & Exit
- Input responsiveness: taps registered immediately whenever the target existed — number tiles "7"/"6"/"3"/"2"/"9"/"10"/"5", operators "+"/"−"/"×", "Group ( )", "Undo", "Clear" each added their token on the first tap, and "Submit", "Pause", "Resume", "Next round", "See results" and "Done" all reacted on the first tap with no perceptible lag. The single exception was the Round 3 "4" tile (3 taps, no effect — see heading 6).
- Exit: from the Final Result screen the "Done" button exited the game to the Games list tab — header "Games", subtitle "Pick a game to train a skill. New games appear here as they are added.", filter chips "All 42" / "Memory 7" / "Attention 5" / "Speed 5", "Showing 42 of 42 games", cards "Odd One Out", "Signal Watch", "Symbol Tracker", "Target Count". No crash, no blank or stuck screen.
- Return: typed "equation" into "Search games…" → "Showing 2 of 42 games" ("Equation Builder" Build/Learning, "Missing Operator" New); tapped the "Equation Builder" card → detail sheet (Build / Math, "Equation Builder", "Back to games", description, Difficulty "Normal", "Start game", "How to play"), then "Play Equation Builder" → the Equation Builder game screen re-opened cleanly with its own title, mechanic and controls intact. Safe exit and return both proven.

## 6. Defects
- Unresponsive input (reproduced, Round 3): the "4" number tile failed to register a tap on 3 consecutive attempts (single tap and 2-tap pair), so the equation never completed; the round had to be left to time out. The "2" tile and operators on the same board registered normally. Board state never showed the tile as consumed/disabled, so this reads as an intermittent missed-tap on the number grid.
- No clipped text, no low-contrast text, no overlapping or hidden/unreachable controls were observed; all score/timer chips and buttons were legible.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
