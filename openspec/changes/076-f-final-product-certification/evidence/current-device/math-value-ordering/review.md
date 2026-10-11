# Current-device acceptance — `math-value-ordering`

- Date: 2026-10-11T15:24:22+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-math-value-ordering`
- ARTEMIS session: `47a607cf-d309-440b-b892-5909feaed7b0` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# Math Value Ordering - Game State Review Log
App: com.braintraining.app | deep link braintraining://game/math-value-ordering | cold-start confirmed via force-stop + am start (exit 0). On-screen identity: "Value Order" (Order · Math) — matches math-value-ordering.

## 1. Active Play Board
(Observed on live Round 1/10 board, math-value-ordering = "Value Order")
- Game title/mechanic on entry screen: "Value Order" with tags "Order" / "Math"; description: "Tap the values from smallest to largest before time runs out - some hide behind quick expressions."
- Round/score/timer chips: header shows "Round 1/10" + thin progress bar, "Score 0" below it, and a "Pause" button top-right.
- Board panel: label "Score" (panel top-left) with value "0" (panel top-right); instruction line "Tap from smallest to largest"; timer/count chip "10s left · 4 to go"; 4 tiles: 66, 18, 82, and an expression tile "6 − 2" (3 on top row + 1 centered below).
- Every visible control + literal label: "Pause" (button, top-right); four tappable value tiles "66", "18", "82", "6 − 2"; no other controls on the play screen.
- Instructions visible: YES ("Tap from smallest to largest").
- Legibility/hierarchy: dark theme, high-contrast white numerals on outlined dark tiles; clear hierarchy (header chips > instruction > tiles). Board is legible; stimulus tiles large and readable.

## 2. Scored Feedback
(TIMEOUT reveal captured at Round 1/10)
- Verdict headline (exact): "Time's up"
- Line 1 (exact): "Correct order: 6 − 2  <  18  <  66  <  82"
- Line 2 (exact): "Your order: no tiles placed yet."
- Action button (exact): "Next round"
- Rendered as a yellow-outlined card with an alarm-clock icon in the board area; header chips remained "Round 1/10" and "Score 0" (no score awarded on timeout).
- Note: 4 answer taps were dispatched against the four tiles but had not registered before the 10s timer expired (0 tiles placed), so the round resolved via timeout.

(CORRECT verdict captured at Round 2/10, tiles 7 − 3 / 81 / 71 / 30)
- Verdict headline (exact): "Perfect order!" (green check icon, green-outlined card)
- Line 1 (exact): "Correct order: 7 − 3  <  30  <  71  <  81"
- Line 2 (exact): "Your order: 7 − 3  <  30  <  71  <  81"
- Action button (exact): "Next round"
- Each correctly-placed tile gained a green check + position badge (1..4) and a green outline; chips updated to "Round 2/10" and "Score 103".
- Input registration: YES - one fast burst of 4 tile taps all registered in order and the round resolved instantly as correct.

(Further rounds - all resolved by TIMEOUT, identical reveal template: "Time's up" / "Your order: no tiles placed yet." / button "Next round")
- Round 3/10 (81 / 8 − 6 / 78 / 19): "Correct order: 8 − 6  <  19  <  78  <  81"
- Rounds 4-7/10: timed out; R7 tiles 18 / 32 / 6 × 9 / 94 -> "Correct order: 18 < 32 < 6 × 9 < 94"
- Rounds 8, 9, 10/10: timed out (R9: "Correct order: 11 < 23 < 4 × 8 < 62"; R10: "Correct order: 7 < 7 + 8 < 35 < 55"). Score stayed 103 throughout. Progress chip reached "10 of 10 rounds complete" and the card button changed from "Next round" to "See results".
- Expression tiles use − (minus) and × (multiply) e.g. "6 − 2", "7 − 7", "6 × 9", "7 + 8". Unplaced-tile accessibility labels read e.g. "Tile showing 18, not placed".

## 3. Pause & Resume
- Pause opened via the "Pause" button in the round header.
- Overlay quotes: heading "Paused"; subtitle "The challenge is hidden and the timers are frozen."; buttons: "Resume" and "Quit".
- Pausing hides the board panel entirely (timers frozen) - overlay is a full-screen dark scrim with the two buttons centered.
- RESUME: tapped "Resume" and the round board returned with its timer continuing (board/round state preserved).

## 4. Final Result Screen
(Reached after all 10 rounds, via the round-10 "See results" button)
- Top banner card: illustration + heading "Keep training"
- "Final score"  ->  103
- "Perfect rounds"  ->  1/10
- "Best streak"  ->  1
- "Best speed"  ->  5%
- "XP"  ->  12
- Reward block (exact): "Reward  +12 XP  ·  +2 coins" with sub-line "Progress saved"
- Buttons: "Play again" (red/accent) and "Done"

## 5. Input & Exit
- Tap registration: tile taps registered immediately when dispatched in one fast burst on Round 2 (4/4 placed in order, instant "Perfect order!"); the Round-1 burst was dispatched too late inside the 10s timer so nothing placed. Header "Pause", card "Next round"/"See results" and "Done" buttons all responded to a single tap.
- Exit: tapped "Done" on the Result screen -> app returned to the Games list (header "TRAIN YOUR BRAIN / Games", "Showing 42 of 42 games", bottom nav Home/Games/Progress/Profile with Games active). No crash, no stale board.
- Return: filtered the games list via "Search games..." with "Value Order" -> "Showing 1 of 42 games" -> opened the game detail page (title "Value Order", tags Order/Math, "Play Value Order" button, stats Sessions 3, Best 5%, Average 2%) and tapped "Play Value Order" -> the game's own intro screen reappeared and the game is playable again. Safe exit and return both confirmed.

## 6. Defects
None observed.
- No clipped or truncated text: the mechanic description, verdict lines, reward line and all stat labels render fully.
- Contrast/hierarchy acceptable in all states (board, verdict cards, Pause overlay, Result screen); verdict cards use colour + icon + text (yellow alarm = timeout, green check = correct), so colour is not the only cue.
- No hidden/unreachable actions: "Pause", "Resume", "Quit", "Next round", "See results", "Done", "Play again", "Start game" were all reachable in one tap.
- No overlapping elements or layout overlap in any captured state.
- Minor/ambiguous (not blocking): the timeout card reports "Your order: no tiles placed yet." even for taps dispatched right at the timer boundary (Round 1), so late taps are silently discarded without a distinct "too late" cue; and the play screen shows no per-round score breakdown, only the cumulative "Score".

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
