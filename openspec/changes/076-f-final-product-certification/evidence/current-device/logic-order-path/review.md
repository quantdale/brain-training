# Current-device acceptance — `logic-order-path`

- Date: 2026-10-11T19:55:03+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-logic-order-path`
- ARTEMIS session: `000c15ef-44c9-4657-9ae8-e26e4f20dbf9` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# Game State Review — logic-order-path ("Order Path")
Cold-start deep link confirmed: title "Order Path", tag "Place", category "Logic & Problem Solving", mechanic "Use the precedence clues to place every item in the one valid order."

## 1. Active Play Board
Board (logic-order-path.screen): header shows "Round 1/5", "Score 0", a session progress bar (content-desc "1 of 5 rounds complete"), and a "Pause" button (top-right).
Stage shows "Score" label + live score "0" (top-right of stage).
Clues panel titled "Clues" lists: "• E before G", "• E before C", "• E before A", "• G before D", "• G before A", "• D before C", "• C before A".
Instruction line visible: "Place each item in the only valid order."
Answer controls (all enabled, clickable buttons): "A", "C", "D", "E", "G".
Legible with clear hierarchy: dark card on dark bg, white text, red answer tiles; clues and instruction both visible; no clipping. Round timer is a thin progress bar next to "Round 1/5".

## 2. Scored Feedback
Round 1 timed out (no answer tap landed in time). Exact verdict text: "Time's up".
Timeout reveal also shows the solution line: "Solution: E → G → D → C → A", plus a red "Next round" button. (Reveal rendered as an amber-outlined card with a clock icon.)

## 3. Pause & Resume
Tapped "Pause" (logic-order-path.pause). Overlay (logic-order-path.pause-overlay) appears:
- Title: "Paused"
- Subtitle: "The challenge is hidden and the timers are frozen."
- Buttons: "Resume" (logic-order-path.resume) and "Quit" (logic-order-path.quit)
Timer froze while overlay was up (round timer paused).

## 4. Final Result Screen
Reached after Round 5/5 (all 5 rounds timed out). Top of screen: teal completion card with a mini board progress graphic (3 filled tiles) and a badge icon, heading "Keep training".
Stat lines (literal):
- "Final score" = 0
- "Accuracy" = 0%
- "Rounds correct" = 0/5
- "Best time" = — (em dash, i.e. no best time recorded)
- "XP" = 10
Reward block: "Reward  +10 XP · +2 coins" with subtitle "Progress saved".
Buttons: "Play again" (red) and "Done" (dark).

## 5. Input & Exit
Taps registered immediately: every answer-tile tap registered on the first attempt and the on-board tracker updated instantly (e.g. "1. C 2. B 3. E 4. G", "1. D 2. B 3. F 4. G", "1. A 2. G 3. C 4. F"). No tap required a repeat; the only taps that failed were ones issued after the round timer had already expired (tiles replaced by the "Time's up" card), i.e. timer-driven, not input lag. "Pause", "Resume", "Quit", "Next round", "Done" and "Play again" all responded to a single tap.
Exit: from the RESULT screen I tapped "Done" -> app returned to the Games list ("TRAIN YOUR BRAIN" / "Games" / "Pick a game to train a skill. New games appear here as they are added."). Safe exit confirmed.
Return: re-fired braintraining://game/logic-order-path -> the Order Path intro loaded again correctly ("Place" / "Logic & Problem Solving" / "Order Path", Difficulty "Normal", "Start game", "How to play", "Back to games"). Safe return/re-open confirmed.

## 6. Defects
None observed during normal play.
- No clipped or truncated text: every label ("Order Path", "Round n/5", "Score 0", clue lines, instruction, "Time's up", "Solution: ...", "Reward +10 XP · +2 coins", all stat lines) rendered fully.
- Clear hierarchy/contrast: white/grey text on dark cards, red answer tiles and red primary buttons; the "Clues" panel and instruction line are both visible on the board at once.
- No overlap: the "Time's up" reveal card intentionally covers the answer grid, and the pause overlay intentionally covers the board — both by design, with the Pause/Resume state clearly labelled.
- No hidden/unreachable action: Pause, Resume, Quit, Next round, Done and Play again were all reachable and clickable.
- No unresponsive input: all taps landed on first attempt (see Section 5).
Minor observations (not UI defects): (a) the ~15 s per-round timer allows very little time to place a 5-item order, so a round is easy to lose purely to the clock; (b) the round-timer progress bar and the small "Score 0" chip are low-emphasis. Tooling note: the on-device `uiautomator dump` repeatedly printed "Segmentation fault" and truncated the node tree; this affected the dump tool only, not the app UI.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
