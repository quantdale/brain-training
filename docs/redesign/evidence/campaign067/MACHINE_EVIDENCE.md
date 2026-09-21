# Campaign 067 — machine evidence (re-runnable from Git)

## Artifact hashes

```
SHA256(app-release.apk) = b7aa41024eaad6d031fb76c953f8a0048b10b400930c034544b9387ab8338464
109,598,109 bytes
SHA256(assets/index.android.bundle) = 416dd85457931ed34903f1f07d3257ac2e5bec5d482d926024a9e9967771070a
4,879,768 bytes
```

Bundle markers present: 10/10 (see `ARTIFACT.md`).

## Package identity (`aapt2 dump badging`)

```
package: name='com.braintraining.app' versionCode='1000' versionName='0.1.0'
targetSdkVersion:'36' compileSdkVersion='36'
application-label:'Brain Training'
```

## Log filter (re-runnable)

```
adb -s emulator-5554 logcat -d | Select-String -Pattern \
  "FATAL EXCEPTION|isn't responding|ANR in|SQLiteException|SQLiteConstraintException|RedBox|E ReactNativeJS"
# 067 result: 0 matches over 5,180 lines (matrix dump outside Git)
```

## Build provenance command

```
./gradlew.bat :app:assembleRelease --no-daemon --console=plain
# BUILD_EXIT=0; log D:\Temp\campaign067-build.log
```

## SQLite audit (pulled after the completion journey)

```
integrity_check = ok        user_version = 12        foreign_key_check = 0 rows
duplicate (session_id, domain) rating rows = 0
game_sessions: 1 row (speed-tap-rush, xp 10, normalized 0)
currency_ledger: +2 gameplay
rating_history: Speed -14, Attention -7; domain_ratings 986 / 993
```
