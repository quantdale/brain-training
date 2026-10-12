# Controller journey — `background-foreground`

- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro`, locked app `com.braintraining.app`
- ARTEMIS session: `47b1921c-91cc-4ec4-8bd3-272f7c6f62b4` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 124 (the CLI client's own 1500 s wait cap, NOT the journey outcome)
- Journey log: PRESENT (all four sections carry substantive content)

## Planned steps
1. Launch com.braintraining.app and start a game that is actively running (timer counting, score visible) — via Home "Speed Focus" workout button, else Games tab.
2. Capture the baseline: game name, timer value, score.
3. Interrupt: switch to a DIFFERENT app (Recents/Home, then launch e.g. Settings/Chrome), stay away ~10-30 s.
4. Return to com.braintraining.app (Recents or `am start`).
5. Observe the resumed state; compare game state, timer and score against the baseline.

## Executed steps
1. Launched com.braintraining.app; landed on Home tab, "Choose a workout".
2. Tapped the red "Speed Focus" workout button on Home TWICE (edge then corrected center) — NO screen change; abandoned this path and pivoted to the Games tab (bottom nav).
3. Games tab: "TRAIN YOUR BRAIN / Games", "Showing 42 of 42 games". Opened the "Symbol Tracker" card (tag "Track"/"Attention").
4. Detail page: red "Play Symbol Tracker" button ("Mastery 0", "Records: No sessions yet"). Tapped it -> difficulty/tutorial setup page (Difficulty "Normal", "How to play", "Try a demo").
5. Tapped the red "Start game" button -> LIVE game launched. Baseline captured to this note at T+20:59.
6. Pressed HOME (T+21:17). By then the Round-1 timer had already expired on its own (result screen "Not quite / Time ran out", Score still 0, Round still 1/5).
7. Different app: launched Chrome; confirmed Chrome in the foreground ("Welcome to Chrome / Sign in to browse easier across devices" -> tapped "Use without an account" -> "Enhanced ad privacy in Chrome"). Training app backgrounded ~2m51s.
8. Returned to com.braintraining.app via `manage_app launch` -> app resumed onto a PAUSE overlay (no cold start to Home).
9. Tapped "Resume" -> back in the SAME session: "Round 1/5", "Score 0", result panel "Not quite", red "Next round". (Attempt 1 had interrupted on the round-RESULT screen.)
10. ATTEMPT 2 (mid-round): tapped "Next round" so a round was live, then immediately pressed HOME and launched Chrome. Away ~35 s.
11. Relaunched com.braintraining.app -> SAME pause overlay ("Paused"), tapped "Resume" -> back in the SAME live mid-round state (T+27:26).

## Observed outcome
BASELINE (T+20:59): Symbol Tracker (Games tab), live round. Exact text:
- "Round 1/5" + "Track 2 symbols"
- "Score 0" / "Score 0"  |  "Pause"
- "Memorize the highlighted symbols..."
- 3x3 symbol grid, two tiles highlighted.
- NOTE: NO numeric timer on this game; the round counter + progress bar are the only time indicators.

WHILE BEING INTERRUPTED — exact text after returning (T+25:02 and T+27:06):
- "Paused"
- "The challenge is hidden and the timers are frozen."
- Buttons "Resume" (red) / "Quit"

AFTER RESUMING — exact text:
- Attempt 1 (T+25:20): "Round 1/5" | "Score 0" | "Not quite" | "You found 0 of 2 tracked symbols" | "Time ran out — your picks were submitted as they stood." | red "Next round"  => Round and Score identical to baseline.
- Attempt 2 (T+27:26): "Round 2/5" | "Score 0" | "Pick out the tracked symbols" | "7s to answer" | "0 of 2 symbols selected"  => returned to the SAME live mid-round state; the answer window had NOT elapsed during ~35-50 s away, i.e. the timer was frozen.

VERDICT: The journey DID execute (running game -> switched to Chrome -> returned). Game state and score SURVIVED: the app restored the same Symbol Tracker session (Round number and Score unchanged; attempt 2 returned to the same still-live round). The TIMER did NOT run on in the background — the app freezes it and shows a "Paused / The challenge is hidden and the timers are frozen." overlay on return, and the round does not advance on its own while you are away. So the state survived as a PAUSED snapshot, not as a continuously running timer.

## Defects
1. Home "Speed Focus" workout button did not respond to two taps (no screen change) — the intended start path via Home was unusable; worked around via the Games tab.
2. On returning to the app the session is ALWAYS forced onto a "Paused" overlay ("the timers are frozen") — there is no way to observe whether a timer would have continued across the interruption, and the game cannot be verified to keep running in the background.
3. Chrome never held the foreground on this build: it showed its splash and then fell back to the launcher (Steps 12-14, 26), so the "different app" foreground had to be re-established by hand.
4. Symbol Tracker shows no numeric timer value at all (only a round counter "Round n/5" + progress bar), so a numeric timer baseline could not be recorded.
5. Attempt 1 interrupted on a round-RESULT screen because the round timed out before the interruption; only attempt 2 was a genuine mid-round interruption.
