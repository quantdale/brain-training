# Current-device acceptance — `attention-visual-search`

- Date: 2026-10-10T13:10:29+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-attention-visual-search`
- ARTEMIS session: `9025bb1e-6f68-49da-af6b-7fc9e40d0071` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 1 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# Game State Review — attention-visual-search (Visual Search, Attention)

## 1. Active Play Board
- Board: 2×2 grid of 4 clickable tiles (content-desc "Tile 1"–"Tile 4") inside container "Visual search board"; each tile ~422px square, dark tiles on dark card.
- Header chips: "Round 2/12" (left), progress bar "2 of 12 rounds complete", "Score 0"; "Pause" button top-right.
- Status line: instruction "Find the odd tile" (top-left of stage); timer chip "1s left" (top-right of stage, live countdown).
- Full mechanic text only on intro screen ("Find the odd tile and tap it — fast, before the clock runs out."); in-board instruction is the short status line.
- Legibility: clear hierarchy (header → status/timer → board), good contrast, no overlap/occlusion; board fully legible.

## 2. Scored Feedback
- Round 1 verdict (timeout reveal), EXACT text: headline "Round failed"; reason "Time's up — the odd tile was tile 1".
- On reveal: odd tile highlighted in orange, all tiles disabled, "Next round" button appears; Score 0.
## 3. Pause & Resume
- Pause overlay opened mid-Round 2 (timer frozen at "1s left" beneath). Overlay buttons EXACTLY: "Resume" and "Quit".
- Overlay title "Paused"; subtitle "The challenge is hidden and the timers are frozen."
- Tapped "Resume": overlay closed, round continued, then timed out normally → play confirmed resumed.

## 4. Final Result Screen
- Headline (exact): "Keep training"
- Stat lines (exact, FINAL full session): "Score 0" | "Accuracy 0%" | "Rounds passed 0/6" | "Best streak 0" | "Avg response 0ms" | "Fastest response —" | "XP 10"
- Reward (exact): "Reward  +10 XP  ·  +2 coins"; below it "Progress saved"
- Buttons: "Play again", "Done"
- Context: this FINAL screen followed a complete 12-round session driven via timeouts (header advanced Round 1/12 → Round 12/12), yet "Rounds passed" reads 0/6. An earlier force-interrupted 2-round session showed the same screen with "Rounds passed 0/2" — denominator never equals 12. Reward identical (+10 XP · +2 coins) in both sessions.

## 5. Input & Exit
- Taps registered immediately: Pause, Resume, and Next round all responded on the first ADB tap; no repeated/stuck taps observed during play.
- Exit: results-screen "Done" closed the game to the Android home screen; relaunched app (Home tab) and opened Games tab — games list shows "Visual Search, Attention game, Learning".
- Re-open: tapped that list entry → game detail page ("Play Visual Search" button) → tapped Play → landed on this game's own intro ("Visual Search" / "Find the odd tile and tap it — fast, before the clock runs out."). Correct game returns on re-open.

## 6. Defects
- Results-screen "Rounds passed" denominator inconsistent with the 12-round session: completed 12/12 session reported "0/6"; interrupted 2-round session reported "0/2"; never 12.
- Identical full reward ("+10 XP · +2 coins", "Progress saved") granted for a 0%-accuracy all-timeout session AND for a force-interrupted 2/12 session; no interrupted/abbreviated-session indication on the summary.
- No clipped text, low contrast, overlap, or unresponsive input observed during play; all control taps (Pause, Resume, Next round, tile grid, buttons) registered on first attempt.


## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
