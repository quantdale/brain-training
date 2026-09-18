# Campaign 050 Native and Metro-Free Validation

## Build and artifact

- `apps/mobile/android/gradlew.bat assembleDebug --no-daemon` — **PASS**.
- `apps/mobile/android/gradlew.bat assembleRelease --no-daemon` — **PASS**.
- Release artifact: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
- SHA-256: `8F111FB590B7957AC710A05A53A422AACC1A95DE8C609F7B01152C40141B1864`.
- Install: `adb -s emulator-5554 install -r -d` — **PASS**.
- Package path after install: `/data/app/.../com.braintraining.app.../base.apk`.

Gradle reported non-fatal environment/tooling warnings: Android SDK XML 4
versus tools understanding through 3, unset `NODE_ENV`, CMake path-length
warnings, hard-link fallback to copying, and deprecated Gradle features.
These were recorded rather than suppressed.

## Release launch

Metro was not running during the final direct launch. The bounded command

```text
adb -s emulator-5554 logcat -c
adb -s emulator-5554 shell am force-stop com.braintraining.app
adb -s emulator-5554 shell am start -W -n com.braintraining.app/.MainActivity
```

returned:

```text
Status: ok
LaunchState: COLD
Activity: com.braintraining.app/.MainActivity
TotalTime: 10047
```

After eight seconds, `com.braintraining.app` had a live PID and
`com.braintraining.app/.MainActivity` was the resumed/focused activity.
Filtered logcat contained no `FATAL EXCEPTION`, `ANR in`, `Application Not
Responding`, `ReactNativeJS: Error`, `RedBox`, `database is locked`,
`OutOfMemoryError`, or `SIGSEGV` marker.

The ARTEMIS trace separately observed a first-install ANR dialog before a
bounded close/relaunch recovered Home. That observation is included in the
conditional verdict; the direct post-journey cold launch above is not used to
erase it.

## Web artifact

`npx expo export --platform web` completed successfully and reported 20 static
routes, including Home, Games, Results, Rewards, Profile, Data Management,
Game Detail, tabs, and the not-found route. Expo printed a tooling message
about forcefully exiting after export; the command completed with exit code 0.
