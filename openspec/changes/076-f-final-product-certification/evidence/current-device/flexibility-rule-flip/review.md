# Current-device acceptance — `flexibility-rule-flip`

- Date: 2026-10-11T19:09:58+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-flexibility-rule-flip`
- ARTEMIS session: `c5639053-3fea-4085-a29c-ad1016c6971f` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 1 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# Game State Review — flexibility-rule-flip ("Rule Flip", category Flexibility)
Deep link: braintraining://game/flexibility-rule-flip (cold start, force-stop first). Confirmed identity: resource-id flexibility-rule-flip.screen; title "Rule Flip"; category "Flexibility"; description "Match the target card by the active rule — color, shape, or number."; icon/logo "Flip". Intro controls: "Back to games", Difficulty radios Easy / Normal(selected) / Hard / Expert / Adaptive, "Start game", "Try a demo". Tutorial flow: "How to play" sheet (only action "Try a demo") → demo board → "That's it" → "You've got it" sheet with "Got it" → intro → "Start game".

## 1. Active Play Board
Live board (Trial 1/10), dark theme (near-black bg, white text), all nodes under resource-id flexibility-rule-flip.screen:
- Top header card: "Trial 1/10" (flexibility-rule-flip.round.1) + a horizontal round-progress bar that fills green as rounds complete; subtitle "0 of 10 rounds complete"; "Score 0" (flexibility-rule-flip.score); "Pause" button (flexibility-rule-flip.pause, top-right).
- Stage (flexibility-rule-flip.stage): small chips "Score" + live value (flexibility-rule-flip.score-live); large centered rule banner "Match by number" (flexibility-rule-flip.rule-banner-text) — banner rotates between color / shape / number and can go dark (infer-rule mode); centered target card (flexibility-rule-flip.target-card) = blue square with count badge "2" in a white circle; instruction "Pick the matching card" (flexibility-rule-flip.pick-status) visible at all times.
- Grid of 4 candidate cards, each an android.widget.Button with content-desc of the form "<color> <shape> <n>": card.0 "green triangle 1", card.1 "blue circle 4", card.2 "red circle 4", card.3 "red circle 2". Each card renders the shape+colour on a dark tile with a bottom-right count badge.
- Legibility/hierarchy: good — rule banner is the largest text, then instruction, then cards; high-contrast colours on black; badges legible. Rule banner dominates correctly.
- Demo board (tutorial): header "Demo", rule "Match by color", instruction "Pick the card matching the target by color", target blue circle "2", candidates blue square "3"/red circle "2"/green circle "2"/green triangle "1".

## 2. Scored Feedback
Correct answer (Trial 1, rule "Match by number", target badge 2, picked red circle "2"): EXACT verdict text = "Correct!" (rendered in green), with sub-line "Matched by number: blue square 2". Score advanced 0 → 100. The chosen card got a green border + green ✓ badge. A red "Next trial" button appeared. (Tutorial/demo verdict observed earlier: "Perfect!".)

## 3. Pause & Resume
Tapped the board's "Pause" button (flexibility-rule-flip.pause, top-right) mid-round → full-screen Pause overlay (dark, centred):
- Heading: "Paused"
- Sub-line: "The challenge is hidden and the timers are frozen."
- BUTTONS, verbatim, exactly two: "Resume" (filled red) and "Quit" (dark/grey).
The board is fully hidden behind the overlay and the round + progress timers are frozen while paused. Tapped "Resume" → returned to the live board with the round intact.

## 4. Final Result Screen
Reached after Trial 10/10 via a red full-width "See results" button; run of 10 rounds = 9 correct / 1 miss, final in-game score 1030.
- Purple/banner result card at top: rule-flip card graphic (target + 3 switch tiles + 2 tiles + 4-segment mini bar, top-right circular flip icon).
- Verdict headline, verbatim: "Solid work"
- Big score line: "1030"
- Stat lines (label : value), verbatim and in order: "Accuracy: 90%"; "Speed: 0%"; "After rule flips: 67%"; "Same-rule trials: 100%"; "Uncued first picks: 100%"; "Best streak: 5"; "Mistakes: 1"; "XP: 35"
- Reward banner (verbatim): "Reward  +35 XP  ·  +7 coins" with sub-line "Progress saved" (XML content-desc "XP: 35"). No ads/interstitial.
- Buttons: "Play again" (filled red) and "Done" (dark/grey). No ads, no interstitial.

Replay confirmation (the result screen the device was left on at the end of the journey — same game, second full run, 10/10 rounds resolved, 6 correct / 4 misses):
- Headline, verbatim: "Keep going"
- Big score line: "660"
- Stat lines (label : value), verbatim and in order: "Accuracy: 60%"; "Speed: 0%"; "After rule flips: 0%"; "Same-rule trials: 67%"; "Uncued first picks: 50%"; "Best streak: 3"; "Mistakes: 4"; "XP: 23"
- Reward banner (verbatim): "Reward  +23 XP  ·  +4 coins" with sub-line "Progress saved"
- Buttons (resource-ids): "Play again" (flexibility-rule-flip.restart) and "Done" (flexibility-rule-flip.quit)
- Headline varies with performance ("Solid work" on the 90% run, "Keep going" on the 60% run); the stat lines and reward are always XP-per-accuracy scaled.

## 5. Input & Exit
- Board input: taps registered IMMEDIATELY — every candidate-card pick produced its verdict on the very next frame (9/10 rounds scored) and the picked card showed its green ✓ / red ✗ badge at once. No input was ever swallowed on the play board itself.
- Caveat on the advance/confirm buttons: "Next trial", "See results" and "Done" each needed a second tap once (T+14:19→T+14:40 "See results"; T+15:37→T+16:02 "Done"; T+09:50 "Next trial"). Cause: these buttons sit under animated content, so their position moves between frames (e.g. "Done" moved to y≈937 normalized only after the reward banner animated in), and a tap at the previously-read coordinate landed just below the label.
- Exit: tapped "Done" on the Final Result Screen → returned straight to the Games list ("Browse all games", "Showing 42 of 42 games", "Search games…", filter chips All 42 / Memory 7 / Attention 5 / Speed 5, bottom nav Home / Games / Progress / Profile). No crash, no spinner, no stray dialog.
- Return: re-fired `am start -a android.intent.action.VIEW -d braintraining://game/flexibility-rule-flip` → device reported "intent has been delivered to currently running top-most instance" and the Rule Flip intro page rendered again ("Flip / Flexibility", title "Rule Flip", "Back to games", full description, Difficulty Easy / Normal(selected) / Hard / Expert / Adaptive, "Start game", "How to play"). Safe exit AND safe re-entry confirmed.
- Repeat observation on the second run: on the Trial 5/10 verdict frame the red full-width "Next trial" button stopped responding to coordinate taps altogether (3 consecutive taps at its recorded centre, no frame change) while the rest of the app stayed live ("Pause" still opened the overlay on a single tap). Driving the round forward required `adb shell input tap` at the button's true bounds centre (physical y≈1578 on a plain verdict frame); on "Not quite" frames, which carry an extra line "The active rule was: …", the same button sits lower (physical y≈1610), so a fixed-coordinate tap misses it.

## 6. Defects
- Hidden/unreachable action (first launch only): the "How to play" bottom sheet covered the "Start game" button and offered no close/dismiss control — it is not drag-dismissible (3 swipe-down attempts had no effect) and there is no scrim or outside-tap dismissal. The only exit was the sheet's own "Try a demo", so "Start game" was temporarily unreachable (an attempted tap on it was rejected as "blocked and obscured by the How to play sheet"). On every later open the sheet is absent and "Start game" is directly tappable.
- Advance-button hit-target drift: "Next trial" / "See results" / "Done" sit directly beneath animated content, so their position shifts between frames and taps at the previously-read coordinates land below the label and must be repeated (see Section 5).
- Questionable stat: the result screen reports "Speed: 0%" although 9 of 10 answers were correct and immediate; if Speed is a time-bonus metric this renders as zero speed credit, which is at best confusing.
- No clipped text, no overlap and no contrast problems observed on the play board, the Pause overlay or the Result screen; white/near-white text on near-black with red primary accents is consistently legible.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
