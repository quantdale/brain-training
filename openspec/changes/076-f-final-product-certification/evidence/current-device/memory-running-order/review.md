# Current-device acceptance — `memory-running-order`

- Date: 2026-10-11T16:10:48+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-memory-running-order`
- ARTEMIS session: `536a348b-80f5-45f2-b07f-6f3e19004844` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

## 1. Active Play Board
Verified via uiautomator dump + screenshot. Title/mechanic self-describe as "Running Order" (Memory): "Watch a stream of symbols, then recall the LAST few in order."
Header chips: "Round 1/5" (id memory-running-order.round.1), progress bar (id session-progress, desc "1 of 5 rounds complete"), trailing control "Pause" (id memory-running-order.pause, content-desc "Pause").
Stage: "Score" label + live value "0" (id memory-running-order.score-live). During stream the stage shows prompt "Watch the stream…" and one central stimulus symbol with progress dots ("Item 2 of 4").
Recall phase: instruction line "Recall the last 3 in order" (id memory-running-order.input-status), 3 empty answer slots (id memory-running-order.answer), a 12-symbol palette (id memory-running-order.palette.0-11): red circle ●, blue square ■, green triangle ▲, orange star ★, purple diamond ◆, pink heart ♥, cyan inverted triangle ▼, indigo spade ♠, lime club ♣, yellow cross ✖, gray sun ☀, teal arrowhead ▶; and disabled "Back" (id .backspace, content-desc "Back") + disabled "Submit" (id .submit).
Instructions: not shown on board during play (mechanic text only on the pre-game screen). Board is legible with clear hierarchy (chips top → instruction → slots → palette grid → actions).

## 2. Scored Feedback
Round 1 answered (picked red circle, blue square, green triangle → Submit). Verdict revealed on the board: headline EXACT text "Not quite" (red/pink), sub-line "You recalled 0 of 3 in order", with the 3 answer slots marked erroneous (red X badges) and the correct target row shown: "Target:" = gray sun ☀, orange star ★, red circle ● (each with green check badge). Round 1/5 progress bar advanced. A "Next round" button appeared to continue. Score stayed 0.
Round 2 answered (red circle/blue square/green triangle + Submit). Verdict: headline EXACT text "Not quite" (pink), sub-line "You recalled 1 of 3 in order", Answer row (green checks + red X badges) with "Target: blue square ■, purple diamond ◆, green triangle ▲". Score advanced to 33 and a full-width pink "Next round" button appeared.
Round 3 answered (red circle/blue square/green triangle + Submit). Verdict: same EXACT headline "Not quite", sub-line "You recalled 0 of 3 in order", "Target: indigo spade, red circle, red circle". Score stayed 33; pink "Next round" button appeared again.
Round 4 answered (red circle/blue square/green triangle + Submit). Verdict: "Not quite", "You recalled 0 of 3 in order", "Target: cyan inverted triangle, orange star, indigo spade". Score stayed 33; pink "Next round" button again.
Round 5 (final) answered (red circle/blue square/green triangle + Submit). Verdict: "Not quite", "You recalled 0 of 3 in order", "Target: cyan inverted triangle, orange star, indigo spade". All 5 rounds used; button changed to "See results".

## 3. Pause & Resume
Tapping "Pause" opened a full-screen overlay (id memory-running-order.pause-overlay) with heading "Paused", subtitle "The challenge is hidden and the timers are frozen." (the live board behind is dimmed), and exactly two buttons: "Resume" (pink, id memory-running-order.pause-resume) and "Quit" (dark, id memory-running-order.pause-quit). Resume tap being dispatched to confirm the board returns and the timer continues.

## 4. Final Result Screen
Reached after all 5 rounds were consumed and the final "See results" button was tapped. Verdict headline on the result card: EXACT text "Keep training" (large white text). Stat lines, each verbatim:
- "Final score" = "33" (large centred number under the headline)
- "Accuracy" = "0%"
- "Rounds passed" = "0/5"
- "Best recall" = "1"
- "Best streak" = "0"
- "XP" = "10"
Reward (id memory-running-order.reward), EXACT text: "Reward  +10 XP  ·  +2 coins" and directly beneath it "Progress saved". Controls: "Play again" (id memory-running-order.restart, content-desc "Play again", pink/red button) and "Done" (id memory-running-order.quit, content-desc "Done", dark button). Screen id memory-running-order.results.

## 5. Input & Exit
Input responsiveness: every tap registered immediately on the first attempt — each palette pick filled its answer slot at once (red circle -> slot 1, blue square -> slot 2, green triangle -> slot 3), "Submit" enabled after 3 picks and fired on the first tap, and "Pause", "Next round" and "See results" each responded to a single tap. No missed, delayed or double-registered taps observed.
Exit: the Result screen's "Done" control (id memory-running-order.quit) returned straight to the Games list ("Games" / "Pick a game to train a skill." / "Browse all games" / "Showing 42 of 42 games", filter chips "All 42", "Memory 7", "Attention 5", "Speed 5"), with no crash or confirmation dialog.
Return: firing the deep link braintraining://game/memory-running-order again re-opened THIS game's intro screen ("Running Order" / "Hold" / "Memory" / "Watch a stream of symbols, then recall the LAST few in order." / Difficulty "Normal" / "Start game" / "How to play") — safe exit and return confirmed.

## 6. Defects
Minor (accessibility/semantics only): the streaming stimulus's accessibility name did not match the drawn symbol in at least one frame — a yellow cross ✖ was exposed with content-desc "gray sun" ☀. Visual rendering itself was correct.
Not observed: no clipped or truncated text, no low-contrast text, no hidden/unreachable action, no overlapping controls, and no unresponsive input. Board hierarchy is clear (round chip + progress -> Score -> instruction -> answer slots -> palette grid -> Back/Submit) and fully legible.
Verdict: no functional defects; one minor accessibility-label mismatch.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
