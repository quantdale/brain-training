# Campaign 067 — certified artifact

**Source commit:** the 067-frozen tree (`a17c019` + this change's working
tree; final commit recorded at close)

## Identity

```
APK:   apps/mobile/android/app/build/outputs/apk/release/app-release.apk
SHA256: B7AA41024EAAD6D031FB76C953F8A0048B10B400930C034544B9387AB8338464
bytes:  109,598,109
package: com.braintraining.app  versionCode=1000  versionName=0.1.0
targetSdk=36  compileSdk=36  label='Brain Training'
signing: local debug-signed release (v2 scheme) — NOT a store artifact
```

## Embedded release bundle (proves the post-066 source)

```
assets/index.android.bundle
SHA256: 416DD85457931ED34903F1F07D3257AC2E5BEC5D482D926024A9E9967771070A
bytes:  4,879,768
```

Bundle-freshness markers (10/10 present; a stale pre-056 bundle cannot
contain them): `PRAGMA foreign_keys = ON` (065), `canonicalSeedToNumber`
(066), `canonicalClamp01` (066), `progressionSeedVersion`,
`workout-reroll:` (060), `deleteEmptyWorkoutInstances` (059),
`useSafeBack` (058), `MAX_QUEUED_TOASTS` (061),
`stabilizeDiscoverySnapshot` (061), `launchAnimation` (055).

## Permissions

`aapt2 dump permissions` diffed against
`scripts/android/expected-apk-permissions.txt`:
**PERMISSION_SET_MATCH (8 permissions)** — ACCESS_NETWORK_STATE,
INTERNET, MODIFY_AUDIO_SETTINGS, READ_EXTERNAL_STORAGE, VIBRATE,
WAKE_LOCK, WRITE_EXTERNAL_STORAGE, DYNAMIC_RECEIVER_NOT_EXPORTED.

## Build

`:app:assembleRelease --no-daemon --console=plain` →
`BUILD_EXIT=0` (full log `D:\Temp\campaign067-build.log`). Metro is not
required at runtime (bundle embedded); the device launches below ran
without a Metro server.
