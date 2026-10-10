# Current-device acceptance — attention-odd-one-out

- Date: 2026-10-09T21:56:39.573Z
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35)
- APK under test: e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f (48,884,? bytes — see TERMINAL_IDENTITY.json)
- Harness: scripts/certification/... (ADB-driven, emulator-local input only), pass=pass1
- Registry identity: `Odd One Out` / `Attention`

## 1. Game identity

Detail screen `game-detail-title` = "Odd One Out" (registry name `Odd One Out`); identity VERIFIED.
Board resource-id namespace: `attention-odd-one-out.*` — 18 nodes found.

## 2. Active playable state

On-screen text: "Round 1/6", "Score 0", "Pause", "Time’s up", "The odd one is highlighted — it beat the clock this time.", "●", "●", "●", "●", "●", "■", "✓", "●", "●", "●", "Next round"

## 3. Scored feedback

| round | verdict | score |
| --- | --- | --- |
| Round 2/6 | Time’s up | Score 0 |
| Round 3/6 | Found it! | Score 100 |
| Round 3/6 | Found it! | Score 100 |
| Round 4/6 | Found it! | Score 125 |
| Round 4/6 | Found it! | Score 125 |
| Round 5/6 | Found it! | Score 200 |
| Round 5/6 | Found it! | Score 200 |
| Round 6/6 | Found it! | Score 250 |
| Round 6/6 | Found it! | Score 250 |
| — | — | 250 |

## 4. Pause / resume

Pause overlay text: "Round 2/6", "Score 0", "Pause", "Tap the odd one out", "11.5s", "●", "■", "●", "●", "●", "●", "●", "●", "●", "Paused", "The challenge is hidden and the timers are frozen.", "Resume", "Quit"
Resume returned to the board: yes.

## 5. Final results

Reached the result screen: yes
Result text: "Keep going", "Score", "250", "Accuracy", "67%", "First-try rate", "0%", "Rounds passed", "4/6", "Best streak", "4", "Timeouts", "2", "XP", "22", "Reward  +22 XP  ·  +4 coins", "Progress saved", "Play again", "Done"

## 6. Status

`PASS`
