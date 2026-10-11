# Current-device acceptance — `memory-pair-recall`

- Date: 2026-10-11T21:40:09+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-memory-pair-recall`
- ARTEMIS session: `c0e1a725-451f-48e4-8ea5-e73d2a7fb7f2` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

GAME UNDER TEST: memory-pair-recall (deep link braintraining://game/memory-pair-recall)
IDENTITY CONFIRMED (cold start): resource-id "memory-pair-recall.screen"/".intro"; title "Pair Recall"; category chip "Memory"; mark "game-identity-mark"; description "Learn which partner each shape is paired with, then recall the partners from cued prompts."
Intro controls: "Back to games" (memory-pair-recall.intro-back), "Difficulty" heading, difficulty text "Normal", radio options Easy / Normal (selected) / Hard / Expert / Adaptive, button "Start game" (memory-pair-recall.start).

## 1. Active Play Board
Cold-start board (memory-pair-recall, package com.braintraining.app, root id "memory-pair-recall.screen"):
- Memorize phase: cue "Memorize the pairs…" with one row of 3 pairs: red circle → H, purple diamond → D, teal triangle → N.
- Recall phase: prompt text "Which partner goes with red circle?" (id memory-pair-recall.recall-status), cue card showing "● → ?" (id memory-pair-recall.cue, content-desc mirrors prompt), cue progress dots content-desc "Cue 1 of 3" (id memory-pair-recall.progress).
- Round/score chips: "Round 1/5" (id memory-pair-recall.round.1) with a progress bar whose content-desc is "1 of 5 rounds complete" (id session-progress, fill id session-progress-fill); header "Score 0" (id memory-pair-recall.score); in-stage label "Score" with live value "0" (id memory-pair-recall.score-live).
- Controls (literal labels): button "Pause" (id memory-pair-recall.pause, content-desc "Pause", top-right); response buttons "H" / "N" / "D" in the palette (ids memory-pair-recall.response.4 / .8 / .1, content-desc "letter H"/"letter N"/"letter D").
- Instructions visible: yes — the recall prompt itself plus the memorize cue are shown on the board; no separate help overlay is open during play.
- Timer: no numeric timer chip is displayed; the board's green bar carries the session progress (content-desc "N of 5 rounds complete") and the Pause overlay states "the timers are frozen", confirming a per-round timer that freezes while paused.
- Legibility/hierarchy: clear — large round/score header, centered cue card, palette of three large letter buttons; high contrast white/lime on near-black; no clipping observed.
Round-1 end card (same board screen): heading "Not quite" (id memory-pair-recall.round-failed), subtitle "You recalled 2 of 3 partners (1 wrong pick)", pair-board recap "red circle goes with letter H", "purple diamond goes with letter D", "teal triangle-down goes with letter N", and button "Next round" (id memory-pair-recall.next-round).

## 2. Scored Feedback
Literal verdict text observed (green, in the feedback card below the palette): "Previous answer: Correct".
Context: after tapping "H" for cue 1 ("Which partner goes with red circle?"), the chosen "H" card got a green check badge and the alternatives "N"/"D" stayed unmarked; a "Previous answer: Correct" card re-showed "● → ?" with H checked. The board then advanced to the next cue "Which partner goes with teal triangle-down?".
Round-1 end verdict (exact): "Not quite" / "You recalled 2 of 3 partners (1 wrong pick)" with "Score 52".
Round-2 end verdict (exact): "All partners recalled!" / "You recalled 3 of 3 partners" with "Score 152".
Round-3 end verdict (exact): "All partners recalled!" / "You recalled 4 of 4 partners" with "Score 272".
Round-4 end verdict (exact): "All partners recalled!" / "You recalled 5 of 5 partners" with "Score 412".

## 3. Pause & Resume
PAUSE overlay (opened by tapping the "Pause" button during Round 1):
- Title: "Paused"
- Subtitle: "The challenge is hidden and the timers are frozen."
- Buttons (verbatim): "Resume" (red/primary) and "Quit" (dark/secondary)
The board is hidden behind the overlay while paused (timer frozen; backdrop blank).
RESUME CONFIRMED: tapped "Resume" — overlay dismissed and the live Round 1 board returned unchanged (cue + palette active), i.e. resume works and play continues.

## 4. Final Result Screen
Reached via Round 5/5 end card "See results" (id memory-pair-recall.restart/quit region; container id memory-pair-recall.result-*).
- Headline: "Strong run" (id memory-pair-recall.result-headline)
- "Final score" 572 (id memory-pair-recall.score-final)
- "Accuracy" 80% (id memory-pair-recall.accuracy)
- "Rounds passed" 4/5 (id memory-pair-recall.rounds-passed)
- "Best recall" 6 (id memory-pair-recall.best-recall)
- "Best streak" 4 (id memory-pair-recall.best-streak)
- "XP" 42 (id memory-pair-recall.xp)
- Reward box (id memory-pair-recall.reward), exact text: "Reward  +42 XP  ·  +8 coins", subline "Progress saved"
- Buttons: "Play again" (id memory-pair-recall.restart) and "Done" (id memory-pair-recall.quit)
Closing-run result screen (the note's end-state: reached again after the safe exit + re-open, by letting the rounds run out):
- Headline: "Keep training" (id memory-pair-recall.result-headline)
- "Final score" 103 (id memory-pair-recall.score-final); "Accuracy" 20%; "Rounds passed" 1/5; "Best recall" 3; "Best streak" 1; "XP" 16 (ids memory-pair-recall.accuracy / .rounds-passed / .best-recall / .best-streak / .xp)
- Buttons: "Play again" (memory-pair-recall.restart), "Done" (memory-pair-recall.quit)
- Reward banner on the closing run (id memory-pair-recall.reward), exact text: "Reward  +16 XP  ·  +3 coins", with the subline "Progress saved" (read off the rendered result screen; the uiautomator dump faults with SIGSEGV on this node).

## 5. Input & Exit
- Tap registration: immediate. Every answer-palette tap advanced the cue (or revealed "Previous answer: Correct") with the very next frame; the Pause, Resume, "Next round", "See results" and "Done" taps each took effect on the first press once aimed at the button's live centre. No dead or lagging taps observed; the only misses were my own mis-aimed coordinates, never an unresponsive control.
- EXIT CONFIRMED: tapped "Done" (id memory-pair-recall.quit) on the Final Result screen -> returned to the app's Games list ("Games" header, "Showing 42 of 42 games", bottom tab "Games" active). No crash, no back-stack trap.
- RE-OPEN CONFIRMED: tapped the "Pair Recall" card in the Memory-filtered games list -> the game's own detail/intro page returned intact (title "Pair Recall", chip "Memory", description "Learn which partner each shape is paired with, then recall the partners from cued prompts.", difficulty "Normal", "Start game", "How to play" text). No stale session state, no crash, no blank screen.
- Verdict: safe exit to the games list and return both work.
- Closing-run check: after the re-open I re-entered the session and every input (game start, cue taps, "Next round"/"See results") registered on the first press, taking the run again to the Final Result screen - no dead tap, no freeze, no crash.

## 6. Defects
- none observed of the clipping / low-contrast / overlap / unreachable-action class: board and Result-screen text rendered fully inside their containers (white/lime on near-black, clearly readable), no truncated labels, and every action used (Pause, Resume, Quit, "Next round"/"See results", "Play again", "Done") was visible and reachable.
- Layout friction (non-blocking, input-affecting): the answer palette changes its vertical position between the memorize beat and the recall beat of the same round (the cue card height changes), and in Round 5 with six options it wraps onto two rows (top G F D B N, second row L) with an empty slot in the 5-column grid, so fixed-coordinate taps repeatedly landed between buttons; each tap had to be re-aimed against the live element tree, and several taps were refused by pre-execution pixel validation for that reason. No control was ever actually dead.
- Input responsiveness: no unresponsive input - every correctly aimed tap registered on the first press; no stuck loading state and no crash at any point.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
