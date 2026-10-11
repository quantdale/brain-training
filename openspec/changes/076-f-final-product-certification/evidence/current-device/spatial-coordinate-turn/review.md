# Current-device acceptance — `spatial-coordinate-turn`

- Date: 2026-10-11T22:28:34+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-spatial-coordinate-turn`
- ARTEMIS session: `623f68cb-77b6-499c-8906-210043360c24` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

# GAME STATE REVIEW LOG
Game: braintraining://game/spatial-coordinate-turn
On-screen title: "Coordinate Turn" (category: Orient / Spatial). Mechanic: "Follow relative turn and move instructions, then say which way you end up facing." CONFIRMED IDENTITY via cold-start deep link.

## 1. Active Play Board
Title "Coordinate Turn" (Orient/Spatial). Board container holds:
- Round chip: "Round 1/10"; progress bar with "1 of 10 rounds complete"
- Score chip: "Score 0"
- "Pause" button (top-right of board)
- Question prompt: "Which way are you facing?"
- Compass stimulus (circle w/ green up arrow), label "Heading N"
- Instruction list: "1. Move forward 1" / "2. Turn right" / "3. Turn around"
- Countdown text: "Answers in 12s"
- Primary button: "Show answers"
Instructions visible: YES (numbered turn/move commands). Hierarchy clear, board legible (dark theme, high-contrast green arrow).
## 2. Scored Feedback
Round 1: tapped answer "W" (Direction W). Instant verdict in green: "Correct!" with a checkmark badge on the chosen W option; Score chip updated 0 -> 100. EXACT verdict text: "Correct!". (Answer panel options are Direction N / W / E / S, each with arrow glyph.)
## 3. Pause & Resume
Tap "Pause" opens a full-screen overlay: title "Paused"; subtitle "The challenge is hidden and the timers are frozen."; buttons: "Resume" and "Quit". Board hidden beneath overlay, timer frozen. Tapped "Resume" -> overlay dismissed, board returned (timer resumed).
## 4. Final Result Screen
Reached after Round 10 via "See results". Header banner shows a green dial icon; headline text: "Solid work". Big score: "1000". Stat lines (all literal):
- "Accuracy  100%"
- "Speed  18669 ms"
- "Position trials  —"
- "Best streak  10"
- "Mistakes  0"
- "XP  38"
Reward block: "Reward  +38 XP  ·  +7 coins" with sub-line "Progress saved".
Buttons: "Play again" (red) and "Done".
## 5. Input & Exit
Taps registered immediately throughout the whole run: every direction-answer tap produced the green "Correct!" verdict on the very next frame (no double-tap, no lag), and "Show answers" / "Next round" / "See results" / "Pause" each responded on the first press.
Exit: tapped "Done" on the Final Result screen -> the game closed and the app landed on the Games list ("TRAIN YOUR BRAIN / Games", "Search games…" field, filter chips "All 42 / Memory 7 / Attention 5 / Speed 5", "Showing 42 of 42 games", cards Odd One Out / Signal Watch / Symbol Tracker / Target Count, bottom nav Home / Games / Progress / Profile).
Return: typed "Coordinate" into the Games search box ("Showing 1 of 42 games") and tapped the "Coordinate Turn" card -> the game re-opened ("Loading… Starting the game…") to its intro page showing title "Coordinate Turn" (Orient / Spatial), the mechanic "Follow relative turn and move instructions, then say which way you end up facing.", the Difficulty selector and a "Start game" button. Safe exit AND safe return both proven, no crash.
## 6. Defects
- Minor (labeling): on the Round 4 answer row one direction option (W) rendered only as an unlabeled compass-rose glyph while N / S / E showed arrow + letter labels — inconsistent option labeling (option was still tappable and scored "Correct!").
- Minor (empty stat): on the Final Result screen the "Position trials" stat shows only an em-dash "—" with no numeric value populated.
- Intermittent (transient control): on Rounds 3 and 9 the red "Show answers" button had already been replaced by the direction pad at tap time, so two taps were blocked as target-disappeared; the round stayed playable and scoring was unaffected.
- Otherwise none observed: no clipped text or overlap on the board, high contrast (dark theme, bright-green stimulus), clear hierarchy, and every control (Pause / Resume / Quit / Show answers / directions / Next round / See results / Done) was visible and reachable.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
