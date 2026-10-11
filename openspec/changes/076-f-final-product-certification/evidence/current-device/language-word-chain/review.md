# Current-device acceptance — `language-word-chain`

- Date: 2026-10-11T13:30:31+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-language-word-chain`
- ARTEMIS session: `09c150e7-0d32-4a8a-8e41-8b974c0eb2ef` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# Game State Review — language-word-chain (Word Chain)

## 1. Active Play Board
- Game title/identity: "Word Chain", category "Language". Mechanic: "Complete each word chain: every next word starts with the last letter of the one before it."
- Difficulty options on intro: Easy / Normal (selected) / Hard / Expert / Adaptive; "Start game", "How to play", "Back to games".
- Board header chips: "Round 1/6" (accessibility: "1 of 6 rounds complete", green progress bar), "Score 0", and a "Pause" button (top-right).
- Chain row 1: "bistro" | "o…" (highlighted active slot) | "arrow"
- Chain row 2: "wavelength" | "?" | "petal"
- Mid-board label: "Score 0"
- Timer chip: "Answer within 12s"
- Progress: "0 of 2 links filled"
- Answer options (buttons): "kettle", "omega", "honey", "whale"
- Instructions: mechanic not restated on board; only "Answer within 12s" + "0 of 2 links filled" guidance. Legibility: high contrast white text on dark; clear hierarchy (header chips > chain > timer > options).

## 2. Scored Feedback
- Verdict type: TIME-OUT reveal (round timer "Answer within 12s" expired).
- Exact verdict text: "Time's up" (amber headline)
- Reveal body: "The chain was bistro → omega → arrow → wavelength → hemp → petal" and '"omega" follows "bistro"'
- Correct answer highlighted: "Correct: omega" (option turned green with a ✓ checkmark); other options (kettle, honey, whale) shown locked/dimmed.
- No score awarded on timeout (Score remained 0).

## 3. Pause & Resume
- Opened via the board's "Pause" button (top-right of header) during Round 5/6.
- Overlay heading: "Paused"
- Overlay subtitle: "The challenge is hidden and the timers are frozen."
- Overlay buttons (literal): "Resume" (pink/red filled) and "Quit" (dark/grey).
- Board/chain + timer are hidden behind the overlay; timer frozen as stated. Resumed via "Resume".

## 4. Final Result Screen
- Header: "Keep training"
- "Final score" = 33 (large)
- "Accuracy" = 0%
- "Rounds correct" = 0/6
- "Best streak" = 1
- "Avg answer time" = 17.0s
- "XP" = 10
- Reward block: "Reward +10 XP · +2 coins" / "Progress saved"
- Buttons: "Play again", "Done"

## 5. Input & Exit
- Taps mostly registered immediately while the round was live: e.g. "rivulet" (R2 link1) and "yodel" (R4 link1) and "ash" (R5, right after Resume) all scored on the first tap (Score 0→11→23→33).
- Some answer taps lost the race with the ~12s round timer: "darrow", "labyrinth", "dorsal" arrived as/after the reveal, so the round timed out (no dead zones — the board stays responsive, the window is just short).
- One tap ("emblem") was intercepted before dispatch due to a mid-animation layout shift (option rows move between rounds).
- Exit: "Done" on the result screen returned cleanly to the Games list ("Games" tab, "Browse all games", "Showing 42 of 42 games"). No crash, no stuck screen.
- Return: after exit, searched "Word Chain" in the Games list and tapped its card — the game's detail page loaded correctly ("Word Chain", "Link each word to the next by its starting letter.", "Play Word Chain" button, Mastery: Learning). Safe exit and re-open confirmed; no crash, no stuck screen.

## 6. Defects
- No clipped text and no low contrast observed; chain words, option labels, chips and stats all fully rendered, white-on-dark with clear hierarchy.
- No hidden or unreachable action; every control (options, Pause, Resume, Quit, Next round, See results, Done, Play again) was reachable and did something.
- Minor: answer taps racing the ~12s round timer frequently landed at/after the reveal (darrow, labyrinth, dorsal), so points were lost even when the word was correct — the round window feels tight relative to the tap latency.
- Minor: option rows shift position between rounds (one tap was intercepted pre-dispatch due to a mid-animation layout move); confirming a mismatch of label vs slot if tapping during the transition.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
