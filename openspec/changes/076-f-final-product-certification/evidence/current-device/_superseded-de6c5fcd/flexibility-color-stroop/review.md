# Current-device acceptance — flexibility-color-stroop

- Date: 2026-10-09T21:58:43.703Z
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35)
- APK under test: e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f (48,884,? bytes — see TERMINAL_IDENTITY.json)
- Harness: scripts/certification/... (ADB-driven, emulator-local input only), pass=pass1
- Registry identity: `Color Stroop` / `Flexibility`

## 1. Game identity

Detail screen `game-detail-title` = "Color Stroop" (registry name `Color Stroop`); identity VERIFIED.
Board resource-id namespace: `flexibility-color-stroop.*` — 10 nodes found.

## 2. Active playable state

On-screen text: "Trial 1/15", "Score 0", "Rule: INK", "Pause", "Score", "0", "WALL", "⏱", "Time's up!", "It was red", "1500ms", "Next trial"

## 3. Scored feedback

| round | verdict | score |
| --- | --- | --- |
| — | — | Score 0 |
| — | — | Score 0 |
| — | — | Score 0 |
| — | — | Score 0 |
| — | — | Score 0 |
| — | — | Score 0 |
| — | — | Score 0 |
| — | — | Score 0 |
| — | — | Score 0 |
| — | — | Score 0 |
| — | — | Score 0 |
| — | — | Score 0 |
| — | — | Score 0 |
| — | — | Score 0 |
| — | — | Score 0 |
| — | — | Score 0 |
| — | — | Score 0 |
| — | — | Score 0 |

## 4. Pause / resume

Pause overlay text: "Trial 1/15", "Score 0", "Rule: INK", "Pause", "Score", "0", "WALL", "⏱", "Time's up!", "It was red", "1500ms", "Next trial", "Paused", "The challenge is hidden and the timers are frozen.", "Resume", "Quit"
Resume returned to the board: yes.

## 5. Final results

Reached the result screen: yes
Result text: "Keep training", "0", "Accuracy", "0%", "Correct", "0/15", "Best streak", "0", "Post-flip correct", "0", "XP", "10", "Reward  +10 XP  ·  +2 coins", "Progress saved", "Play again", "Done"

## 6. Status

`NOT VALIDATED`

Notes:
- only timeout verdicts were captured — no answer-scored verdict, so SCORED FEEDBACK is not accepted
