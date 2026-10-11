# Controller journey — `background-foreground`

- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro`, locked app `com.braintraining.app`
- ARTEMIS session: `aba6ab58-25d5-4334-b9d9-09b72537ca1a` (raw trace external to Git)
- Device: emulator-5554 / AVD braintraining-ui35
- APK under test: `de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d`
- Controller exit code: 124
- Journey log: PRESENT

## Planned steps
1. Open com.braintraining.app and reach an ACTIVELY RUNNING game (live countdown timer + score).
2. Capture baseline: exact game name, exact timer text, exact score text (screenshot as evidence).
3. Interrupt: switch away to a DIFFERENT app, wait a bounded interval (~10s), then bring com.braintraining.app back to the foreground.
4. Observe post-return state: same game screen still displayed? quote exact timer + score; compare to baseline.
5. Finalize this log with headings and an explicit verdict (state/timer/score survived or not).

## Executed steps (in order)
- T+01:00 Home screen showed finished "Workout complete / 4/4 games saved" (NOT an active game).
- T+01:02 Tapped Games tab in bottom nav; games list opened.
- T+01:20 Opened "Odd One Out" detail page ("Scan", "Difficulty: Normal", "Start game" button).
- T+01:28 Detail page showed difficulty chips (Easy/Normal/Hard/Expert/Adaptive) + red "Start game".
- T+01:41 First tap at [500,580] for "Start game" was intercepted by the safety net (landed on "Adaptive"); retried via explorer element [12].
- T+02:13 Tapped "Start game" -> the live play screen appeared: "Round 1/6", "Score 0", "Tap the odd one out", countdown "11.0s". (Odd item = ● above; grid of ▲.)

## Baseline (captured at T+02:13, game running)
- Game: Odd One Out - play screen
- Round: "Round 1/6" (progress "1 of 6 rounds complete")
- Score: "Score 0"
- Timer: "11.0s" (live countdown)
- Prompt: "Tap the odd one out"

## Observed outcome (post-return)
(pending)

## Defects
(pending)

### Interruption executed (T+02:57 -> T+03:31)
- T+02:57 Launched a DIFFERENT app (Settings). Screenshot confirmed the "Settings" home list was in the foreground (game no longer foreground). Device clock 19:31.
- Bounded wait of 10 s executed (wait_for_delay 10000 ms).
- T+03:31 On return, foreground verified via `dumpsys window`: mCurrentFocus = com.braintraining.app/com.braintraining.app.MainActivity, topResumedActivity = braintraining/.MainActivity.
- The game app is showing its own PAUSE overlay (quoted exactly):
  - "Paused"
  - "The challenge is hidden and the timers are frozen."
  - Buttons: "Resume" / "Quit"
- Device activity event log (logcat -b events) timeline:
  - 19:31:25.258 settings topStateChangedWhenResumed (Settings became foreground)
  - 19:31:26.477 wm_stop_activity com.braintraining.app/.MainActivity (game backgrounded)
  - 19:31:45.714 wm_finish_activity com.android.settings/.Settings (user-terminated)
  - 19:31:45.719 am_kill com.android.settings (reason: "user request after error"; Settings had thrown "Input dispatching timed out" ANR at 19:31:24.905)
  - 19:31:46.124 wm_set_resumed_activity com.braintraining.app/.MainActivity
  - 19:31:46.222 wm_on_resume_called MainActivity RESUME_ACTIVITY (game resumed)
  => The game activity was stopped/backgrounded for ~20 s (19:31:26 -> 19:31:46) and came back with its session intact; the app protects itself with a pause overlay.


### Timed re-test, baseline Round 2 (T+08:50)
- Fresh round started: "Round 2/6" (progress "2 of 6 rounds complete"), "Score 0", countdown "11.2s" (element dump showed it at "9.5s"). Board: circles ● with one square ■.
- This is the tight baseline: I will background the app immediately (~2 s) so the countdown is mid-flight.


### Timed re-test, post-return (T+11:47)
- Tapped "Resume" on the pause overlay -> same "Odd One Out" session reappeared: "Round 2/6", "2 of 6 rounds complete", "Score 0".
- BUT the round body showed: "Time's up" / "The odd one is highlighted — it beat the clock this time." and a "Next round" button. The countdown did NOT resume at its frozen value (~11.2s when switched away); the round had EXPIRED.
- => Round index and score survived the interruption; the countdown timer did not (round lost).


### Post-return state after 2nd interruption (T+13:33)
- Backgrounded Round 3 (started T+12:30) via Settings for ~1 min; relaunching the app showed the same session with "Paused / The challenge is hidden and the timers are frozen." Then tapped "Resume".
- Revealed state: "Round 3/6", "Score 0", prompt "Tap the odd one out", LIVE countdown "8.7s" (element dump "7.3s" => still ticking), 9-tile board with the odd item (square) at middle-centre (Item 5).
- => Round index and score preserved here; this round did NOT show "Time's up" (unlike Round 2), i.e. the countdown was still live after the interruption.


### Controlled trial #2 (Round 4), T+16:44
- Burst dispatched: tap "Next round" (advances past Round 3 "Time's up") + launch Settings -> Settings foreground, game backgrounded within ~1 s of the new round starting.
- Now returning to the app to tap "Resume" and read the same round's timer/score.


### Controlled trial #2 (Round 4) result, T+17:46
- Round 4 started T+16:44 via "Next round" and backgrounded to Settings within ~1 s (same burst); app relaunched T+17:34 showing "Paused"; tapped "Resume".
- Revealed state: "Round 4/6", "4 of 6 rounds complete", "Score 0", prompt "Tap the odd one out", countdown "9.3s" (element dump "9.0s") -> STILL LIVE / ticking after ~62 s backgrounded.
- => Timer was frozen during backgrounding and resumed mid-countdown (not restarted, not expired). Consistent with Round 3 trial. The earlier Round 2 "Time's up" occurred after the game had been resumed in the FOREGROUND for >1 min during a messy recovery (Settings ANR), i.e. foreground expiry, not background running.

