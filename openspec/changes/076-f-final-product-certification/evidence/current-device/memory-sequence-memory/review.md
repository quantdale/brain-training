# Current-device acceptance — `memory-sequence-memory`

- Date: 2026-10-11T22:10:56+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-memory-sequence-memory`
- ARTEMIS session: `95d5acd9-2b9e-4021-b38b-f1be9c41ce5c` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# game_state_review_log — com.braintraining.app / memory-sequence-memory

Identity (cold start, deep link): title "Sequence Memory" (res-id memory-sequence-memory.screen), category chip "Memory", kicker "Repeat", description "Simon-style score attack: watch the pads light up, then repeat the pattern before the clock runs out." Intro controls: Difficulty Easy/Normal/Hard/Expert/Adaptive (Normal selected by default), "Start game", "How to play", "Back to games".

## 1. Active Play Board
Live after cold deep-link start (Normal difficulty). Screen res-id `memory-sequence-memory.screen`; focus com.braintraining.app/.MainActivity.
- Header chips: round chip "Sequence 1" (res-id memory-sequence-memory.round.1); countdown timer "0:38" (memory-sequence-memory.countdown, counts down); score chip "Score 0" (memory-sequence-memory.score); "Pause" button (memory-sequence-memory.pause, content-desc "Pause").
- Stage (res-id memory-sequence-memory.stage): inline label "Score" with live value "0" (memory-sequence-memory.score-live); instruction "Now repeat it" (memory-sequence-memory.input-status); progress indicator content-desc "0 of 3 matched" (3 dots, memory-sequence-memory.progress).
- Input pad (res-id memory-sequence-memory.input-pad, content-desc "Sequence Memory pad"): 2x2 grid of 4 square pad buttons, content-desc "Pad 1".."Pad 4" (memory-sequence-memory.tile.0 .. tile.3). Unlit pad colors seen: top-left dark maroon, top-right dark green, bottom-left dark yellow/olive, bottom-right muted pink/mauve.
- Instruction visible? Yes ("Now repeat it" status line; pads light up during the stimulus phase, then player repeats).
- Legibility/hierarchy: dark theme, high contrast, clear hierarchy (round/timer/score + Pause in a top card, stage label large, instruction left-aligned, pads dominant).
- Controls present: Pause (tappable), 4 pad buttons (tappable). No on-screen Back/Exit control during play.

## 2. Scored Feedback
Both a verdict and a timeout reveal were obtained.
- INCORRECT-ANSWER verdict (Sequence 1, Normal): a single tap on Pad 1 produced the verdict text EXACTLY "Wrong tap" (large salmon text), together with the correction reveal "Sequence length 3 — expected 2 · 4 · 2". The wrongly tapped pad was flagged "✕ Wrong pick: Pad 1" and the expected pad flagged "✓ Correct: Pad 2", and a "Next sequence" button appeared at the bottom. Progress dots stayed "0 of 3 matched"; "Score 0".
- TIMEOUT reveal (earlier run, no answer given): round countdown expired and the session ended on the result screen whose headline reads EXACTLY "Time's up!" (res-id memory-sequence-memory.result-headline). See §4.
- Verdict is on-board (inline status area), not a modal.

## 3. Pause & Resume
- Opened via the "Pause" button (memory-sequence-memory.pause) on the play board.
- PAUSE overlay (res-id memory-sequence-memory.pause-overlay) quotes: title "Paused" (memory-sequence-memory.pause-title); body "The challenge is hidden and the timers are frozen."; buttons "Resume" (memory-sequence-memory.resume, salmon/red filled) and "Quit" (memory-sequence-memory.quit, dark filled).
- While paused the board is hidden (only the overlay is shown); the overlay's "Quit" does NOT exit to the games list — it ends the attempt and shows the RESULT screen (see §5/§6).
- Timer-freeze probe: countdown read 0:17 on the pause screenshot and 0:13 in a dump ~10s later -> see §6.
- Resume: tapped "Resume" (memory-sequence-memory.resume); the board returned with the countdown running again and the same "Sequence 1" / "Score 0" chips — resume works.

## 4. Final Result Screen
Reached after round 1 timed out (res-id container memory-sequence-memory.results). Headline EXACTLY: "Time's up!" (memory-sequence-memory.result-headline).
Every score/stat line (label -> value, res-id):
- Final score -> 0 (memory-sequence-memory.score-final)
- Accuracy -> 0% (memory-sequence-memory.accuracy)
- Sequences passed -> 0/1 (memory-sequence-memory.rounds-passed)
- Best streak -> 0 (memory-sequence-memory.best-streak)
- Longest sequence -> 0 (memory-sequence-memory.longest-sequence)
- XP -> 10 (memory-sequence-memory.xp)
Reward (res-id memory-sequence-memory.reward) EXACTLY: "Reward  +10 XP  ·  +2 coins", with sub-line "Progress saved".
Buttons: "Play again" (memory-sequence-memory.restart) and "Done" (memory-sequence-memory.quit). Note: session = 1 sequence only (0/1).

## 5. Input & Exit
Input responsiveness: YES, taps register immediately. A single tap on Pad 1 (tile.0) was reflected on the very next frame with the "Wrong tap" verdict and the "✕ Wrong pick: Pad 1" / "✓ Correct: Pad 2" markers — no lag, no missed input. The 4 pads are large (approx 422x422 px each) so no precision issues. On-screen Pause button responds on first tap too.
Exit: on the result screen, "Done" (memory-sequence-memory.quit) navigated cleanly back to the in-app GAMES LIST — header "Games", subtitle "Pick a game to train a skill. New games appear here as they are added.", search field "Search games...", filter chips "All 42 / Memory 7 / Attention 5 / Speed 5", "Showing 42 of 42 games", game cards (Visual Search, Card Sort, Odd One Out, Signal Watch, Symbol Tracker, Target Count ...) and bottom nav Home / Games / Progress / Profile. No crash, no force-restart. Note: the pause overlay's "Quit" only ends the attempt (goes to the result screen); the actual exit to the list is the result screen's "Done".
Reopen (CORRECTED): the exit TO the in-app Games list worked cleanly (no crash). Re-opening via the LIST, however, did NOT land on memory-sequence-memory: from the "Memory 7" filtered grid I tapped the top-left card (kicker "Repeat", title "Memory", sub-label "Learning"), whose detail page read title "Memory" / "Play Memory" with description "Watch the tiles light up, then repeat the sequence from memory.". That opened a DIFFERENT game — resource-ids `memory.*`, header "Round 1/5" (memory.round.1) with a 5-step session progress bar, 3x3 board (memory.input-grid, memory.tile.0-8, content-desc "Tile 1".."Tile 9", board content-desc "Memory board"), progress "0 of 4 matched". That is the separate `memory` game, not the 2x2 `memory-sequence-memory` game ("Sequence 1", "Pad 1-4", "0 of 3 matched") this review targets. Return to the target game was therefore re-established via the objective's mandated cold deep link (see §6).

## 6. Defects
- Minor (timer, not frozen 100%): while the pause overlay claimed "the timers are frozen", the countdown chip read "0:17" on the pause screenshot but a `uiautomator dump` taken ~10 s later, still under the same pause overlay, read "0:13". Everything else froze correctly (overlay stayed up, board hidden). Either the chip refreshes once more after pausing, or the two captures were not simultaneous.
- Misleading label / indirect exit: the pause overlay's button is labelled "Quit" but it does NOT leave the game. It ends the attempt and shows the RESULT screen ("Time's up!"); exiting to the games list actually requires the result screen's "Done". "Quit" therefore does not do what its label implies.
- No on-screen Back/Exit control on the board during a round — "Pause" is the only escape (by design, but the exit path is indirect and undiscoverable without opening Pause).
- Clipped text: none observed. Overlap: none observed. Low contrast: none observed (dark theme with strong contrast; pads are large ~422x422 px and clearly lit). Hidden/unreachable action: none beyond the pause case above. Unresponsive input: none — a single pad tap produced a verdict on the very next frame, and Pause/Done/Play Memory all responded on the first tap.
- List navigation ambiguity / wrong-game routing: the Memory filter's top-left card (kicker "Repeat", title "Memory", sub-label "Learning") does NOT open memory-sequence-memory; its detail page ("Memory" / "Play Memory") leads to the separate `memory` game (res-ids `memory.*`, 3x3 board, "Round 1/5"). The two games ("Memory" and "Sequence Memory") are easily confused and the list offers no unambiguous way to identify/reach memory-sequence-memory — only the deep link resolves it.
- Instrumentation-only notes (not app defects): some `uiautomator dump` calls returned "ERROR: could not get idle state" or truncated output; the pre-execution safety net once flagged a "Done" tap as target-disappeared although the tap had in fact already navigated to the games list.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
