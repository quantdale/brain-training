# Current-device acceptance — `attention-sustained-vigilance`

- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md)
- Locked app: `com.braintraining.app`
- ARTEMIS session: `ff0159eb-7a9e-4529-8c5b-35aa1874da90` (raw trace external to Git)
- Device: emulator-5554 / AVD braintraining-ui35
- APK under test: `de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d` (48,888,204 bytes, com.braintraining.app 0.1.0/1000)
- Controller review note: PRESENT

## Controller state-review log (scrubbed)

On-screen game title: Signal Watch

## 1. Active Play Board
Reached via deep link braintraining://game/attention-sustained-vigilance — a vigilance go/no-go stream on a dark theme. Start screen before the board: eyebrow "Watch", category chip "Attention", title "Signal Watch", "Back to games" button, rules "Numbers stream by one at a time — tap GO on every number, but hold your response when the stop number appears.", "Difficulty" / "Normal" with chips "Easy" / "Normal" (selected) / "Hard" / "Expert" / "Adaptive", red "Start game" and outlined "How to play".
Active play board (30-trial round, captured live at Trial 12/30): top panel with "Trial 12/30" (large bold) + green progress bar + "Score 524" at right; a dark "Pause" button directly beneath; main panel with "Score" label top-left and large "524" top-right, a large rounded stimulus box centered (shows the number big during a trial, e.g. "9"; only a small placeholder dot between numbers), the persistent rule line "Tap GO — hold on 8", and the large red "GO" button. Round/score chips stay visible at all times; the instruction line remains visible during play; the board is legible with clear hierarchy — white bold numbers/labels on dark charcoal, red reserved for the GO action. No clipped or unreadable content on the board.

## 2. Scored Feedback
not reached — no per-trial verdict text or timeout reveal could be captured on any frame. Real scored-feedback evidence that WAS observed: answers are scored — round 4's result shows "Go hits 2/26", "Mean reaction 497 ms", "Best streak 3", "Final score 764" (versus "Final score 480" for rounds with zero scored hits), and the in-play score chip advanced during the round ("Score 524" at Trial 12/30 versus "Score 120" at the same trial in an untouched round). Attempts: 7 GO taps across rounds 1, 3 and 4 (cap 10 taps / 2 rounds exceeded). Why the verdict text is missing: live screenshots always land 5–15 s after the tap while any banner appears sub-second, the session video is offline ("No active recording for device emulator-5554"), `uiautomator dump` segfaults on this device, and logcat contains no game/verdict strings (only system GC/HWUI noise). Per the declared cap this is recorded as 'not reached'.

## 3. Pause & Resume
Opened the PAUSE overlay mid-play via the board's "Pause" button. Full-screen dark overlay: title "Paused", subtitle "The challenge is hidden and the timers are frozen.", two buttons — red "Resume" (left) and dark "Quit" (right). The stimulus/challenge is indeed completely hidden behind the overlay. Tapped "Resume" (dead center of the red button): the overlay closed, but the round had already completed during the pause (see Defects), so the screen behind it was the Final Result screen rather than the live board.

## 4. Final Result Screen
Two real variants observed. Rounds 1–3 (zero scored hits): headline "Keep going" over a bar-chart hero card, then "Final score" / "480", rows "Go hits" 0/26, "Stop numbers held" 4/4, "Commissions" 0, "Mean reaction" —, "Best streak" 1, "XP" 22, reward card "Reward +22 XP · +4 coins" with "Progress saved" beneath, buttons "Play again" (red) and "Done" (dark). Round 4 (2 scored go hits): headline "Solid work", "Final score" / "764", rows "Go hits" 2/26, "Stop numbers held" 4/4, "Commissions" 0, "Mean reaction" 497 ms, "Best streak" 3, "XP" 30, reward card "Reward +30 XP · +6 coins" with "Progress saved", same "Play again" / "Done" buttons.

## 5. Input & Exit
Taps register immediately and are scored: every navigation tap ("Start game", "Play again", "Pause", "Resume", "Done", "Back to games", the "Signal Watch" game card, "Play Signal Watch") responded on the first tap with instant screen changes, and GO taps were scored with sub-second timing ("Go hits 2/26", "Mean reaction 497 ms"). Exit & return proof: from a result screen tapped "Done" → Home ("BRAIN TRAINING" / "Home", "Today's Workout 0/4"); opened the Games list and tapped the "Signal Watch" card → its detail page opened ("Play Signal Watch", "Add to favorites", Mastery 1 "Learning", Records: SESSIONS 7 / BEST 42% / AVERAGE 31%); tapped "Play Signal Watch" → the game start screen → "Start game" → live board again. Safe exit and return to the same game proven; the device is left on this game's Final Result screen.

## 6. Defects
1) Pause-timer freeze claim is false (functional defect): the PAUSE overlay states "The challenge is hidden and the timers are frozen." but the round clock keeps running while paused — the board was paused ≈2.5 s after round start (Trial ~1–2 of 30) and ≈70 s later, before any further input, the full 30-trial round had already finished (result screen showing "Go hits 0/26" and "Stop numbers held 4/4", i.e. all 30 trials evaluated). Score accrual corroborates: an untouched round shows "Score 120" at Trial 12/30, so a forfeit at Trial ~2 could never total "Final score 480". Consequence: "Resume" closed onto the Final Result screen instead of the live board.
2) No per-trial verdict/feedback text: responses are scored (score chip, "Go hits", "Mean reaction", streak) but the board shows no readable correct/incorrect verdict or timeout reveal; feedback appears score-only (or its banners are sub-second and unobservable).
3) No clipped text, low contrast, hidden/unreachable actions, visual overlap or unresponsive input observed on the start screen, play board, pause overlay or result screens (the accessibility tree's "may overlap" warnings on the result stat rows are semantics-row artifacts; the rendered rows are clean).
