# Current-device acceptance — `attention-visual-search`

- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md)
- Locked app: `com.braintraining.app`
- ARTEMIS session: `244e5168-6b05-482f-8a08-f66d92d9aef1` (raw trace external to Git)
- Device: emulator-5554 / AVD braintraining-ui35
- APK under test: `de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d` (48,888,204 bytes, com.braintraining.app 0.1.0/1000)
- Controller review note: PRESENT

## Controller state-review log (scrubbed)

On-screen game title: Visual Search

## 1. Active Play Board
Active play board appears at game start (e.g. 2x2 grid in round 1, expanding in later rounds), showing Round counter (e.g. Round 1/12), Score counter (Score 0), a Pause button in top left/right, instructions "Find the odd tile", and a countdown timer bar (e.g. 4s left). Clean layout and clear visual hierarchy.

## 2. Scored Feedback
When a round fails (e.g., due to timeout), scored feedback appears stating "Round failed" with subtitle "Time's up — the odd tile was tile X" and the correct tile highlighted in orange/brown.

## 3. Pause & Resume
Opening the pause overlay displays the heading "Paused", subtitle "The challenge is hidden and the timers are frozen.", and two buttons: "Resume" and "Quit". Tapping "Resume" successfully resumes the game.

## 4. Final Result Screen
Displays "Keep training", Score: 0, Accuracy: 0%, Rounds passed: 0/4, Best streak: 0, Avg response: 0ms, Fastest response: —, XP: 10, Reward: +10 XP · +2 coins, and buttons "Play again" and "Done".

## 5. Input & Exit
Taps registered immediately. Exited to the games list and re-opened the same game via deep link / navigation to prove safe exit and return.

## 6. Defects
None observed.