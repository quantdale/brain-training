# Current-device acceptance — `attention-odd-one-out`

- Date: 2026-10-08T13:53:20+02:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro`, locked app `com.braintraining.app`
- Test name: `cert076f-game-attention-odd-one-out`
- ARTEMIS session: `51ef7337-a0f3-4983-8ad3-0908fa5e1f39` (raw trace external to Git)
- Device: emulator-5554 / AVD braintraining-ui35
- APK under test: `de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d` (48,888,204 bytes, com.braintraining.app 0.1.0/1000)
- Controller exit code: 0
- Controller run outcome: `task_status=completed`, 17 recorded steps, 73 LLM calls

## Controller state-review log (scrubbed)

# Brain Training Game State Review Log (Attention: Odd One Out)

## 1. Active Play Board
- Stimulus / Tiles: 3x3 grid of tiles with triangles (▲) and one odd circle (●) in the center.
- Controls: Pause button, Round 1/6 counter, score display, timer (~11s countdown).

## 2. Scored Feedback
- Verdict / Description: "Time's up" - The odd one is highlighted — it beat the clock this time. Round 1/6, Score 0.

## 3. Pause & Resume Overlay
- Pause Overlay Rendered: Yes ("Paused" screen with "The challenge is hidden and the timers are frozen" message and "Resume" / "Quit" buttons).
- Resume Action Confirmed: Yes, successfully resumed back to active play board (Round 2/6).

## 4. Final Result Screen
- Screen: Result screen ("Keep training")
- Final Stats:
  - Score: 125
  - Accuracy: 17%
  - First-try rate: 17%
  - Rounds passed: 1/6
  - Best streak: 1
  - Timeouts: 5
  - XP: 12
  - Reward: +12 XP · +2 coins

## Reviewer independent check on the filed device frame

`result.png` was opened and inspected after the journey. The terminal frame shows
the same result the controller reported, item for item: Score 125, Accuracy 17%,
First-try rate 17%, Rounds passed 1/6, Best streak 1, Timeouts 5, XP 12, and the
reward card "Reward +12 XP · +2 coins" with "Progress saved". Controls are
reachable and legible: "Play again" is the single red CTA and "Done" is the
secondary neutral action, both clear of the reward card with no overlap. The
staged result artifact ("Keep training" on the charcoal stage panel above the
board art) is legible with clear hierarchy. No clipped text, low contrast, hidden
action, or unresponsive input was observed.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
