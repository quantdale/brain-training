# Current-device acceptance — `spatial-mental-rotation`

- Date: 2026-10-11T23:11:51+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-spatial-mental-rotation`
- ARTEMIS session: `93ae4bab-8be3-482c-946a-de05a93f6363` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

Game: braintraining://game/spatial-mental-rotation ("Mental Rotation", tag "Rotate", category "Spatial"). Deep link cold-start confirmed identity.

## 1. Active Play Board
Live round board (Round 1/5) shows, top to bottom:
- Round chip "Round 1/5" with a thin progress bar; caption "1 of 5 rounds complete".
- "Score 0" (large, left) and a dark "Pause" button (top-right).
- Blue horizontal timer bar, labelled "15 seconds left".
- Question/instruction text visible: "Is the candidate the target rotated?"
- "Score" label + value "0".
- "Target" label with a bordered "Target shape" panel: 4 coloured blocks = orange, red, red in a horizontal row, plus a green block directly below the right-most red.
- "Candidate" label with a bordered "Candidate shape" panel: green block top-left, red block to its right, then red and orange stacked below that red (vertical bar of 3 with an extra block at top-left).
- Two answer controls: "Same" (highlighted pink/red, left) and "Different" (dark, right).
Instructions: the question prompt is visible on the board; the full "How to play" text only appears on the intro screen.
Legibility/hierarchy: good - large heading/question, high-contrast white-on-near-black text, big colour blocks; colour is the only cue distinguishing the orange/red blocks.

## 2. Scored Feedback
Round 1 ended with a TIMEOUT reveal (valid scored feedback). Exact on-screen text:
- Verdict heading: "Time's up"
- Sub-line: "The timer ran out. The correct answer was "Different"."
- The correct option is revealed: the "Different" button turns green with a checkmark and accessibility text "Different, correct"; "Same" stays neutral (no highlight).
- Score chip stayed "Score 0" (timeout awards no point). Round chip advanced to "1 of 5 rounds complete"; a "Next round" button appears at the bottom.
Note: my own answer tap on "Different" (the correct answer) was rejected by the pre-execution safety net after the timer had already expired — i.e. the reveal, not my tap, produced this feedback.


## 3. Pause & Resume
- Tapped the board's "Pause" button during live Round 2 (timer was at "13 seconds left") — the tap registered immediately.
- PAUSE overlay appeared, covering the whole board: heading "Paused"; sub-line "The challenge is hidden and the timers are frozen."; two buttons, literal labels: "Resume" (primary, pink/red) and "Quit" (secondary, dark). The board/Target/Candidate and the timer bar are completely hidden while paused.
- Board tree dump beneath the overlay showed only these 2 controls styled as buttons: text "Resume" and text "Quit" - no other action available.


## 2. Scored Feedback (continued)
Round 2 (played after resuming from Pause): answered "Different" -> CORRECT verdict. Exact on-screen text:
- Verdict heading: "Correct!" (green)
- Sub-line: "Correct — the candidate is not a rotation of the target."
- Chosen option "Different" highlighted green with a checkmark (accessibility label "Different, correct").
- "Score 0" -> "Score 113" (a correct answer adds 113 points), round chip -> "2 of 5 rounds complete", "Next round" button appears.

## 3. Pause & Resume (continued)
RESUME SUCCESSFUL: tapping "Resume" closed the overlay instantly and restored the live board with the timer continuing (no round was lost or reset); the very next tap on "Different" registered immediately.


Round 3 (Score 113): my "Same" tap arrived after the timer expired (turn latency > 15s round), so TIMEOUT: "Time's up" / "The timer ran out. The correct answer was "Same"." with "Same" revealed green + check. Score stayed 113.


Round 4 (Score 113): answered "Same" in time -> INCORRECT verdict. Exact text: heading "Not quite" (red), sub-line "The correct answer was "Different"." Options show "Same, wrong pick" (red X badge) and "Different, correct" (green check). Score unchanged at 113.


## 4. Final Result Screen
Reached after all 5 rounds (button "See results" -> result screen). Top: a green "Keep training" hero card with a 3x3 grid preview icon. Then, verbatim:
- Headline score: "113"
- "Accuracy" 20%
- "Speed" 41%
- "Rounds passed" 1/5
- "Best streak" 1
- "Correct answers" 1/3
- "Timeouts" 2
- "XP" 16
- Reward banner: "Reward  +16 XP  ·  +3 coins" with sub-line "Progress saved" (text exactly "Reward +16 XP · +3 coins")
- Buttons: "Play again" (primary pink) and "Done" (secondary dark).
Round-by-round outcome: R1 timeout (correct "Different"), R2 correct ("Different", +113), R3 timeout (correct "Same"), R4 incorrect (answered "Same", correct "Different"), R5 incorrect (answered "Same", correct "Different").


## 5. Input & Exit
Input registration (all taps on real controls registered immediately; no lag, no dead zones):
- "Start game" (intro) -> play board appeared; "Pause" tap -> overlay appeared instantly.
- "Resume" -> overlay closed instantly and the very next tap ("Different") registered and scored.
- "Next round" / "See results" / "Done" taps all responded on the first attempt.
- The only taps that did NOT register were ones issued after a round had already ended on the timer (the board had flipped to the timeout reveal, so the answer button was legitimately gone) — a latency artifact of the 15s round timer, not unresponsive input.
Exit & safe return:
- Result screen -> tapped "Done" -> landed cleanly on the Games list ("Games" tab, header "Games", "Browse all games", "Showing 42 of 42 games", filter chips "All 42 / Memory 7 / Attention 5 / Speed 5"). No crash, no stuck screen, no data loss (reward "Progress saved").
- Re-fired the deep link braintraining://game/spatial-mental-rotation from the games list -> returned straight to the Mental Rotation intro screen (tag "Rotate", category "Spatial", title "Mental Rotation", same mechanic line, "Start game"). Safe exit and return both proven.

## 6. Defects
- Clipped text: none observed (all labels, verdict lines and stat rows rendered fully).
- Low contrast: minor — the result screen's "Keep training" hero card draws light-green squares on a green background, a lower-contrast combination than the rest of the UI, though still readable.
- Hidden/unreachable action: none observed (Pause, Resume, Quit, Same, Different, Next round, See results, Play again, Done all reachable when present).
- Overlap: minor cosmetic overlap on the intro screen — the "Start game" primary button sits flush against the "How to play" panel and its lower edge is visually cut by that panel while scrolling; it remained fully tappable.
- Unresponsive input: none observed (see Section 5).


## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
