# Current-device acceptance — `logic-deduction-table`

- Date: 2026-10-11T19:34:53+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-logic-deduction-table`
- ARTEMIS session: `51b66e05-fc19-40f4-bd47-0e616c77c8ad` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# Game State Review Log — logic-deduction-table (com.braintraining.app)
Journey on current device. Deep link: braintraining://game/logic-deduction-table (cold-started via force-stop + am start).

## 1. Active Play Board
Title on entry screen: "Deduction Table" under header "Infer · Logic & Problem Solving".
Mechanic description (entry screen): "Read a table of entities and a set of clues, then deduce the one value the question asks for before time runs out."
Entry screen controls (literal labels): "Back to games"; "Difficulty" selector with "Easy", "Normal" (selected, red), "Hard", "Expert", "Adaptive"; "Start game"; "How to play" section: "A table of entities and a set of clues appear. Use the clues to work out the one value the question asks for — and answer before the timer runs out."; "Try a demo".
Live board (Round 1/6, Normal):
- Round/score/timer chips: "Round 1/6" with green progress bar; "Score 0" (top) / "Score" panel with value "0"; timer chip "Answer within 26s".
- Controls: "Pause" button (top-right of board).
- Board: grid with columns "speed", "size", "shape" and rows "A", "B", "C" — all 9 cells show "?" (undeduced).
- Clues visible: "• B's shape is not triangle", "• B's shape is not heart", "• B's shape is not star", "• B's shape is not circle", "• B's speed is less than C's speed", "• B's speed is less than A's speed".
- Question: "What is B's shape?" with answer options: "heart", "square", "triangle", "circle", "star".
- Instructions: visible on entry screen ("How to play"); the live board shows the question + "Answer within 26s" but not the full instructions text.
- Legibility: high contrast (light text on dark background), clear hierarchy (round/score chip row > grid > clues > question > options); no clipped text seen. Deduction from clues: B's shape excludes triangle/heart/star/circle => square.

## 2. Scored Feedback
Round 1 ended by TIMEOUT. Exact reveal text: heading "Time's up" (amber card with clock icon) + sub-text "The answer was square"; correct option "square" highlighted green with "✓", others unhighlighted. Score stayed 0.
Round 2 (question "What is A's color?", answer yes=yellow): tapped "yellow" and got the EXACT CORRECT verdict — green card with "✓" icon and heading "Correct!", selected option "yellow" highlighted green with "✓". Score jumped 0 -> 133. Chip updated to "2 of 6 rounds complete". Both a timeout reveal (Round 1) and a correct verdict (Round 2) observed.

## 3. Pause & Resume
PAUSE overlay opened during live Round 1 via the "Pause" button. Overlay text: heading "Paused"; subtitle "The challenge is hidden and the timers are frozen."; buttons: "Resume" (red, primary) and "Quit". Timer frozen while overlay up (confirmed: board tree was captured beneath the overlay). RESUME: tapped "Resume"; overlay closed and the live Round 1 board returned with the timer running — resume works correctly.

## 4. Final Result Screen
Reached after all 6 rounds (tapped "See results"). Contents:
- Heading: "Solid work" (with a green trophy/medal illustration panel above).
- "Final score" = 625 (large centered number).
- "Accuracy" = 83%
- "Rounds correct" = 5/6
- "Best streak" = 5
- "Avg answer time" = 15.3s
- "XP" = 34
- Reward card (gold-highlighted): "Reward  +34 XP  ·  +6 coins" with sub-line "Progress saved" (literal text).
- Buttons: "Play again" (red) and "Done".

## 5. Input & Exit
Input latency: taps registered immediately. Every answer tap on the live board (Rounds 2–6: "yellow", "tea", "small", "large", "steady") was followed in the same turn by the scored verdict card, so selection registered on first tap. The advance control ("Next round") and the final "See results" button likewise advanced the round/screen on a single tap. No tap needed a repeat for the game's own controls.
Exit: from the result screen, tapped the right-hand button beside "Play again" (labelled "Done" in the accessibility tree, no visible caption) — the app returned cleanly to the Games list ("TRAIN YOUR BRAIN" / "Games" / "Browse all games" / "Showing 42 of 42 games" with filters "All 42", "Memory 7", "Attention 5", "Speed 5"). No crash or back-propagating screen.
Return: typed "Deduction" into the "Search games…" field → list filtered to "Showing 3 of 42 games" and showed the "Deduction Table" (Infer · Learning) card; tapping it re-opened the game detail page ("Deduction Table" / "Infer the requested value by chaining clues in the table." / "Play Deduction Table"). Safe exit and return proven; no data loss (Records showed "SESSIONS 1", "Last played Today", "BEST 59%", "AVERAGE 59%").

## 6. Defects
- Result screen: the button beside "Play again" has no visible on-screen caption (accessibility-tree name "Done"); it is a dark, unlabelled icon button — a mildly low-visibility action, though it was reachable and worked.
- No clipped text, no overlap, no hidden/unreachable action and no unresponsive input observed on the play board, pause overlay or result screen; hierarchy and contrast were clear throughout.
- Design note (not a defect): the live board does not repeat the "How to play" instructions; they are only on the entry screen.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
