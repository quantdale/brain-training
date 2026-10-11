# Current-device acceptance — `spatial-transform-match`

- Date: 2026-10-12T00:45:18+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-spatial-transform-match`
- ARTEMIS session: `ca32e6df-1b23-4921-ae03-15cb09acebcc` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# spatial-transform-match acceptance journey (deep link braintraining://game/spatial-transform-match, cold start T+01:38)

## 1. Active Play Board
Game identity confirmed on entry page: badge 'Transform' / category 'Spatial', title 'Transform Match', description 'A grid pattern is transformed — pick the correct rotated or mirrored version from the options.', difficulty chips Easy / Normal / Hard / Expert / Adaptive, button 'Start game', 'How to play' text ("You'll see a grid pattern briefly — memorize it. The source then hides: work out which transform was applied and pick the option showing the transformed version.") and button 'Try a demo'. Difficulty selected: Adaptive.
Play board (resource-id spatial-transform-match.screen) controls & labels:
- Round chip: 'Round 1/6' (spatial-transform-match.round.1); progress bar content-desc '1 of 6 rounds complete' (session-progress / session-progress-fill)
- Score chip: 'Score 0' (spatial-transform-match.score)
- Button: 'Pause' (spatial-transform-match.pause, top-right)
- Phase 1 'Study the pattern...' — 3x3 source grid shown (green cells R1C1, R1C3, R3C3), no options yet
- Phase 2 prompt: 'Which grid is transformed correctly?' (spatial-transform-match.choice-status) + sub-instruction 'The source pattern was shown briefly — recall it, work out the transform, and pick its result.'
- Live score row labels: 'Score' + '0' (spatial-transform-match.score-live)
- Answer controls: large tappable option buttons, 'Option 1' (spatial-transform-match.option.0) and 'Option 2' (spatial-transform-match.option.1), each containing a 3x3 'Pattern grid' whose cells expose content-desc 'Row r column c filled/empty'. Rounds 4-5 showed THREE options (Option 1 / Option 2 / Option 3, content-desc 'Option 1, wrong pick' / 'Option 2, correct' / 'Option 3').
- Continuation control after a round: pink button 'Next round' at the bottom of the board (only rendered when the board is scrolled to the bottom); on the last round it becomes 'See results'.
Instructions ARE visible on the board (prompt + explanation line). Board legible: dark card, neon-green filled cells, high contrast, clear hierarchy (round/score/pause header, then prompt, then options).

## 2. Scored Feedback
Tap on 'Option 1' (spatial-transform-match.option.0) produced an immediate scored verdict on the same board: large green text 'Correct!' plus the transform explanation line 'Rotate 180°' under the prompt, the chosen option grid outlined in green with a green circular check badge, and the header score chip updating from 'Score 0' to 'Score 100'. Exact verdict text: 'Correct!' (sub-text 'Rotate 180°').
Further verdicts observed in the same session: 'Correct!' with 'Rotate 270° clockwise' (Round 3, Score 100 -> 200); 'Wrong!' with 'Rotate 180°' (Round 4, chosen option outlined red with an X badge, the correct option revealed outlined green with a check badge, Score unchanged 200); 'Wrong!' with 'Rotate 270° clockwise' (Round 5, Score unchanged 200); 'Correct!' with 'Rotate 180°' (Round 6, Score 200 -> 300). Rule: correct = +100, wrong = +0.

## 3. Pause & Resume
Tapping 'Pause' (top-right of the game header) opened a full-screen dark overlay. Literal text on it: title 'Paused', subtitle 'The challenge is hidden and the timers are frozen.', and exactly two buttons: 'Resume' (pink/red filled) and 'Quit' (dark). The board/options were hidden beneath the overlay and the round timer froze (dump confirms Round 1/6, Score 100 still intact). Tapped 'Resume' -> overlay closed and play continued from the same round/score (no score or round reset).

## 4. Final Result Screen
Reached after Round 6/6 by tapping the bottom pink button, which on the final round reads 'See results'. Every literal line on the screen:
- Masthead: large "Keep going" heading, with a green-bordered summary card above it holding the round icon and a row of five small step markers (first one gold).
- Big total score: '300'
- Stat rows (label -> value): 'Accuracy' -> '50%'; 'Rounds passed' -> '3/6'; 'Best streak' -> '1'; 'XP' -> '26' (dump content-desc: 'Accuracy: 50%', 'Rounds passed: 3/6', 'Best streak: 1', 'XP: 26')
- Reward panel: 'Reward  +26 XP  ·  +5 coins' with sub-line 'Progress saved'
- Actions: button 'Play again' (pink/red filled) and button 'Done' (dark)

## 5. Input & Exit
Input: taps registered immediately throughout — every option tap produced an instant on-board verdict (verdict text + score chip updating in the same frame), the 'Pause' tap opened the overlay at once, and 'Resume' closed it at once. No tap had to be repeated and no dead zone was found (a single missed tap on the result screen was my own mis-estimated coordinate at [417,780] while the real button row sits at y≈690-743, not a responsiveness fault; a second, index-targeted tap worked first time).
Exit: tapping 'Done' on the result screen left it and returned to the Games list — header 'Games' / 'Browse all games', chips 'All 42' 'Memory 7' 'Attention 5' 'Speed 5', line 'Showing 42 of 42 games', tiles 'Odd One Out', 'Signal Watch', 'Symbol Tracker', 'Target Count', bottom nav Home / Games / Progress / Profile. No crash, no residue of the game screen.
Return: typed 'Transform' into the 'Search games...' field -> 'Showing 1 of 42 games' with the 'Transform Match' tile; tapped the tile -> its detail page ('Transform Match', 'Spatial', 'Transform the grid by rotation or reflection, then choose the match.', button 'Play Transform Match'); tapped 'Play Transform Match' -> the game entry page rendered again ('Back to games', 'Difficulty Normal', chips Easy/Normal/Hard/Expert/Adaptive, 'Start game', 'How to play', 'Try a demo'). Safe exit AND safe return proven.

## 6. Defects
- Hidden action: the between-round continuation button ('Next round' — 'See results' on the final round) is rendered below the fold of the board and is ABSENT from the accessibility tree until the board is scrolled to the bottom; guessed-coordinate taps land inside the puzzle grids instead. Reproduced in every round (1-6) and the only reason it took many turns to advance.
- No numeric round timer: the round countdown is only a very thin progress line under the header; there is no visible seconds value, so remaining time is hard to read (the timer also freezes under Pause, as stated on the overlay).
- Premature prompt: during the 'Study the pattern...' phase the header already reads 'Which grid is transformed correctly?' although no answer options are on screen yet.
- Stale accessibility bounds: the element tree repeatedly lagged one state behind the live screen (the pause overlay's 'Resume'/'Quit' bounds were stale and had to be re-targeted), and 'uiautomator dump' segfaulted (exit 139, 'Segmentation fault') intermittently — a harness/tree-readability issue, not a visual one.
- Otherwise: no clipped text, no overlap, no low contrast (dark card with neon-green tiles and pink CTAs) and no unresponsive control observed.


## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
