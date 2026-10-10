# Defect re-verification on the rebuilt APK — `flexibility-color-stroop`

- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro`, `mimo-v2.6-flash`
- ARTEMIS session: `61201468-d9e1-4d04-aa44-69c01cd8d835` (raw trace external to Git)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes) — the candidate carrying both fixes
- Re-verified defects: pause-control drift, dead edge-tap zone

# Game State Review Log — flexibility-color-stroop (com.braintraining.app)

Context: after STEP -1 RESET (force-stop + cold launch) deep link braintraining://game/flexibility-color-stroop opened; Rule: INK, 15 trials; session T+01:25–T+15:36. Coordinates below are as recorded per method: "normalized" = UI element list 0–1000 scale, "px" = uiautomator dump raw pixels (1080×2400 screen).

## 1. Pause control stability

- Trial 1, BEFORE playing: Pause is at the TOP-RIGHT of the header bar, at the right end of the "Trial 1/15 | Score 0 | Rule: INK" row. Pause element bounds (normalized): [698,100][910,152].
- Trial 1, AFTER the trial ended: same top-right position, unchanged.
- Trial 2: Pause still top-right, bounds (normalized) [698,100][910,152] — identical to Trial 1.
- Trial 3: Pause still top-right, same spot as Trials 1–2.
- Trials 4–15 (per-trial uiautomator dumps, Pause text node bounds in px):
  - T4 [817,278][920,331]; T5 [817,294][920,347]; T6 [817,294][920,347]; T7 [817,294][920,347]; T8 [817,294][920,347]; T9 [817,278][920,331]; T10, T11, T12, T13, T14, T15 all [817,294][920,347].
  - Horizontal bounds x=[817,920] px of 1080 px width are CONSTANT in every dumped trial → Pause was on the RIGHT side in all 15 trials and never appeared on the left.
  - Only variation observed: a 16 px vertical shift (y=278 in T4/T9 vs y=294 in the other dumped trials); no horizontal movement.
- Verdict: the Pause control stays in ONE position (top-right) across trials — quoted first-trial position: top-right, normalized [698,100][910,152]; quoted later-trial position (Trial 15): top-right, px [817,294][920,347].

## 2. Edge tap test

Target: "Next trial" button (resource-id flexibility-color-stroop.next-trial), uiautomator bounds [97,1368][983,1494] px, measured on Trial 1's timeout screen.

1. EDGE tap — executed ONCE at (981, 1431) px = 2 px inside the button's right bound (right bound x=983), on the outer edge and NOT the centre: REGISTERED. Screen advanced from Trial 1/15 to Trial 2/15 (stimulus "CHAIR" shown, Score 0).
2. CENTRE tap — executed at (540, 1431) px, the exact centre of the same button on Trial 2's timeout screen: REGISTERED. Screen advanced from Trial 2/15 to Trial 3/15 (stimulus "GREEN" shown).

Both the edge tap and the centre tap registered; no edge-tap failure was reproduced.

## 3. Final Result Screen

Reached after Trial 15 via the button with content-desc "See results" (bounds [97,1400][983,1526] px). Values verbatim as displayed:

- Title: "Keep training"
- Score (large number): "0"
- Accuracy: "0%"
- Correct: "0/15"
- Best streak: "0"
- Post-flip correct: "0"
- XP: "10"
- Reward line: "Reward  +10 XP  ·  +2 coins"
- Status line: "Progress saved"
- Buttons: "Play again", "Done"

## 4. Defects

1. Pause control stability (expected defect: Pause moving between left and right): NOT REPRODUCED. Pause remained top-right in Trial 1 (before and after the trial), Trial 2, Trial 3, and every dumped trial 4–15; horizontal bounds constant at x=[817,920] px across all dumps. Minor observation: a 16 px vertical offset in the Pause text bounds of Trials 4 and 9 (y=278) versus the other dumped trials (y=294) — vertical only, no left/right movement.
2. Edge tap on "Next trial": NOT REPRODUCED. The tap placed 2 px inside the button's outer right bound registered and advanced Trial 1 → Trial 2; the centre tap also registered (Trial 2 → Trial 3).
3. Test-method note (not a UI defect): all 15 trials ended with the "Time's up!" timeout (1500 ms window) with no answer submitted, which is why the result screen shows Correct 0/15 and Accuracy 0%; the +10 XP / +2 coins reward was still granted and progress saved.
