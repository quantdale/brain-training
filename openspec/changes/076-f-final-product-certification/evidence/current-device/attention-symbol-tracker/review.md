# Current-device acceptance — `attention-symbol-tracker`

- Date: 2026-10-10T10:36:37+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-attention-symbol-tracker`
- ARTEMIS session: `d084d3bb-645a-4452-838f-c92098b51b64` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 1 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

## 1. Active Play Board
_(board/stimulus content, every visible control and its literal label, round/score/timer chips, whether instructions are visible, whether the board is legible with clear hierarchy)_
- Findings (Round 1/5, captured T+~25m via screenshot + uiautomator dump):
  - Chips/header: "Round 1/5", "Track 2 symbols", thin green progress bar, "Score 0" chip, plus a board header row "Score" / "0". Progress bar a11y label "1 of 5 rounds complete".
  - Instruction prompt visible during play: "Memorize the highlighted symbols…" (game description on detail screen: "Watch which tokens are highlighted, then the board scrambles and adds distractors.").
  - Board: "Symbol Tracker board" — 3x3 grid, cells (content-desc): "Empty slot", "purple diamond" ◆, "emerald star" ✶, "red circle" ●, "Empty slot" x3, "green triangle" ▲, "blue square" ■, "violet ring" ⏺. During memorize phase the 2 tracked cells (green triangle, blue square) render with orange highlight; after scramble/distractors symbols relocate.
  - Only visible control during play: "Pause" button (id attention-symbol-tracker.pause).
  - Legibility: clear hierarchy (big round number, muted secondary text, high-contrast orange highlight on dark background); no clipping observed.

## 2. Scored Feedback
_(a correct/incorrect verdict OR a timeout reveal both count. Report the EXACT verdict text. An intro screen or unanswered board is NOT feedback)_
- Exact verdict text: "Not quite" (headline) / "You found 0 of 2 tracked symbols" (subline) — Round 1 timeout reveal (no answer tapped; timer expired).
- Reveal annotations on board cells: "Correct: blue square" and "Correct: green triangle" mark where the tracked symbols ended; remaining cells show their plain labels ("Empty slot", "emerald star", "purple diamond", "red circle", "violet ring").
- Later rounds (same verdict each time): R2 "Not quite" / "You found 0 of 2 tracked symbols (1 wrong pick)"; R3, R5 "Not quite" / "You found 0 of 2 tracked symbols"; R4 added the extra reveal line "Time ran out — your picks were submitted as they stood." with glyph board (◼ ✓ ✚ ♥ ✓ ▲ ✶).

## 3. Pause & Resume
_(open the PAUSE overlay, quote its buttons, then RESUME)_
- Pause overlay buttons (opened mid-game; overlay id attention-symbol-tracker.pause-overlay): title "Paused", subtitle "The challenge is hidden and the timers are frozen.", exactly two buttons — "Resume" (red, id attention-symbol-tracker.resume) and "Quit" (id attention-symbol-tracker.quit). NOTE: the overlay covers the whole screen and HIDES the challenge (timer frozen) — the underlying board is NOT visible while paused (a11y tree still exposes it).
- Resumed: YES — "Resume" dismissed the overlay and the game continued (Round 1 reveal -> "Next round" -> Round 2/5), confirming pause freezes and resume restores.

## 4. Final Result Screen
_(report every score/stat line and the reward exactly)_
- Stat lines (verbatim, each with a11y label): "Final score" = 0 | "Accuracy" = 0% | "Rounds passed" = 0/5 | "Best recall" = 0 | "Best streak" = 0
- Reward: "XP" = 10 (a11y "XP: 10")
- Headline: "Keep training". Buttons: "Play again" (id attention-symbol-tracker.restart) and "Done" (id attention-symbol-tracker.quit).

## 5. Input & Exit
_(did taps register immediately? then exit to the games list and re-open this game to prove safe exit and return)_
- Taps register immediately: YES — every tap took effect on first press: Games tab (nav switched), "Start game" (Round 1/5 launched), "Pause" (overlay opened), "Resume" (game continued), "Next round" (advanced each round), and a mid-round cell tap in Round 2 which instantly produced "You found 0 of 2 tracked symbols (1 wrong pick)" — proof the pick registered. No lag/double-taps needed. (Tool note: the `click` action tool rejected all target formats this session, so taps were issued as adb `input tap` — an environment workaround, NOT an app defect.)
- Exit to games list: from launcher, opened com.braintraining.app, tapped "Games" bottom-nav tab -> Games list ("Browse all games", "Showing 42 of 42 games", card id game-card-attention-symbol-tracker). Evidence: /sdcard/gameslist.xml + gameslist.png.
- Re-open proof: `am start -a android.intent.action.VIEW -d "braintraining://game/attention-symbol-tracker"` delivered to the running instance -> Symbol Tracker detail screen ("Symbol Tracker", "Track", "How to play", difficulty Easy/Normal/Hard/Expert/Adaptive, "Start game", "Back to games"); evidence /sdcard/relaunch.xml + relaunch.png. Tapping "Start game" began Round 1/5, proving safe exit and return.

## 6. Defects
_(clipped text, low contrast, hidden/unreachable action, overlap, unresponsive input - or 'none observed')_
- Findings:
  1. HIDDEN/UNREACHABLE ACTION (a11y): on Round 1's reveal screen ("Not quite / You found 0 of 2 tracked symbols"), the "Next round" advance button was absent from the UI tree for ~2 minutes — only "Pause" was exposed as clickable; "Next round" appeared in the tree only after the Pause overlay was opened. (Rounds 2-4 reveals exposed it normally.)
  2. Minor redundancy: header chip "Score 0" AND board header "Score / 0" both shown.
  - Otherwise none observed: no clipped text, no overlap, adequate contrast on the dark theme, timers froze correctly while paused, taps all responsive, no crashes.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
