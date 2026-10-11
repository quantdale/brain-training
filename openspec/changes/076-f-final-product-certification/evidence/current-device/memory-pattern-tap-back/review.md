# Current-device acceptance — `memory-pattern-tap-back`

- Date: 2026-10-11T21:52:17+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-memory-pattern-tap-back`
- ARTEMIS session: `0fc03743-f5ee-4f3e-b5a7-7032cb7dfeaa` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

## 1. Active Play Board
- Game: **Pattern Tap Back** (com.braintraining.app, resource-id `memory-pattern-tap-back.screen`), category "Memory", tagline "Replay".
- Difficulty selected: **Normal** (options on intro: Easy / Normal / Hard / Expert / Adaptive).
- Active round header: **"Round 1/5"**, **"Score 0"**, 5-segment progress bar (1st segment green = round 1 of 5), right-side button **"Pause"**.
- Board panel: inline chip "Score" value **"0"**; instruction line **"Watch the sequence…"** (stimulus playback phase).
- Playfield: 3x3 grid of square tiles; top-middle tile lit pink during the watch phase (sequence cue).
- Intro screen (pre-play) showed: title "Pattern Tap Back", subtitle "Back to games" button, description "Watch tiles light up in a sequence, then tap them back in the same order.", "How to play" text, "Watch a demo" button, "Start game" button.
- Layout legible with clear hierarchy: round/score header, progress bar, instruction, grid.

## 2. Scored Feedback
- Round 1 verdict after tapping a tile: **"Round failed"** (red heading, id `memory-pattern-tap-back.recall-status` region).
- Detail line (EXACT): **"Sequence length 4 — expected 3 · 5 · 1 · 2"**.
- Per-tile feedback: tapped Tile 2 marked with a red ✗; Tile 3 showed a green ✓.
- Progress chip updated to **"1 of 5 rounds complete"**; Score stayed **"0"** (failed round = no points).
- A red **"Next round"** button appears to continue.
- Round 2 verdict: **"Round failed"** / "Sequence length 4 — expected 1 · 2 · 6 · 3" (green ✓ Tile 1, red ✗ Tile 5).
- Round 3 verdict: **"Round failed"** / "Sequence length 4 — expected 5 · 1 · 2 · 3" (Correct: Tiles 1,2,5; Wrong pick: Tile 7).
- Round 4 verdict: **"Round failed"** (score stayed 0).
- Round 5 verdict: **"Round failed"** / "Sequence length 4 — expected 9 · 5 · 6 · 3" (red ✗ Tile 5, green ✓ Tile 9); final button reads **"See results"**.

## 3. Pause & Resume
- Tapped the in-round **"Pause"** button (top-right of the round header, id `memory-pattern-tap-back.pause`).
- PAUSE overlay appeared (id `memory-pattern-tap-back.pause-overlay`), title **"Paused"** (id `…pause-title`), subtext **"The challenge is hidden and the timers are frozen."**
- Overlay buttons (verbatim): **"Resume"** (id `memory-pattern-tap-back.resume`) and **"Quit"** (id `memory-pattern-tap-back.quit`).
- Tapped **"Resume"** → returned to the live round; timers/board restored.

## 4. Final Result Screen
Header card: mini pattern-board graphic (3x3 mini grid, left column tinted) + title **"Keep training"**.
Stat lines (label → value):
- **Final score** → **0**
- **Accuracy** → **0%**
- **Rounds passed** → **0/5**
- **Best streak** → **0**
- **Longest sequence** → **0**
- **XP** → **10**
Reward box: **"Reward +10 XP · +2 coins"** with subtext **"Progress saved"**.
Buttons: **"Play again"** (red) and **"Done"**.

## 5. Input & Exit
- **Taps registered immediately**: recall tile taps took effect on the first touch (tile highlights + instant round verdict); "Start game", "Pause", "Resume", "Next round", "See results" and "Done" all responded to a single tap with no lag or double-tap. No unresponsive input observed.
- **Exit**: tapped "Done" on the final result screen → returned to the **Games list** ("TRAIN YOUR BRAIN / Games / Pick a game to train a skill..." with search field and filter chips **All 42 / Memory 7 / Attention 5 / Speed 5**). No crash, no black screen.
- **Return**: selected the **"Memory 7"** filter ("Showing 7 of 42 games"), tapped the **"Pattern Tap Back"** card (tagline "Replay", category "Learning") → the game's own intro/identity page re-opened cleanly: title **"Pattern Tap Back"**, category **Memory**, "Back to games", description "Watch tiles light up in a sequence, then tap them back in the same order.", Difficulty **"Normal"**, **"Start game"**, "How to play", "Watch a demo". Safe exit + re-open proven (same game, same deep link target).

## 6. Defects
- None observed. No clipped or truncated text, no overlapping UI, no hidden/unreachable action, no low-contrast illegible element, and no unresponsive input across the full journey (intro → 5 rounds → pause/resume → result → exit → return).
- By design (not a defect): the PAUSE overlay intentionally hides the board and freezes the timers ("The challenge is hidden and the timers are frozen.").

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
