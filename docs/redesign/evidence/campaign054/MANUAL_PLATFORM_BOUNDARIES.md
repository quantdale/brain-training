# Campaign 054 — Manual / Platform Boundaries

**Status:** availability re-checked on 2026-09-19; unavailable capabilities
remain `MANUAL_PLATFORM_PENDING` with executable handoffs.
**Date:** 2026-09-19

## Availability checks performed

| Capability | Check | Result | Disposition |
| --- | --- | --- | --- |
| Authorized physical Android | `adb devices` lists only `emulator-5554` (`braintraining-ui35`) and `emulator-5556` (`atd35`, user's runtime) | unavailable | `MANUAL_PLATFORM_PENDING` |
| iOS / macOS runtime | Host is Windows (`win32`); no macOS/Xcode environment | unavailable | `MANUAL_PLATFORM_PENDING` |
| VoiceOver | Requires iOS/macOS | unavailable | `MANUAL_PLATFORM_PENDING` |
| TalkBack (human-quality) | `com.google.android.marvin.talkback` is installed on the dedicated emulator; human-quality traversal cannot be performed by an agent | unavailable | `MANUAL_PLATFORM_PENDING` (see technical-traversal note) |
| Production/store signing | Only `apps/mobile/android/app/debug.keystore` exists; no release keystore or credentials; built release APK verified signed with `CN=Android Debug` (cert SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`) | unavailable | `MANUAL_PLATFORM_PENDING` |
| Store-install path | No Play Console/store account access or release-track artifact | unavailable | `MANUAL_PLATFORM_PENDING` |
| Independent human participant | No human participant in this session | unavailable | `MANUAL_PLATFORM_PENDING` |
| Human system-provider usability | The technical picker path was exercised emulator-locally; human judgment of the system Files UI is not reproducible by an agent | unavailable | `MANUAL_PLATFORM_PENDING` |

## Technical accessibility note (not a human TalkBack pass)

The emulator has the TalkBack package installed. Campaign 043 recorded that
the secure accessibility setting contained only the ARTEMIS helper and chose
not to enable TalkBack without a human traversal protocol. Campaign 054
re-verified the availability and preserves the same boundary: automated
hierarchy/a11y audits (zero measured violations through Campaigns 042-051) and
stable semantic IDs are recorded as technical evidence, but TalkBack focus
order, announcements, rotor behavior, gesture discoverability, and human
reading quality are **not** claimed.

## Executable handoffs

### H-1: Physical/OEM Android startup + usability
1. Install the exact recorded release APK (`app-release.apk`, SHA-256
   `1B6EBC20498785F9498A769F8F57968D9FB18C63DBBB19528F3E4954B0FB985F`) on a
   physical Android 10+ device.
2. Record `am start -W` timings for first launch, force-stop/relaunch, and
   offline launch; capture logcat and any ANR traces.
3. Exercise Home → Games → Game Detail → one game → Results; verify no
   duplicate sessions in the device DB.
4. Capture frames at default, compact, and system font scale 2.

### H-2: Human TalkBack traversal (Android)
1. On an automation-owned physical or emulated device, enable TalkBack.
2. Traverse Home, Games, Game Detail, GameHost, Results, Progress, Profile,
   Rewards, and Data Management with double-tap activation.
3. Record focus order, announcements, unreachable controls, and gesture
   discoverability.

### H-3: iOS / VoiceOver runtime
1. On macOS with Xcode, build the Expo iOS target.
2. Verify launch, Home, Games, gameplay, Results, Data Management export.
3. Traverse core surfaces with VoiceOver and record findings.

### H-4: Production signing + store path
1. Generate/obtain the release keystore (not stored in this repository).
2. `assembleRelease` with the release signing config and verify the signature.
3. Upload to the store track, install from the store, and smoke-test launch +
   offline behavior.

### H-5: Independent human acceptance
1. Hand a store-equivalent build to a participant who has not seen the
   implementation.
2. Record first-run comprehension, task completion, and any blocking friction.

## Boundary statement

No fabricated success is claimed for any item above. All repository-owned
technical equivalents that could be executed were executed and are recorded in
this campaign's evidence packet.
