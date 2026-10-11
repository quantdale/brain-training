# Current-device acceptance — `speed-tap-rush`

- Date: 2026-10-11T17:40:46+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-speed-tap-rush`
- ARTEMIS session: `edf357cc-361a-4610-bec5-4abc88d06d27` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 1 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# Game State Review — speed-tap-rush (display name "Tap Rush", tag Tap/Speed)
Identity confirmed: deep link braintraining://game/speed-tap-rush from cold → intro card "Tap Rush", mechanic: "Targets pop up one at a time — tap each one before its window closes to keep the streak alive."

## 1. Active Play Board
Live round observed (Round 1/4, cold-launched from deep link). Screen id "speed-tap-rush.screen".
- Top header row: chip "Round 1/4" (id speed-tap-rush.round.1) | session progress bar (id session-progress, a11y "1 of 4 rounds complete", fill = 1 of 4) | chip "Score 0" (id speed-tap-rush.score) | button "Pause" (id speed-tap-rush.pause, label "Pause").
- Stage/board: label "Score" top-left with live value "0" (id speed-tap-rush.score-live) top-right; instruction line "Tap the target!"; "Streak 0" right side; horizontal window bar (a11y "47 percent of the window left"); playfield frame (a11y hint "Tap the glowing target before it disappears") containing one glowing circular target (a11y name "Target").
- Round/score/timer chips: "Round 1/4", "1 of 4 rounds complete", "Score 0" / "Score 0" live, "Streak 0", window bar percentage.
- Instructions visible: YES — "Tap the target!" plus a11y hint "Tap the glowing target before it disappears".
- Legibility/hierarchy: good — black background, large white score numerals, green progress fill, single high-contrast yellow circular target on empty field; no clipping.

## 2. Scored Feedback
Round 1 timeout reveal (panel id speed-tap-rush.round-result) — EXACT verdict text:
- Headline: "Round failed" (id speed-tap-rush.round-failed)
- Breakdown: "0 hit · 10 missed · 0 wrong"
- Detail: "The window holds at 1100 ms."
- Action button: "Next round"

## 3. Pause & Resume
Tapped in-round button "Pause" (id speed-tap-rush.pause). Overlay opened (round timer froze; board hidden):
- Title: "Paused"
- Subtitle: "The challenge is hidden and the timers are frozen."
- Buttons (verbatim): "Resume" (red/primary) and "Quit" (secondary)
Resumed by tapping "Resume"; round continued normally (timer unfroze). Pause/Resume cycle works.

## 4. Final Result Screen
Reached after all 4 rounds (tapped "See results"). Every line, exactly:
- Banner card: "Keep training" (with a mini Tap-Rush board thumbnail)
- "Final score" 0
- "Accuracy" 0%
- "Targets hit" 0/40
- "Best streak" 0
- "Perfect rounds" 0/4
- "Best reaction" —
- "XP" 10
- Reward block: "Reward +10 XP · +2 coins" and subtitle "Progress saved"
- Buttons: "Play again" (red/primary) and "Done"

## 5. Input & Exit
- Taps registered immediately: in-round "Pause" opened the overlay on the first tap; overlay "Resume" returned to the board on the first tap; result-screen "See results" and "Done" each acted on the first tap; "Speed" filter chip, "Tap Rush" tile and "Start game" all responded on the first tap. No lag, dead zone or duplicate registration observed.
- Exit: tapped "Done" on the result screen → cleanly returned to the Games list ("TRAIN YOUR BRAIN" / "Games" / "Pick a game to train a skill..."); app stayed in com.braintraining.app/.MainActivity (no crash/ANR/restart).
- Return: Games list → "Speed" filter chip → tapped "Tap Rush" tile → Tap Rush detail page ("Play Tap Rush") → "Start game" → Tap Rush Round 1/4 board reopened (same game). Safe exit and return proven.

## 6. Defects
- none observed — no clipped/truncated text, no low-contrast text, no hidden or unreachable action, no overlapping elements, and no unresponsive input on the board, pause overlay, round-result panel, result screen or games list. (Only evidence tooling hiccups occurred: an adb uiautomator dump hit a 'Segmentation fault'; the app UI itself behaved normally.)

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
