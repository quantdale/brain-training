# Current-device acceptance — `speed-quick-compare`

- Date: 2026-10-11T17:16:07+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-speed-quick-compare`
- ARTEMIS session: `20ca414b-3b31-440c-84e2-1e3d85c829c0` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# Game-State Acceptance Journey — speed-quick-compare

## 1. Active Play Board
Active round (Round 1/10) on speed-quick-compare "Quick Compare", Normal difficulty. Layout top→bottom: header bar with chips "Round 1/10", "Streak 0", button "Pause"; thin green round-timer progress bar under the header (drains left→right); panel with label "Score" and value "0"; instruction line "Which sum is larger?"; two stimulus cards "Left 12 + 18" and "Right 16 + 20"; three selectable answer options in a grid: "35", "30", and full-width "36". Instructions visible = YES ("Which sum is larger?" inline as the question; full rule text is on the intro page: "Two values, one fast decision: judge whether they match, which is larger, or which side sums to more — before the clock runs out."). Legibility/hierarchy = clear: large bold numerals (12+18 / 16+20), high-contrast white-on-dark text, distinct bordered option buttons, header chips dimmer than the stimulus.

## 2. Scored Feedback
Round 1 is the first scored, timed round and it produced a TIMEOUT verdict. Captured state (T+02:25): amber pill badge with clock icon reading EXACTLY "Timed out", the text "Too slow" below the options, the correct option "36" marked with a green border + green checkmark (correct answer reveal), Score still "0", Streak "0", and a red button "Next round". (My tap on "36" did not register before the ~13 s round clock expired, so the reveal is the timeout form.)

## 3. Pause & Resume
PAUSE: the header button labelled "Pause" (id speed-quick-compare.pause) opens a full-screen overlay. Overlay contents quoted literally: heading "Paused"; subtitle "The challenge is hidden and the timers are frozen."; exactly two buttons — "Resume" (id speed-quick-compare.resume) and "Quit" (id speed-quick-compare.quit). The board is fully hidden behind it and the round timer is frozen (round stayed at Round 3/10 while paused).
RESUME: tapping "Resume" (id speed-quick-compare.resume) closed the overlay immediately and restored the round in progress (Round 3/10), confirming the session resumed where it paused with score, streak and round all preserved.

## 4. Final Result Screen
Reached after all 10 rounds. Headline: "Keep training". Every line (literal, id in brackets):
- "Final score" → "0" [speed-quick-compare.score-final]
- "Accuracy" → "0%" [speed-quick-compare.accuracy] (accessibility: "Accuracy: 0%")
- "Correct" → "0/10" [speed-quick-compare.correct] (accessibility: "Correct: 0/10")
- "Best streak" → "0" [speed-quick-compare.best-streak] (accessibility: "Best streak: 0")
- "Best reaction" → "—" (em-dash, no value) [speed-quick-compare.best-reaction]
- "XP" → "10" [speed-quick-compare.xp]
Reward (exact): "Reward  +10 XP  ·  +2 coins" (id speed-quick-compare.reward), followed by "Progress saved".
Buttons: "Play again" [speed-quick-compare.restart] and "Done" [speed-quick-compare.quit].

## 5. Input & Exit
Exit: "Done" (id speed-quick-compare.quit) on the RESULT screen closed the game and returned to the app's main list — "TRAIN YOUR BRAIN / Games", subtitle "Pick a game to train a skill. New games appear here as they are added.", a "Search games…" field, tabs "All 42"/"Memory 7"/"Attention 5"/"Speed 5", "Showing 42 of 42 games" — i.e. a safe exit, no crash or blank screen.
Re-open: searched the list ("compare" → "Showing 1 of 42 games"), tapped the "Quick Compare" card, which opened its own detail/intro page (title "Compare" + "Quick Compare", "Speed", rule text, difficulty selector with "Normal" selected, "Start game"/"How to play"/"Back to games") — the game re-opens cleanly from the list. Safe exit + return PROVEN.
Tap registration: the header controls respond immediately — "Pause", "Resume", "Done", and the list/card taps all took effect on the first attempt with no lag or missed tap. Answer-option taps are the exception in practice: the round clock is ~13 s and one operator turn costs about as much as a whole round, so option taps dispatched at turn start landed after the window expired (reported as "Timed out"), not a UI fault.

## 6. Defects
none observed. No clipped or truncated text (the long rule sentence wraps cleanly across 3 lines), no low-contrast text, no overlapping elements, and no hidden or unreachable action — "Pause", "Resume", "Quit", "Next round"/"See results", "Play again" and "Done" were all reachable and clickable on the first try, and the games-list card re-opened the game correctly. Only operational note: the ~13 s round window is short relative to remote tap latency, so an answer tap issued at the start of an operator turn can miss the window (feedback then reads "Timed out" / "Too slow"); this is latency, not a UI defect. Note "Best reaction" legitimately renders "—" (no value) when no round is answered correctly.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
