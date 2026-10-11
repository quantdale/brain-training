# Current-device acceptance — `language-sentence-builder`

- Date: 2026-10-11T19:21:33+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-language-sentence-builder`
- ARTEMIS session: `cbc3f5db-f592-471b-a8bb-c6fe653490ad` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# Game State Review — language-sentence-builder (Sentence Builder)

## 1. Active Play Board
- Header chips: "Round 1/5", "Score 0", progress bar labelled "1 of 5 rounds complete", Pause button (top-right).
- Card: "Score 0"; category caption "Idiomatic Expressions"; instruction "Tap the words below in the correct order…".
- Word chips (literal labels): the, under, He, feeling, was, weather.
- Controls visible: Pause button + 6 tappable word chips. No visible countdown timer chip.
- Instructions visible: YES. Legible with clear hierarchy (dark bg, cyan chips, white text) — no clipping observed on board.

## 2. Scored Feedback
- Verdict captured (Round 1, incorrect): heading "Round failed" with a red ✗ icon panel reading:
  - "Correct order: He was feeling under the weather"
  - "Tap the words in the order they read."
- Answer box shown with red border containing only "He". Button: "Next round". Score stayed 0.

## 3. Pause & Resume
- Pause button (top-right of board) opened a full-screen PAUSE overlay.
- Overlay title: "Paused"; subtitle: "The challenge is hidden and the timers are frozen."
- Overlay buttons (literal): "Resume" (red, left) and "Quit" (dark, right).
- Resume returned to the frozen board with the round/timer resumed.

## 4. Final Result Screen
- Header card: "Keep training" (with a mini sentence-board illustration).
- Stat lines (exact): "Final score 0"; "Accuracy 0%"; "Rounds passed 0/5"; "Best streak 0"; "Longest sentence 7 words"; "XP 10".
- Reward (exact): "Reward  +10 XP  ·  +2 coins"; below it "Progress saved".
- Buttons: "Play again" (red) and "Done" (dark).

## 5. Input & Exit
- Tap registration: immediate — a single "He" chip tap landed in the answer box instantly (Step 4); PAUSE / Resume / "Next round" / "See results" / "Done" all responded on the first tap.
- Exit: "Done" on the result screen returned cleanly to the "Games" list (header "Games", "Browse all games", "Showing 42 of 42 games"). No crash, no leftover overlay.
- Return: re-fired braintraining://game/language-sentence-builder; it landed on the Sentence Builder detail page (title "Sentence Builder", chip "Arrange", "Language", with a "Back to games" button now shown, "Start game", "How to play"). App process was never killed, so the intent was delivered to the running instance — the game re-opened reliably.

## 6. Defects
- Clipped/overlapping text: none observed; all chips, headings and verdict panels were fully legible.
- Contrast: fine — light word chips on dark card, red verdict panel clearly readable.
- Hidden/unreachable actions: none — Pause, Resume, Quit, Next round, See results, Done, Play again and Back to games all reachable. Minor note: the per-round countdown timer promised by "How to play" ("You get a category hint and a timer for each round") has no visible timer chip/digits on the play board; rounds still expired on their own after ~15s, so the timer runs but is not surfaced to the player.
- Overlap: none observed (the red crosshair seen on chips was the test-harness tap marker, not app UI).
- Unresponsive input: none — every tap registered on the first attempt.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
