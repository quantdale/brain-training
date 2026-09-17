# Campaign 034 native/runtime validation

## Native before/after captures

The repository capture harness ran against the dedicated Android target in
light and dark themes. The before/after manifests and exact pixel hashes are
indexed in `BEFORE_AFTER_PROFILE.md`. All four after captures were nonblank
and route-verified. The after Profile was also scrolled with ADB to confirm
that Rewards, Data, and Settings remain reachable below the long motivation
lists.

No host mouse movement, global keyboard injection, foreground-window control,
or physical-device interaction was used.

## ARTEMIS journey

ARTEMIS Flash trace `00117f8a-c773-4e4b-9473-87b9457cfdd1` ran on
`emulator-5554` with the package locked to `com.braintraining.app`. The task
opened Profile, scrolled through Motivation, observed the read-only `In
Rewards` status and the single pending entry, tapped `Open Rewards`, and
verified the existing Rewards inbox/collection. It did not tap Claim, buy,
equip, delete, export, or otherwise mutate data. The task completed.

The trace is external at
`D:\Tools\artemis\traces\00117f8a-c773-4e4b-9473-87b9457cfdd1`; raw trace
files are not copied into the repository.

## Build/install

`apps/mobile/android/.\gradlew.bat assembleDebug` completed successfully
(458 tasks; 55 executed, 403 up-to-date). The debug APK was installed on the
dedicated serial with `adb -s emulator-5554 install -r` and returned
`Success`. APK SHA-256:
`80E9B29134FB70D7C45E30B7BB0FB6F6E90EE8D358B1880B9FA236E98A877D6A`.

## Fresh launch log

After clearing logcat, force-stopping, and relaunching the package, the
captured sample was `D:\Temp\campaign034-logcat-latest.txt` (515 lines).
Searches found no `FATAL EXCEPTION`, `SQLiteException`, `database is locked`,
`ANR in`, `ReactNativeJS`, or `redbox` signature. This is a bounded fresh
launch sample, not a claim that all historical emulator logs are clean.
