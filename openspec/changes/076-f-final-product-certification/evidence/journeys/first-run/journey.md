# Controller journey — `first-run`

- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro`, locked app `com.braintraining.app`
- ARTEMIS session: `53f77102-71f7-430b-b352-3e3ff211d084` (raw trace external to Git)
- Device: emulator-5554 / AVD braintraining-ui35
- APK under test: `de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d`
- Controller exit code: 0
- Journey log: PRESENT

## Planned steps
1. Force-stop and clear app data via ADB (`pm clear com.braintraining.app`) to guarantee a true fresh-install state.
2. Launch com.braintraining.app from the launcher / via `am start`.
3. Step through the entire first-run onboarding flow screen-by-screen, recording each screen's exact on-screen text and what the app asks for (permissions, notifications, account, personalization, etc.).
4. Land on the app's home screen and report every screen seen and everything the app requested.

## Executed steps
1. T+01:02 — Observed Android home screen; com.braintraining.app not running.
2. Ran `pm clear com.braintraining.app` via ADB -> output `Success`; package confirmed present (`package:com.braintraining.app`).
3. Launch attempt #1 (manage_app launch + wait 4s) -> app showed blue splash; after ~8s it returned to the Android launcher. logcat: `ANR in com.braintraining.app (.MainActivity)`, `29% ... faults: 17126 minor`, `Force finishing activity`, `Killing ... user request after error`, MainActivity EXITING.
4. Launch attempt #2 (manage_app launch + wait 8s) -> same result: returned to launcher; logcat again `MainActivity EXITING`, `no app thread`.
5. Launch attempt #3 via `am start -W -n com.braintraining.app/.MainActivity` -> `Status: ok`, `LaunchState: COLD`, `TotalTime: 6672`; `topResumedActivity=com.braintraining.app/.MainActivity`. App stayed up.
6. T+04:36 — First captured app frame: the Home screen (no welcome anywhere).
7. To rule out that the ANR had skipped onboarding, re-ran `pm clear` (Success) + `am start` cold launch -> `LaunchState: COLD`, TotalTime 8952, resumed. App again went straight to Home.
8. T+05:38 — Confirmed the post-clear first-run screen is the Home screen itself. No welcome, no permission dialog, no onboarding carousel.
9. Inspected the package: only ONE activity exists (`com.braintraining.app/.MainActivity`); requested permissions are all install-time/auto-granted (MODIFY_AUDIO_SETTINGS, INTERNET, ACCESS_NETWORK_STATE, VIBRATE, WAKE_LOCK, DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION) — NO runtime permissions, so no permission prompts are even possible.
10. Extracted and searched the Expo JS bundle (`assets/index.android.bundle`): navigation is a RootStack + bottom tabs (Home/Games/Progress/Profile); no onboarding/welcome/first-run route or flag exists. The strings "Welcome to Color Stroop!", "your name", "choose your" are in-game copy, not onboarding.
11. T+09:17 — Opened the Profile tab: shows default fresh-install state ("Level 1", 0 XP, 0 streak, 0 coins, avatar "Player", "Your training record is saved on this device."). No setup prompt present.

## Observed outcome (quote exact on-screen text)
Screen A — App splash (only transient first-run surface): solid blue background with a white chevron/"A"-shaped logo. NO text, NO buttons, NO controls.
Screen B — Home screen (exact text): "BRAIN TRAINING" / "Home" / "TODAY" / "Today's Workout" / "4 games · about 8 minutes · a balanced starting set." / "Your training is ready on this device and works offline." / "0/4" / "0 of 4 complete" / "Next: Mental Rotation" / "Start workout" / "Starts with Mental Rotation · 4 games" / "Today's plan": "Mental Rotation — Spatial — Now", "Sentence Builder — Language — Up next", "Reaction Time — Speed — Up next". Bottom bar: "Home", "Games", "Progress", "Profile".
Screen C — Profile tab (exact text): "PLAYER" / "Profile" / "Your level, streak, rewards and settings." / "Player" / "Your training record is saved on this device." / "Level 1" / "No XP yet — play a game to start your level." / "0 TOTAL XP" / "0 DAY STREAK" / "0 COINS" / "Equipped: Classic Ring, Indigo, Classic" / "Streak" / "Longest streak 0 days" / "Protection items 0" / "Freeze × 0", "Shield × 0", "Recovery × 0".

What the app ASKED FOR: NOTHING. No permission prompts (the app declares zero runtime permissions), no notification opt-in, no account/sign-in, no sign-up, no name entry, no personalization question, no tour, no "Get started"/"Continue" button.

## Defects (or 'none observed')
1. DEFECT — Cold-start ANR after a fresh-install `pm clear`: com.braintraining.app hung on its splash and was force-finished/killed by the system on the first two cold launches (`ANR in com.braintraining.app (.MainActivity)`, 22.8s, `Killing 4978:com.braintraining.app ... user request after error`). The third launch launched normally; the behaviour was not 100% reproducible but the app's first post-clear cold start is unreliable.
2. FINDING — No first-run onboarding exists: from a genuine fresh-install state the app launches directly to its Home screen. The requested "complete first-run onboarding" journey therefore DID NOT EXECUTE, because the app presents no onboarding/welcome/permission flow to complete. This is reported explicitly, not as a pass.
