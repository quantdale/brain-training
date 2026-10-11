# Current-device acceptance — `spatial-fold-match`

- Date: 2026-10-11T22:59:31+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-spatial-fold-match`
- ARTEMIS session: `ae8472dc-d8e7-43a3-88a6-d2ca7cd7044b` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 1 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# Game State Review — spatial-fold-match (Fold Match / Spatial)
Deep link: braintraining://game/spatial-fold-match → detail page titled "Fold Match" (category "Spatial"), desc: "A grid folds along an axis and the two halves merge." Cold-start confirmed; on-screen title/mechanic match the targeted game. game id prefixes on result screen: "spatial-fold-match.*".

## 1. Active Play Board
- Header card: "Round 1/6" + progress bar + text "1 of 6 rounds complete"; score line "Score 0" (later "Score 100", "Score 333"); "Pause" button top-right.
- Prompt/question (instructions visible on-board): "Which grid is folded correctly?"; a "Score" label + live value chip ("Score 0").
- Stimulus: 3 answer grids (options) — round 1 each 4 columns × 2 rows, later rounds 3×2; filled cells rendered mint-green, empty cells dark. Each option announces cells e.g. "Row 2 column 1 filled".
- Every visible control + literal label: "Pause" (button); three tappable option cards "Option 1", "Option 2", "Option 3"; after answering, a "Next round" button (final round: "See results").
- Legibility/hierarchy: dark theme, strong mint-green vs dark contrast, clear top-down hierarchy (round/score header → prompt → options → action button). Legible, no clipping.

## 2. Scored Feedback
- Round 1: tapped "Option 1" → CORRECT verdict. Exact text: "Correct fold!" with explanation "Fold the top half onto the bottom". Control relabeled content-desc "Option 1, correct"; Score 0 → 100.
- Round 6: tapped wrong option → INCORRECT verdict. Exact text: "Not quite" with explanation "Fold the left half onto the right"; wrong pick drew a red X badge ("Option 1, wrong pick"), correct one a green check ("Option 2, correct"). Score was 333.
- Both a correct ("Correct fold!") and an incorrect ("Not quite") verdict were captured; each verdict shows an explanation subtitle line.

## 3. Pause & Resume
- Opened via the header "Pause" button. Overlay shows exactly TWO buttons with literal labels: "Resume" and "Quit" (from uiautomator tree). Round timer freezes while the overlay is up.
- Resumed via "Resume"; board returned in the same Round/Score state.

## 4. Final Result Screen
Reached after all 6 rounds via "See results". Exact lines (resource-ids confirm spatial-fold-match):
- Headline: "Keep training" (id spatial-fold-match.result-headline)
- Big animated score: "134" (id spatial-fold-match.score-animated)
- "Accuracy  17%" (id spatial-fold-match.accuracy)
- "Rounds passed  1/6" (id spatial-fold-match.rounds-passed)
- "Best streak  1" (id spatial-fold-match.best-streak)
- "XP  16" (id spatial-fold-match.xp)
- REWARD row (exact): "Reward  +16 XP  ·  +3 coins" with sub-line "Progress saved"
- Buttons: "Play again" and "Done".
(An earlier session ended on the same layout with score "333", Accuracy 50%, Rounds passed 3/6, Best streak 3, XP 24.)

## 5. Input & Exit
- Input: taps registered immediately every time (each Option tap produced an instant verdict banner; no unresponsive taps). Guided one tap per option + button navigation worked first try.
- Exit: tapped "Done" → returned cleanly to the games list ("TRAIN YOUR BRAIN" / "Games" header, "Pick a game to train a skill..."). Safe exit confirmed.
- Return: on the games list I used "Search all games", typed "Fold Match", which surfaced the entry "Fold Match, Spatial game, Learning"; tapping it re-opened the Fold Match game detail page (a "Go back" control present, app focused on com.braintraining.app/.MainActivity). Safe exit AND return proven.

## 6. Defects
- none observed in the app UI (no clipped text, no low contrast, no overlap, no unreachable/hidden action, input responsive).
- Note (environment/tooling only, not an app defect): `adb shell uiautomator dump` frequently printed "Segmentation fault" mid-dump, so some full-tree dumps were truncated; re-dumping recovered the needed nodes.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
