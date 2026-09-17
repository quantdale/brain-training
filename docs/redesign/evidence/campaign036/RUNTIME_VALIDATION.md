# Campaign 036 native/runtime validation

## Runtime used

- Android package: `com.braintraining.app`
- Dedicated device: `emulator-5554`
- AVD: `braintraining-ui35`, Android 15 / API 35, 1080x2400, density 420
- Metro: repository app on port 8081 with ADB reverse to the emulator
- APK: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
- APK SHA-256: `80E9B29134FB70D7C45E30B7BB0FB6F6E90EE8D358B1880B9FA236E98A877D6A`

No physical device or user-owned emulator was used.

## Clean-install route

After clearing app data and launching the deep link, the settled Home state
was checked through UIAutomator XML. The existing
`home-workout-continue` Start workout CTA and the new `home-local-trust` line
were both present, and the `home-loading` state was absent. The matching final
settled artifacts are `D:\Temp\campaign036-final-home-ready.xml` and
`D:\Temp\campaign036-final-home-ready.png`.

The core light/dark matrix was then captured with the repository UI capture
tool: 14/14 requested entries were route-verified and nonblank in each of the
before and after directories. The after XML confirms:

- Home: the local/offline line and existing Start workout action;
- Rewards: `rewards-collection-intro` and the unchanged `3/12` collection;
- Data Management: `data-storage-summary-value` with `Ready`;
- Progress and Game Detail: honest no-session states.

## Actual first-play flow

Using emulator-local ADB taps on the Home CTA, the app loaded the real first
workout GameHost route for Cue Keeper (`memory-prospective-cue`). The observed
sequence was:

1. GameHost intro rendered `memory-prospective-cue.intro` with
   `Today's workout, game 1, ready to start`, `Start game`, `How to play`,
   `See an example`, and the development-only tutorial skip.
2. `See an example` opened the actual tutorial example. Its XML contained the
   tutorial status and `memory-prospective-cue.tutorial-next` (`Got it`).
3. `Got it` returned to the intro, and `Start game` entered the live board.
4. The live board XML contained `memory-prospective-cue.screen`,
   `memory-prospective-cue.round.1` (`Round 1/5`), score, pause, briefing, and
   the existing stream action.

Raw XML checkpoints are retained at `D:\Temp\campaign036-intro.xml`,
`D:\Temp\campaign036-tutorial.xml`, and `D:\Temp\campaign036-game.xml`.
The app data was cleared again afterward for the final clean Home/logcat
sample; no session was retained as Campaign 036 evidence.

## Build, install, and logcat

- `apps/mobile/android/.gradlew.bat assembleDebug` — **PASS**, 458 actionable
  tasks; 55 executed and 403 up-to-date; `BUILD SUCCESSFUL`.
- `adb -s emulator-5554 install -r ...app-debug.apk` — **PASS**, `Success`.
- Fresh relaunch/logcat sample — **PASS** for the bounded clean-install
  sample. Bootstrap logs reported successful database initialization and
  progression loading; the targeted scan found no `FATAL EXCEPTION`,
  `SQLiteException`, `database is locked`, `ANR in`, ReactNativeJS error/
  failed, RedBox, or unresolved-module signature.

The first lazy GameHost load showed its real loading state while Metro compiled
the module; after it settled, the intro/tutorial/live-board states above were
captured. This was recorded as an observed development warm-up, not hidden as
a pass.

