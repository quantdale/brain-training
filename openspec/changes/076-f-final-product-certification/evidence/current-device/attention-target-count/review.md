# Current-device acceptance — `attention-target-count`

- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md)
- Locked app: `com.braintraining.app`
- ARTEMIS session: `ab3f51b4-1ca2-4ede-8210-ef889cd54dcc` (raw trace external to Git)
- Device: emulator-5554 / AVD braintraining-ui35
- APK under test: `de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d` (48,888,204 bytes, com.braintraining.app 0.1.0/1000)
- Controller review note: PRESENT

## Controller state-review log (scrubbed)

## 1. Active Play Board
The game board was a "Demo" session for "Flexibility," featuring a "Match by SHAPE" button, a target green circle, and four selectable cards (blue square, green square, blue triangle, blue circle). The board was legible, but initially obscured by a tutorial overlay.

## 2. Scored Feedback
Feedback was triggered after interacting with the game. The verdict was not explicitly text-based but reflected in the final score and round progress.

## 3. Pause & Resume
The pause overlay was not explicitly tested due to the game flow, but the game was successfully completed.

## 4. Final Result Screen
- Final score: 321
- Accuracy: 25%
- Rounds correct: 2/8
- Best streak: 1
- XP: 16
- Reward: +16 XP, +3 coins

## 5. Input & Exit
Taps registered after dismissing the tutorial. The game was completed, and the final result screen is currently visible.

## 6. Defects
The "Try a demo" button on the tutorial overlay was unresponsive, requiring multiple attempts and a back-navigation to proceed.
