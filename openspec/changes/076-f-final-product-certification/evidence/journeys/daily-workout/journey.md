# Controller journey — `daily-workout`

- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro`, locked app `com.braintraining.app`
- ARTEMIS session: `ae7e82fe-fc6b-4ae3-8023-d5aeb373d6f7` (raw trace external to Git)
- Device: emulator-5570 / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)
- APK under test: `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994
- Device hash: installed base.apk matched e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f exactly (pulled from emulator-5570)
- Controller exit code: 0 (the CLI client's own 1500 s wait cap, NOT the journey outcome)
- Journey log: PRESENT (all four sections carry substantive content)

# Journey Log — com.braintraining.app (Daily Workout → First Game)

## Planned steps
1. Launch locked app `com.braintraining.app` and reach its usable home screen (dismiss/observe any splash, onboarding carousel, permission dialogs, login/paywall, or ads; if a hard blocker prevents reaching the home screen, record it explicitly and note the journey is NOT completed).
2. On the home screen, locate and open today's Daily Workout entry (prefer a "Daily Workout" / "Today's Workout" card; else Start/Play button or today/calendar tab).
3. Start today's daily workout and capture the workout composition shown (ordered list of games, counts, duration/difficulty).
4. Enter the first game of the workout and observe the transition into gameplay.
5. Consolidate the full journey into this note with the four required headings.

## Executed steps (what I really did, in order)
1. (Session start) Device was on the launcher with the keyguard showing and `com.braintraining.app` NOT running (`pidof` empty; `mCurrentFocus=null`). Dismissed the keyguard (KEYCODE_WAKEUP + `wm dismiss-keyguard`) and launched the app via a launcher-category `monkey` intent.
2. Frames were black; re-launched explicitly with `am start -n com.braintraining.app/.MainActivity` (pid 5716), and later with a Fast-Action Burst (launch + 6000 ms wait + tap).
3. Reached and read the app's Home screen (Milestone 1 done).
4. The app repeatedly ANR'd and was force-killed by the system (see Defects), returning the device to a black/launcher state; each time I re-launched with `am start -n com.braintraining.app/.MainActivity`.
5. Once the Home screen was stable, I tapped "Mental Rotation" in the "Today's plan" list (the first game of today's workout) — there was NO start control for the workout itself.
6. The Mental Rotation game intro screen loaded; I tapped "Start game".
7. Gameplay loaded (Round 1/5, Target/Candidate shapes, Same/Different) — transition into gameplay confirmed.

## Observed outcome (quote exact on-screen text)
Home screen (T+14:42, status bar 8:18):
- "BRAIN TRAINING" / "Home"
- Card: "+ TODAY" / "Today's Workout"
- "4 games · about 8 minutes · balanced across your recent training."
- "Your training is ready on this device and works offline."
- "Workout complete"
- "4/4 games saved. See today's progress for a summary."
- Red button: "See today's progress" / "4/4 games saved"
- "Today's plan":
  - "Mental Rotation" / "Spatial" — "Done" ›
  - "Sentence Builder" / "Language" — "Done" ›
  - "Reaction Time" / "Speed" — "Done" › (4th row below the fold, also Done)
- Bottom nav: "Home" (selected) | "Games" | "Progress" | "Profile"

Workout composition reported by the app: "4 games · about 8 minutes · balanced across your recent training." with today's plan = Mental Rotation (Spatial), Sentence Builder (Language), Reaction Time (Speed) + 1 more (below fold). The app rendered today's workout as ALREADY COMPLETE ("Workout complete / 4/4 games saved").

First game intro screen (T+15:07): "Rotate" / "Spatial" / "Mental Rotation"; instruction "Decide whether the candidate shape is a rotated copy of the target — or a different shape."; "Difficulty" options Easy / Normal / Hard / Expert / Adaptive with "Normal" selected; "Start game"; "How to play".

Gameplay screen (T+15:25) — the transition into gameplay:
- "Round 1/5" with progress bar; "1 of 5 rounds complete"; "Score 0"; "Pause"
- "14 seconds left"; "Is the candidate the target rotated?"; "Score 0"
- "Target" / "Target shape"; "Candidate" / "Candidate shape"
- Buttons: "Same" and "Different"

## Defects (or 'none observed')
1. TODAY'S WORKOUT WAS ALREADY COMPLETE — no "start today's daily workout" action existed. The Home card read "Workout complete" / "4/4 games saved. See today's progress for a summary." and its only control was "See today's progress"; all four "Today's plan" rows were "Done". Planned step 3 ("start today's daily workout") therefore could NOT be executed as specified — there was no start/play control to tap. I entered the first game via the "Today's plan" list instead (Mental Rotation → intro → "Start game").
2. APP ANR / FORCE-CLOSE (logcat-confirmed): ~30 s after each launch the app produced "ANR in com.braintraining.app (com.braintraining.app/.MainActivity)" ("Input dispatching timed out"), then "Force finishing activity com.braintraining.app/.MainActivity" and "Killing 5716:com.braintraining.app/u0a209 (adj 0): user request after error", leaving a black screen with the launcher focused (`pidof` empty). Reproduced at least twice (≈T+09:12 and ≈T+12:32–13:36). It repeatedly destroyed app state mid-journey and forced re-launches.
3. Prolonged blank/black frames with no visible UI while the app was nominally foreground (display state ON), before the Home screen rendered.
4. Accessibility/tooling defect: `uiautomator dump` fails on the live app ("ERROR: null root node returned by UiTestAutomationBridge") — the UI is a non-accessible canvas, so element indices had to be sourced from stale/previous dumps; older `/sdcard/ui*.xml` are stale artifacts and were not trusted.

Journey completion statement: the journey WAS executed and reached gameplay. The Home screen was reached, the workout composition was captured ("4 games · about 8 minutes · balanced across your recent training."; plan = Mental Rotation / Sentence Builder / Reaction Time + 1), and the transition into the first game's gameplay was confirmed ("Round 1/5", "Is the candidate the target rotated?", "Same"/"Different"). Caveat: the specific sub-step "START today's daily workout" could not be performed because the app reports today's workout as already complete (4/4 saved / all "Done"); the first game was entered from the "Today's plan" list rather than via a workout start button.
