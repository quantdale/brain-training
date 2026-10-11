# Current-device acceptance — `speed-order-sweep`

- Date: 2026-10-12T00:00:33+08:00
- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app `com.braintraining.app`
- Test name: `cert076f-game-speed-order-sweep`
- ARTEMIS session: `16e7547c-c78d-49da-95ae-3413d698cff6` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1800 s wait cap, NOT the journey outcome)
- Controller review note: PRESENT (all six headings filled)

## Controller state-review log (scrubbed)

## 1. Active Play Board  (speed-order-sweep / "Order Sweep", Sweep · Speed)
- Game title "Order Sweep" (category "Sweep · Speed"); description: "Every number is on the board at once — sweep them from smallest to largest before the timer drains."
- Pre-game screen controls (literal labels): "Back to games", Difficulty "Normal" with chips "Easy" / "Normal" / "Hard" / "Expert" / "Adaptive", "Start game" (partly covered by a "How to play" sheet: "Every number appears on the board at once — sweep them from smallest to largest before the bar runs out. Wrong taps break your streak, and perfect rounds shrink the next window."), "Try a demo".
- Live board (Round 1/5): top bar "Round 1/5", progress "0 of 5 rounds complete", "Score 0"; right-side "Pause" button.
- In-board: "Score" = 0, instruction text "Tap the smallest number!" visible, "Streak 0", a draining round window bar labelled by a11y "75 percent of the round window left", progress a11y "0 of 9 numbers swept".
- Grid = 3x3 number tiles: 9, 24, 19 / 36, 2, 31 / 40, 26, 4. Large white numerals on dark rounded tiles; clear hierarchy, legible, no clipping.

## 2. Scored Feedback
- Round 1 TIMEOUT reveal (valid scored feedback): headline "Time's up", verdict chip "Missed" (with "Last round: missed" caption next to the prompt), stat line "0/9 swept · 0 wrong taps", instruction "Sweep the whole board before the bar empties.", action button "Next round". Score stayed 0, Streak 0.
- (board did not accept my taps this round: 0/9 swept, 0 wrong taps)

## 3. Pause & Resume
- Opened via the "Pause" button at the top-right of the play board. Overlay opened instantly.
- Overlay content (literal): title "Paused"; subtitle "The challenge is hidden and the timers are frozen."; buttons "Resume" (pink/primary) and "Quit".
- Board hidden behind overlay while paused; round timer froze (confirmed — board stayed at same progress across the pause).
- Resumed via "Resume" -> board returned with same tiles, timer continued.

## 4. Final Result Screen
- Header: "Keep training"; a card with 4 progress slots (1 of 4 highlighted) and a mini preview.
- Stat lines (exact): "Final score" = 0; "Accuracy" = 0%; "Numbers swept" = 0/45; "Best streak" = 0; "Perfect sweeps" = 0/5; "Best pace" = — (none); "Mean pace" = — (none); "XP" = 10.
- Reward (exact): "Reward +10 XP · +2 coins" with caption "Progress saved".
- Actions: "Play again" (pink primary), "Done".

## 5. Input & Exit
- Control taps registered immediately and reliably: "Start game" once fully visible, "Pause"/"Resume" on the overlay, "Next round"/"See results", "Done", and the "Speed 5" filter chip (it highlighted and filtered to "Showing 5 of 42 games" on the first tap).
- In-round BOARD tile taps did NOT land in time: in all 5 rounds the board ended at "0 of 9 numbers swept" / "0 wrong taps" and the round timed out — the ~12s round window plus my per-tap latency meant taps arrived after the round had closed (tiles then report enabled=false). So tile taps never registered as a sweep.
- Exit: tapped "Done" on the RESULT screen -> returned cleanly to the Games list (header "Games", "Browse all games", 42 game cards, bottom nav Home/Games/Progress/Profile). No crash, no stuck screen.
- Return: re-fired the deep link braintraining://game/speed-order-sweep; the game re-opened normally to its own intro screen (title "Order Sweep", tag "Sweep · Speed", mechanic text, Difficulty Normal, "Back to games", "Start game", "Try a demo"). Safe exit-and-return proven.

## 6. Defects
- Overlap / partially hidden primary action: on the game intro screen the "How to play" bottom sheet overlaps the bottom half of the primary "Start game" button, leaving the label clipped behind the sheet (only the upper part of the button is tappable).
- Unresponsive / mistimed input: on the live board, tile taps did not register as sweeps in any round — each round ended "0 of 9 numbers swept · 0 wrong taps" because the ~12s round window elapsed before the tap was processed (tiles report enabled=false once the round-result panel is up). Taps outside the board (Start game, Pause/Resume, Next round, See results, Done, Speed filter chip) all registered on first tap.
- Minor: the games-list category chip row is horizontally clipped at the right screen edge (last chip, e.g. "Speed 5", sits partly off-edge until scrolled) — an edge-affordance, cosmetic only.
- Text was legible with clear hierarchy; no cut-off labels, no low-contrast failures observed otherwise.

## Device frame filed alongside

`result.png` + `result.xml` are captured from the terminal APK on the
current device after the journey, and are the reviewer's independent check
on the controller report above.
