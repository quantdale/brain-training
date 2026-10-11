# Current-device acceptance — `math-number-line-estimation`

- Date: 2026-10-11T15:12:53+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-math-number-line-estimation`
- ARTEMIS session: `d8d67efc-6e44-450f-bc97-25277e1644da` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

## 1. Active Play Board
Game identity CONFIRMED via cold deep-link launch: title "Number Line", category tags "Estimate" + "Math", mechanic text "A flag marks a spot on a number line — tap where you think its value sits." Difficulty selector: Easy / Normal (selected, red) / Hard / Expert / Adaptive. Buttons "Start game" and "How to play".
Active board (Round 1): top bar "Round 1/10" with a thin progress bar, "Score 0", and a "Pause" button top-right. Panel shows "Score" chip = 0, question "Where does the flag sit?", timer chip "10s left", and a horizontal number line labelled 0 (left) to 20 (right) with minor tick marks and a blue vertical flag marker placed slightly left of centre. Instructions ARE visible ("Where does the flag sit?"). Board is legible with clear hierarchy (question large, chips secondary, number line dominant stimulus).

## 2. Scored Feedback
Round 1 verdict = TIMEOUT reveal (no answer submitted; timer expired after resume). Exact texts shown: headline "Time's up"; body "Timed out: the flag was at 10; no estimate was made."; answer line "The flag was at 10."; action button "Next round". Score remained 0.
Round 2 verdict = TIMEOUT reveal again (tap arrived after the 10s timer expired). Exact texts: headline "Time's up"; body "Timed out: the flag was at 4; no estimate was made."; answer line "The flag was at 4."; action button "Next round". Score stayed 0.
Round 3 verdict = TIMEOUT reveal. Exact texts: "Time's up" / "Timed out: the flag was at 8; no estimate was made." / "The flag was at 8." / "Next round".
Round 4 verdict = TIMEOUT reveal. Exact texts: "Time's up" / "Timed out: the flag was at 2; no estimate was made." / "The flag was at 2." / "Next round".
Rounds 5–10 verdicts = TIMEOUT reveal each. Only the scoring engine produced scores: every round ended "Time's up" with body "Timed out: the flag was at N; no estimate was made." and reveal "The flag was at N." (N values observed: 2, 8, 11 among others). Final Score remained 0 (score-live = 0). Round 10's advance button changed label to "See results".
(Board tree via uiautomator: ids math-number-line-estimation.round.N / .score / .score-live / .prompt / .number-line (android.widget.SeekBar, labels .line-label-min=0, .line-label-max=20) / .line-flag / .round-timeout / .reveal / .next-round / .pause. Session progress bar id "session-progress" content-desc "N of 10 rounds complete".)
NOTE: taps on the number line registered no verdict — the SeekBar stayed enabled=false only after timeout; input path issue being probed.

## 3. Pause & Resume
PAUSE overlay opened via "Pause": title "Paused", subtitle "The challenge is hidden and the timers are frozen.", two buttons "Resume" and "Quit". Timer froze (board hidden). RESUME tapped -> returned to live board.

## 4. Final Result Screen
Reached after round 10 ("See results"). Full contents (exact):
- Headline: "Keep training" (id math-number-line-estimation.result-headline)
- "Final score" = 0
- "Hits" = 0/10
- "Best streak" = 0
- "Best closeness" = 0%
- "XP" = 10
- Reward panel (id math-number-line-estimation.reward): "Reward  +10 XP  ·  +2 coins"
- Buttons: "Play again" (id .restart) and "Done" (id .quit)
No per-round score breakdown or accuracy history is offered on this screen.

## 5. Input & Exit
Input: all tappable controls registered immediately and reliably — "Pause" (id math-number-line-estimation.pause), "Resume" and "Quit" in the pause overlay, "Next round" (id .next-round, later relabelled "See results"), "Done" (id .quit) and "Play again" (id .restart) each responded on the first tap with no lag or dead zone.
The number line (id math-number-line-estimation.number-line, an android.widget.SeekBar) is only enabled during the ~10s live phase; every attempt to tap it landed after the window had closed, so no live-line answer tap was ever confirmed (consistent with Score 0 / Hits 0/10). Its post-timeout state is correctly disabled (enabled="false").
Exit: tapped "Done" -> app returned to the Games list ("TRAIN YOUR BRAIN" / "Games" / "Pick a game to train a skill. New games appear here as they are added."), MainActivity resumed — safe exit, no crash.
Return: fired the deep link braintraining://game/math-number-line-estimation from a force-stopped state again -> landed back on the "Number Line" intro screen (chips "Estimate"/"Math", "Back to games"). Safe exit and return proven.

## 6. Defects
none observed. No clipped text, no overlap, no unreachable/hidden action: every control (Pause, Resume, Quit, Next round/See results, Done, Play again) was reachable and responded first tap. Secondary labels ("Score" header, line end-labels 0/20) are grey-on-black but still legible. The only friction is behavioural, not a rendering defect: the number line's live input window is a hard 10s and becomes disabled on timeout, and each round continued to a timeout reveal with no answer recorded.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
