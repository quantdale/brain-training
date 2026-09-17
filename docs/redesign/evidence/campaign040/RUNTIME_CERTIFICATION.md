# Campaign 040 runtime certification

## Device and artifact

- AVD: `braintraining-ui35`
- ADB serial: `emulator-5554`
- Android: 15 / API 35, `sdk_gphone64_x86_64`
- Display: 1080x2400, density 420; final font scale 1.0; animation scales 0
- Final release APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- Final APK SHA-256: `1FF87618F190513BC04A84BA597BC0BE8764317EA8B5BC4720683EB4BE539DAA`
- Install: `adb -s emulator-5554 install -r -d ...app-release.apk` — PASS

## Broad surface matrix

`node scripts/qa/ui-capture.mjs --device emulator-5554 --out
D:\Temp\campaign040-runtime-after-all-fixes --surfaces
home,games,game-detail,progress,progress-activity,progress-detail,profile,
rewards,data-management,results,game-intro --theme light,dark`

Result: **22/22 PASS**, route-verified and nonblank. The matching pre-repair
matrix is under `D:\Temp\campaign040-runtime-before`.

`node scripts/qa/a11y-audit.mjs --dir
D:\Temp\campaign040-runtime-after-all-fixes --density 420 --json ...`

Result: **0 violations across 22 surfaces**. The Games XML reported one
partially visible bottom card per theme at the initial scroll position; it is
ordinary viewport clipping and was reachable by scrolling, not an undersized
or unlabelled control.

## Executed journeys

- Daily workout: Home `Start workout` → real first leg `Cue Keeper` → Game 1
  intro → `Start game` → live stream board. Pause exposed frozen timers and
  `Resume`/`Quit`; tapping `Quit` returned to Home with `0/4` complete. The
  full four-game workout was not played to completion in this pass.
- Standalone game: final release deep link to Memory → normal difficulty → all
  five rounds exercised with controlled failure input → in-game results. The
  result XML reports `Session complete`, `0/5`, `+10 XP earned!`, and
  `+2 coins · Progress saved`; no tutorial overlay was present over result or
  round CTAs. Artifacts are under `D:\Temp\campaign040-final-memory`.
- Persistence/relaunch: `Done` returned to Home; a force-stop/relaunch then
  opened generic Results and showed the saved Memory session (`0%`, `Played
  Today`, `+10 XP`). This proves local result persistence across relaunch; a
  mid-game process-death resume was not claimed as a native journey here.
- Games discovery: a scroll scan collected all 42 base `game-card-*` IDs from
  24 UIAutomator XML frames. The current Games route showed `Showing 42 of 42
  games`; search `memory` showed `Showing 7 of 42 games` and the Memory card.
- Progress, Profile, Rewards, Data Management, Results, Game Detail, and Game
  Intro all arrived through the final light/dark route matrix. No destructive
  Data Management action was used.
- Invalid/empty routes: unknown game, unknown detail, and `results?id=not-a-result`
  rendered recoverable states. The invalid Results `Browse games` action was
  physically tapped and returned to Games.

## Offline condition

The dedicated emulator was observed with global airplane setting `1`, Wi-Fi
reported disabled (`dumpsys wifi`: `Wi-Fi is disabled`), and mobile data
disabled. Home, Games, and Progress remained usable and displayed local/offline
copy. Original settings (`airplane=0`, Wi-Fi/data enabled) were restored and
verified afterward.

## Logcat

After clearing logcat and cold-starting the final release, the retained
799-line sample contained no `FATAL EXCEPTION`, ANR, SQLite lock/corruption,
ReactNativeJS error, RedBox, or activity-start failure signature.

## Evidence limits

This file does not claim all 42 mechanics were manually played, a full daily
workout was completed, human accessibility approval, iOS/physical-device
coverage, store signing, system document-sheet behavior, or external CI
success.
