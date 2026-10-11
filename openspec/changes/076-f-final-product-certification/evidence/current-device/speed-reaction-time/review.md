# Current-device acceptance — `speed-reaction-time`

- Date: 2026-10-11T12:09:22+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-speed-reaction-time`
- ARTEMIS session: `c54694bf-cd5e-4d45-89ec-4b51a4a86554` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# speed-reaction-time (com.braintraining.app) — current-device game-state acceptance journey
Deep link: braintraining://game/speed-reaction-time (cold launch). Screen 1080x2400.
Identity: title "Reaction Time", chip "React", label "Speed", desc "Watch for the signal and tap as fast as you can — how quick is your reaction?"

## 1. Active Play Board
- Header row: chip "Round 1/10" (resource-id speed-reaction-time.round) | segmented progress bar (content-desc "1 of 10 rounds complete") | button "Pause" (resource-id speed-reaction-time.pause) top-right.
- Second header line: "Score 0" (resource-id speed-reaction-time.score).
- Board card: label "Score" + live value "0" (resource-id speed-reaction-time.score-live) top-right; instruction line "Get ready — tap the instant it turns green"; status line "False starts left: 1"; large stimulus box whose literal text is "Tap when it turns green".
- Instructions visible: YES on the board itself ("Tap when it turns green" + "Get ready — tap the instant it turns green").
- Legibility: white bold text on dark charcoal; strong contrast, clear hierarchy (round chip > instruction > stimulus box). Legible.
- Intro (pre-play) screen controls, all literal labels: "Back to games", difficulty chips "Easy" / "Normal"(selected, red) / "Hard" / "Expert" / "Adaptive", primary button "Start game"; tip card "You've got it" / "Got it"; demo card "Demo" / "Watch the button…" / "Tap when it turns green" -> "Tap the button now!" / "GO!".

## 2. Scored Feedback
- Round 1 TIMEOUT reveal (valid scored feedback). Exact texts on the board card after the round ended:
  - badge (amber pill, clock icon): "Timed out"
  - heading: "No reaction"
  - body: "The signal went unanswered."
  - sub-line: "Prompt: tap the instant it turns green"
  - button: "Next round"
  - header still showed "Round 1/10" / "Score 0" (no points for a timeout).
- Round 7 correct/"hold" reveal (also valid feedback). Exact texts:
  - badge (green pill, check icon): "Held"; cue above: "Last round: held"
  - heading: "Held!"
  - body: "You held still on the ✕ signal — nicely done."
  - sub-line: "Prompt: hold — do not tap the ✕ signal"
  - button: "Next round"; header now "Round 7/10" / "Score 100" (hold rounds award points).
- Two round types observed: tap-when-it-turns-green (verdict "Timed out"/"No reaction") and hold-on-✕-signal (verdict "Held"/"Held!").

## 3. Pause & Resume
- Opened by tapping the "Pause" button. Overlay: centered title "Paused"; subtitle "The challenge is hidden and the timers are frozen."; two buttons, literally "Resume" (red/primary) and "Quit" (dark/secondary).
- Timer freeze: confirmed by the overlay text stating the challenge is hidden and the timers are frozen.
- Resumed by tapping "Resume" (round/board restored).

## 4. Final Result Screen
- Top banner card: "Keep training" (trophy/gauge graphic with segmented bar).
- Stat block (literal label … value):
  - "Final score" … 200
  - "Median reaction" … — (em dash; no value — every tap-round timed out)
  - "Best reaction" … —
  - "Mean reaction" … —
  - "Rounds passed" … 2/10
  - "✕ signals held" … 2/2
  - "False starts" … 0
  - "XP" … 14
- Reward panel (exact): "Reward  +14 XP · +2 coins" with sub-line "Progress saved".
- Buttons: red "Play again" ; dark "Done".

## 5. Input & Exit
- In-session taps registered immediately: "Start game" (setup -> Round 1/10 board), "Pause" (board -> Paused overlay), "Resume" (overlay -> board restored), "Next round"/"See results" during the advance loop, and the demo green "GO!" box all responded with a sub-second visual change. No lag between tap and verdict/overlay render inside the session.
- Two exceptions, both OUTSIDE the round: "See results" needed 2 taps (first tap produced no change), and "Done" on the RESULT screen needed a second tap before the session exited.
- Exit: tapped "Done" on the RESULT screen -> the session closed and the app shell appeared (bottom nav Home / Games / Progress / Profile, landed on the Progress tab). Tapped the "Games" tab -> the games list rendered: "TRAIN YOUR BRAIN / Games", "Pick a game to train a skill. New games appear here as they are added.", search field "Search games…", "Browse all games", filter chips "All 42" / "Memory 7" / "Attention 5" / "Speed 5", "Showing 42 of 42 games", game cards (Odd One Out, Signal Watch, Symbol Tracker, Target Count…). No crash, no ANR during exit.
- Re-open (return proof): typed "reaction" in the search field + selected the "Speed 5" filter -> "Showing 1 of 42 games" with the single card "Reaction Time" (Learning). Tapped it -> the game's own screen loaded: card "Reaction Time" with chip "React", label "Speed", text "React to the signal and tap as quickly as you can.", "Includes a short guided tutorial on first play.", primary button "Play Reaction Time"; then "Add to favorites"; "01 Mastery – 1 – Learning – Play 4 more sessions to leave the basics"; "02 Records – SESSIONS 1, Last played Today / BEST 10% / AVERAGE 10% / VIEW DETAILED TRENDS".
- Verdict: safe exit AND safe return CONFIRMED; prior progress persisted (1 session, "Last played Today", BEST/AVERAGE 10%, XP saved), so the finished session was committed, not lost.

## 6. Defects
- Clipped text / hidden control: on the Games browse screen the filter chip row overflows the right edge — the 4th chip "Speed 5" is clipped, only its right portion is on screen, so a center tap misses it (my first 3 attempts hit "Attention 5" / empty space instead).
- Overlap: on the Games screen the filter chip row is drawn in the same vertical band as the "Browse all games" heading, so taps aimed at a chip can land on the heading / a neighbouring chip (hit-testing overlap).
- Unresponsive input: "See results" (Round 10 board) and "Done" (RESULT screen) each ignored the first tap and only acted on the second.
- Interstitial ANR: the "Process system isn't responding" dialog (buttons "Close app" / "Wait") reappeared 3+ times over the game on cold launch, each time needing "Wait"; it also covered the board so a uiautomator dump could only return the dialog.
- Low contrast: none observed — board and result text are high-contrast white on dark, clear hierarchy.
- (Tooling note, not user-facing: `uiautomator dump` repeatedly ends in "Segmentation fault" on the game's animated screens, returning partial trees.)

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
