# Current-device acceptance — `spatial-grid-nav`

- Date: 2026-10-11T16:45:47+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-spatial-grid-nav`
- ARTEMIS session: `9aadc093-cdbe-4c6c-8210-f0d9cf14aad4` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 1 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# Game State Acceptance Review — spatial-grid-nav ("Grid Navigator")

Deep link: braintraining://game/spatial-grid-nav (fired from cold after force-stop). Identity CONFIRMED: title "Grid Navigator", category chip "Navigate", tag "Spatial", mechanic "A marker sits on a grid facing a direction."

## 1. Active Play Board
- Screen resource-id root: `spatial-grid-nav.screen`. Header row: "Round 1/7" (id spatial-grid-nav.round.1), a session progress bar (content-desc "1 of 7 rounds complete"), "Score 0" (id spatial-grid-nav.score), and a "Pause" button (id spatial-grid-nav.pause, content-desc "Pause").
- Board: 5x5 grid (id spatial-grid-nav.grid, content-desc "Game board"), bounds [97,485][983,1371]. Start marker "↑" (id spatial-grid-nav.start-marker), initial cell row5 col2.
- Stimulus (visible instructions): command list (id spatial-grid-nav.command-list) with literal text:
  "1. Turn left" / "2. Turn right" / "3. Move forward" / "4. Move forward" / "5. Turn right"
- Every visible control on the live board, literal labels: "Round 1/7" chip; progress bar; "Score 0" chip; "Pause" button; the command list rows above; a second "Score  0" label above the options; and the answer options grid (id spatial-grid-nav.options-grid) of 4 tappable option buttons (spatial-grid-nav.option.0..3), each rendering a 5x5 preview with content-desc e.g. "Option 1, cell row 3 column 2".
- Mechanism confirmed: marker starts at row5/col2 facing up; apply the 5-command sequence; pick the option whose highlighted cell = final marker cell.
- Instructions visible? Yes — the move list is on the board itself. Board is legible with clear hierarchy (header chips / board / command list / score / options). No separate on-board help panel (intro screen has a "How to play" button).
- Difficulty selector on intro/launch panel: "Easy" / "Normal" (selected, red) / "Hard" / "Expert" / "Adaptive"; buttons "Start game", "How to play", "Back to games".

## 2. Scored Feedback
- Round 1 verdict (EXACT text): **"Correct!"** (TextView id `spatial-grid-nav.round-correct`, inside container `spatial-grid-nav.round-result`). Alongside it: a green "✓" badge on the chosen option (option content-desc = "Option 1, cell row 3 column 2, correct", button disabled + selected), a green ✓ drawn on board cell row3/col2, and header Score 0 → 100.
- An advance control "Next round" (content-desc "Next round") is shown in the answered state, at the BOTTOM of the scrollable content (play-state bounds [97,2145][983,2271]).
- Later rounds (played manually):
  - Round 3/7 (Score 100, commands "1. Move back / 2. Turn left / 3. Move back / 4. Turn left", marker ↑ row1col3): answer Option 1 = cell row2col4 → green ✓, Score 100→200.
  - Round 4/7 (Score 200, commands "1. Move forward / 2. Turn left / 3. Turn left / 4. Turn right", marker ← row5col5): answer Option 2 = cell row5col4 → verdict EXACT text **"Correct!"**, Score 200→300.
  - Round 5/7 (Score 300, commands "1. Move back / 2. Move back / 3. Move forward / 4. Turn right / 5. Turn right", marker ↓ row3col2): answer Option 2 = cell row2col2 → verdict EXACT text **"Correct!"**, Score 300→400.
  - Round 6/7 (Score 400, commands "1. Turn right / 2. Turn right / 3. Turn right / 4. Move back"): verdict EXACT text **"Wrong!"** (chosen Option 1 cell row5col5, correct Option 2 cell row5col4, green ✓ row5col4); Score stayed 400.
  - Round 7/7: verdict EXACT text **"Correct!"** (Option 1, cell row 4 column 2 = correct); advance control then read "See results".
- Round 2 verdict (EXACT text): **"Wrong!"** (TextView id `spatial-grid-nav.round-wrong`, inside container `spatial-grid-nav.round-result`). Board showed a red ✗ at row2 col5 (the picked cell) vs a green ✓ target at row2 col3; header still "Round 2/7", Score 100. Round 2 command list: "1. Move back" / "2. Move back" / "3. Turn left" / "4. Turn left".
- No timeout reveal was ever triggered — every round was answered inside the timer window.

## 3. Pause & Resume
- Opened PAUSE overlay (id `spatial-grid-nav.pause-overlay`, covers play area bounds [42,199][1038,2337]).
- Title: "Paused" (id `spatial-grid-nav.pause-title`). Subtitle: "The challenge is hidden and the timers are frozen."
- Buttons (literal labels): **"Resume"** (id `spatial-grid-nav.resume`) and **"Quit"** (id `spatial-grid-nav.quit`).
- RESUME: tapped "Resume" → overlay dismissed and the play board returned unchanged (Round 1/7, Score 100). Reproduced twice (Round 1 answered state).

## 4. Final Result Screen
Reached after all 7 rounds (Round 7 advance button read "See results"). Result screen (id spatial-grid-nav.results):
- Headline (id result-headline): **"Solid work"**
- Main score: **500**
- Stat lines (id result-facts):
  - "Accuracy 71%"
  - "Speed 46048 ms"
  - "Long sequences 100%"
  - "Best streak 3"
  - "Mistakes 2"
  - "XP 33"
- Reward (id spatial-grid-nav.reward): **"Reward +33 XP · +6 coins"**, followed by the line **"Progress saved"**.
- Buttons on the screen: **"Play again"** and **"Done"**.
- Screenshot captured on device: /sdcard/final_result.png (128304 bytes).

## 5. Input & Exit
- Did taps register immediately? YES for all in-game controls: every answer-option tap, plus "Pause", "Resume", "Next round", "See results" and "Done" took effect on the FIRST dispatched tap (the board/verdict/advance changed on that same tap; no double taps needed).
- One exception, outside the game (Games list): the "Search games..." field did not focus/open the keyboard on the first tap; it needed a repeat tap before the keyboard appeared.
- Exit: from the final result screen I tapped "Done" → the game session exited (app left the resumed activity state; "Progress saved" had been displayed on the result screen). Re-launching com.braintraining.app returned to the app Home page (Today's Workout "4 games · about 8 minutes", "0/4 complete", Next: Mental Rotation) — no crash, no lost-state dialog.
- Return: Home → bottom-nav "Games" tab (header "TRAIN YOUR BRAIN" / "Games" / "Pick a game to train a skill.", chips "All 42" "Memory 7" "Attention 5" "Speed 5", "Showing 42 of 42 games") → tapped "Search games..." and typed "Grid" → "Showing 6 of 42 games" → tapped the "Grid Navigator" card (Navigate / Spatial) → game launch panel (title "Grid Navigator", tag "Spatial", desc "A marker sits on a grid facing a direction.", difficulty "Normal", buttons "Start game" / "How to play" / "Back to games") → tapped "Start game" → the game re-opened on a LIVE board: "Round 1/7", "Score 0", "Pause", 5x5 board with start marker "↓" at row4 col2, command list "1. Move back / 2. Turn left / 3. Move forward / 4. Turn right / 5. Move forward", options grid below. Safe exit AND safe return both proven on this device.

## 6. Defects
- Hidden / off-viewport action (main defect): in the answered (scored) state, the round-advance control "Next round" is NOT inside the playing viewport — it sits at the very bottom of the tall scrollable play content (play-state bounds [97,2145][983,2271]) and only became reachable after scrolling the whole board down; a user who does not scroll sees no way to continue to the next round.
- Unresponsive input (Games list only, not in-game): the "Search games..." field needed a second tap before it focused and showed the keyboard.
- Low contrast: empty board cells are faint dark-grey outlines on a near-black grid — the playable board reads as very dim until a cell is highlighted. Highlighted cells and the white marker arrow are legible, so this is cosmetic.
- No clipped text, no overlapping elements, no unreachable top-level navigation observed.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
