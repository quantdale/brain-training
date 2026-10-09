# Current-device acceptance — `flexibility-color-stroop`

- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (OpenDesign `mimo-v2.6-pro`, reasoning_effort low)
- Locked app: `com.braintraining.app`
- ARTEMIS session: `f478614e-fda1-478b-9d81-ddfe5bf00eda` (raw trace external to Git)
- Device: emulator-5554 / AVD braintraining-ui35
- APK under test: `de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d` (48,888,204 bytes, com.braintraining.app 0.1.0/1000)
- Controller review note: PRESENT (22 steps, 0 timeouts / 0 rate-limits / 0 circuit trips)

## Controller state-review log (scrubbed)

On-screen game title: Color Stroop

## 1. Active Play Board
The play board (dark theme, 1080x2400) has three layers. Header chips: "Trial 1/15" (round counter), "Score 0" (a "Score" label with a large live score number below it), and "Rule: INK" (the active rule mode), plus a slim timer/progress bar whose accessibility label reads "N of 15 rounds complete" and a "Pause" button (top-left in some trials, top-right in others — its position shifts between trials). Center stage shows one large color word, e.g. "BOOK" printed in green ink (Trial 1) or "GREEN" with content-desc "Word: GREEN, ink color: yellow" (Trial 3). The answer row is four color-chip buttons with literal labels beneath them: "red", "blue", "green", "yellow" (content-desc "Answer red" / "Answer blue" / "Answer green" / "Answer yellow"). After each trial a feedback card replaces the stage and a red "Next trial" button appears below it; the final trial's button is labeled "See results" instead. Instructions are NOT visible on the play board itself — the rules ("Identify the ink color of color words, tracking rule flips between 'ink' and 'word' modes.") appear only on the pre-game setup screen, which also carries "Back to games", "Difficulty" with options "Easy" / "Normal" / "Hard" / "Expert" / "Adaptive", "Start game" and "How to play". All board text was legible with strong contrast; no clipped or truncated labels observed.

## 2. Scored Feedback
Two answered trials produced scored feedback (exact verdict text):
- Trial 3 — stimulus "GREEN" in yellow ink, Rule: INK, tapped "Answer red" (wrong): red card with a ✕ icon reading "Wrong!" / "It was yellow" / "325ms".
- Trial 4 — stimulus "RED" in red ink, Rule: INK, tapped "Answer red" (correct): green card with a ✓ icon reading "Correct!" / "651ms".
The ms line is the measured response time (the pause-frozen counter proved it counts only active time). Unanswered trials instead show a gold ⏱ timeout card, e.g. "Time's up!" / "It was green" / "1500ms" — that is timeout feedback, not scored feedback.

## 3. Pause & Resume
Tapping "Pause" (during Trial 3's feedback card) opened a full-screen overlay hiding the challenge, titled "Paused" with caption "The challenge is hidden and the timers are frozen." and exactly two buttons: "Resume" (red, primary) and "Quit" (dark gray). Tapping "Resume" restored active play — the exact Trial 3 feedback card came back — and the response timer confirmed the caption's promise (timers frozen while paused; 651ms on Trial 4 counts only active time around the pause).

## 4. Final Result Screen
Reached via the "See results" button after Trial 15. A purple hero card (word-chain illustration with a swap icon) shows the headline "Keep training" and the big score "128". Stat lines exactly as displayed: "Accuracy" "7%", "Correct" "1/15", "Best streak" "1", "Post-flip correct" "0", "XP" "11". The reward is shown exactly as: "Reward  +11 XP  ·  +2 coins", with "Progress saved" beneath it. Two buttons: "Play again" (red) and "Done" (dark).

## 5. Input & Exit
Taps registered reliably whenever they landed on control centers: "Next trial" advanced every trial (1/15 → 15/15), "Answer red" registered in-window on Trials 3 and 4 (325ms and 651ms recorded), "Pause" and "Resume" registered immediately, "See results" opened the result screen, and the bottom-nav "Games" tab responded. One unresponsive edge case: a tap exactly on the "Next trial" button's outer bound edge (y=1536px) repeatedly did not register, while taps at the button center always did (no touch slop beyond the visual bounds). Exit path: tapping "Done" on the result screen did NOT go to the games list — it surfaced a different game's result screen ("Keep going", "Final score 480", "Go hits 0/26", "Stop numbers held 4/4", "Commissions 0", "Mean reaction —", "Best streak 1", "XP 22", "Reward  +22 XP  ·  +4 coins"). System BACK then reached the app Home ("BRAIN TRAINING" / "Home" / "TODAY" / "Today's Workout" / "0 of 4 complete" / "Next: Tap Rush" / "Start workout"), and the bottom-nav "Games" tab opened the games list ("TRAIN YOUR BRAIN" / "Games" / "Pick a game to train a skill. New games appear here as they are added." / "Search all games..." / "Browse all games" / chips "All 42", "Memory 7", "Attention 5", "Speed 5" / "Showing 42 of 42 games"). Re-opening via the deep link braintraining://game/language-word-chain launched the game's setup/intro screen again — but this time titled "Word Chain" (see section 6).

## 6. Defects
- Deep-link game/title mismatch and instability (major): at launch, braintraining://game/language-word-chain opened a setup screen titled "Color Stroop" (chips "Switch" / "Flexibility", description "Identify the ink color of color words, tracking rule flips between 'ink' and 'word' modes.") and its "Start game" launched the Stroop boards reviewed above (resource-ids flexibility-color-stroop.*, "Rule: INK"/"Rule: WORD" mechanics). On re-open, the exact same deep link now displays a different game's setup screen titled "Word Chain" (chips "Link" / "Language", description "Complete each word chain: every next word starts with the last letter of the one before it."). The Color Stroop run's result screen also used a word-chain-themed hero illustration, and its "Done" button surfaced a go/no-go-style result screen ("Keep going", "Final score 480", "Go hits 0/26", "Stop numbers held 4/4", "Commissions 0") — three different game identities surfaced from one game's screens. (The title line above therefore records "Color Stroop" — what was on screen at launch and throughout the reviewed journey — while the currently displayed intro reads "Word Chain".)
- Navigation defect: "Done" on the Final Result Screen routes to an unrelated game's result screen instead of the games list.
- Layout instability between trials: the "Pause" button moves between top-left and top-right, the timer/progress bar changes row, and the "Next trial" button shifts vertically with feedback-card height (2-line "Correct!" card vs 3-line "Time's up!" card), so fixed-coordinate taps miss; controls need re-discovery each trial.
- Very short 1500ms answer window: Trials 1–2 and 6–15 ended in "Time's up!" cards when interaction latency exceeded the window; combined with the dead edge-of-button zone, input timing feels brittle.
- No clipped text, low contrast, hidden actions, or visual overlaps observed: board, pause overlay and result screen were fully legible (accessibility-tree container nodes nominally overlap their stat rows, but the rendered rows are cleanly spaced).
