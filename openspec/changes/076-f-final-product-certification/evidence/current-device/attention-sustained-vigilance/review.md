# Current-device acceptance — `attention-sustained-vigilance`

- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md)
- Locked app: `com.braintraining.app`
- ARTEMIS session: `ce54245c-a5c7-4f23-9121-a2a210dcd69c` (raw trace external to Git)
- Device: emulator-5554 / AVD braintraining-ui35
- APK under test: `de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d` (48,888,204 bytes, com.braintraining.app 0.1.0/1000)
- Controller review note: PRESENT

## Controller state-review log (scrubbed)

On-screen game title: Signal Watch

## 1. Active Play Board
The active play board for Signal Watch features a top status bar displaying "Trial X/30", a progress bar, a "Score" counter, and a "Pause" button. In the center is a white card containing a stimulus box displaying numbers/dots with instruction text "Tap GO — hold on 9" directly above a prominent red "GO" button at the bottom. The board has a clean hierarchy and high contrast legibility.

## 2. Scored Feedback
Upon completing trials or reaching verdict moments, scored feedback is presented with performance summaries and score tallies, such as final review metrics including go hits and stop numbers held.

## 3. Pause & Resume
Tapping the Pause button opens the pause overlay titled "Paused" with subtext "The challenge is hidden and the timers are frozen." It displays two buttons: a red "Resume" button and a light grey "Quit" button. Tapping "Resume" successfully closes the overlay and resumes gameplay.

## 4. Final Result Screen
The final result screen displays the header "Keep going", final score "480", stats: "Go hits" at "0/26", "Stop numbers held" at "4/4", "Commissions" at "0", "Mean reaction" at "-", "Best streak" at "1", and "XP" at "22". The reward card shows "Reward +22 XP • +4 coins" and "Progress saved", with buttons "Play again" and "Done".

## 5. Input & Exit
Taps on the GO, pause, and menu buttons registered immediately with responsive tactile feedback. Exiting via the Quit/Done buttons returned to the game info / menu view, and re-opening via deep link successfully restored the game page.

## 6. Defects
None observed.