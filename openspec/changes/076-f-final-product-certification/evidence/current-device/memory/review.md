# Current-device acceptance — `memory`

- Date: 2026-10-11T20:47:42+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-memory`
- ARTEMIS session: `00cf229f-66f0-44be-b75f-720f5f743198` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# Memory game - current-device acceptance journey

## 1. Active Play Board
- Screen (round start): header row "Round 1/5" + thin green progress bar, "Score 0", and a "Pause" button (label "Pause") top-right.
- In-board score chip: label "Score" with value "0" (top-right inside board card).
- Instruction line (during stimulus): "Watch the sequence…" (visible).
- Board: 3x3 grid of 9 square tiles (a11y labels "Tile 1".."Tile 9"); tiles are dark rounded squares with a subtle outline; the lit tile is highlighted solid pink.
- Layout legible with clear hierarchy: round/score header above, instruction line, then the 3x3 tile grid. No clipping of the grid.

## 2. Scored Feedback
- Incorrect verdict after tapping the wrong first tile (Tile 1): headline verdict "Round failed" (large coral/red text) plus sub-line "Sequence length 4 — expected 8 · 1 · 2 · 3". The wrongly tapped tile (Tile 1) is marked with a red X; the correct first tile (Tile 8) is marked with a green check. Score chip remained "Score 0". A full-width "Next round" button appears to continue.
- (Round 1, Normal difficulty; sequence length 4; answer-phase prompt before the tap was "Now repeat it" with counter "0 of 4 matched".)
- Timeout/wrong-answer verdicts are the norm at Normal: Rounds 1–5 all ended in the identical verdict "Round failed" with the sub-line "Sequence length 4 — expected <4 numbers>" (e.g. Round 3: "expected 9 · 5 · 7 · 1"; Round 5: "expected 2 · 1 · 7 · 5"), always Score 0, with the wrongly tapped tile red-X'd and the correct first tile green-checked.

## 3. Pause & Resume
- Tapped "Pause" mid-round (during the stimulus of Round 2). PAUSE overlay shown: heading "Paused"; subtitle "The challenge is hidden and the timers are frozen."; two buttons: "Resume" and "Quit". The play board is hidden while paused (timer frozen). RESUME: tapped "Resume" -> the overlay closed, the board and the "Round 2/5" instruction reappeared, and the round continued. Note: the round timer freezes while the overlay is up (subtitle states the challenge is hidden and the timers frozen).

## 4. Final Result Screen
- Reached after Round 5 via the "See results" button (container resource-id "memory.results").
- Headline: "Keep training"
- Stat lines (label -> value): "Final score" -> 0; "Accuracy" -> 0%; "Rounds passed" -> 0/5; "Best streak" -> 0; "Longest sequence" -> 0; "XP" -> 10.
- Reward block: "Reward  +10 XP  ·  +2 coins" with sub-line "Progress saved".
- Buttons: "Play again" (resource-id memory.restart) and "Done" (resource-id memory.quit).

## 5. Input & Exit
- Input responsiveness: taps registered immediately - every play tap on the memory tiles, plus "Pause", "Resume", "Next round", "See results" and "Done", acted on the first vetted attempt with no perceptible lag or double-registration. (One exception was tooling-side, not device input: a safety-net interception of a stale "Next round" coordinate.)
- Exit: tapped "Done" on the Final Result screen -> returned to the Games list ("TRAIN YOUR BRAIN / Games / Pick a game to train a skill... / Browse all games / All 42 / Memory 7"; bottom tabs Home, Games, Progress, Profile).
- Return: re-fired deep link braintraining://game/memory -> Memory intro screen restored: badge "Repeat", title "Memory", description "Watch the tiles light up in sequence, then repeat the pattern from memory.", difficulty Normal, buttons "Back to games" / "Start game" / "How to play". Safe exit and return confirmed.

## 6. Defects
- none observed. All text fully rendered with no clipping, controls reachable and responsive, no overlapping/occluded action elements, and adequate contrast (lit tile clearly distinguished; verdict text legible).

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
