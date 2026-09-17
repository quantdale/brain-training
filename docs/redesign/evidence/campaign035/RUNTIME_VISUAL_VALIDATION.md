# Campaign 035 native/runtime validation

## Runtime used

- Android package: `com.braintraining.app`
- Device: dedicated `emulator-5554`
- AVD: `braintraining-ui35`, Android 15 / API 35, 1080x2400, density 420
- Metro: repository app on port 8081 with ADB reverse to the emulator
- APK: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
- APK SHA-256: `80E9B29134FB70D7C45E30B7BB0FB6F6E90EE8D358B1880B9FA236E98A877D6A`

## Observed flows and surfaces

The before capture exercised direct deep-link navigation to Home, Games, Game
Detail, Progress, Profile, Rewards, Results, and GameHost intro in light and
dark. All 16 before entries were route-verified and nonblank.

The after changed-surface run exercised direct deep links to Game Detail and
GameHost intro in both themes. Game Detail rendered the identity cue, title,
mechanic, mastery, records, favorite, and Play action. The warm GameHost intro
rendered `memory.intro` with the identity mark, title, difficulty selector,
Start game, QA controls, tutorial, and tutorial actions. UIAutomator XML for
the retained warm outputs is in `D:\Temp\campaign035-runtime-after-warm`.

The first cold GameHost route stayed on a real `Loading… / Starting the game…`
state while Metro compiled the lazy module. Fresh logcat showed normal bundle
loading and database/progression bootstrap; after waiting for compilation, the
module rendered and the warm captures above were collected. This is recorded
as a harness/development warm-up observation, not hidden as a false visual
pass.

## Build and launch

- `apps/mobile/android/.gradlew.bat assembleDebug` — PASS (458 tasks; 55
  executed, 403 up-to-date).
- `adb -s emulator-5554 install -r ...app-debug.apk` — PASS (`Success`).
- ADB launcher start of `com.braintraining.app/.MainActivity` — PASS.
- Fresh logcat: `D:\Temp\campaign035-logcat-latest.txt`; no
  `FATAL EXCEPTION`, `SQLiteException`, `database is locked`, `ANR in`,
  ReactNativeJS error, or RedBox signature was found.

No new gameplay session was started as part of this visual-only slice; the
native run verified the real intro and its existing controls, while the
GameHost/Game Detail tests cover the preserved Start/Play seams.

