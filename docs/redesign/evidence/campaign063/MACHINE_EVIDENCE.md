# Campaign 063 — Machine-Checkable Evidence (re-runnable from Git)

## Artifact hashes

```
# APK (build output, NOT in Git):
SHA256(app-release.apk) = 20e28c64ee1ad75a28286fe1bfee1b9af7032ccab849911b776af296c50a1da2
109598957 bytes
# Embedded release bundle (proves post-056–062 source):
SHA256(assets/index.android.bundle) = a34bc0d12d504b8d676f590331a4228ca8a904792448d974ad30df17f91a20ef
4880616 bytes
```

Bundle-freshness markers (all present in the APK's embedded bundle —
a stale pre-056 bundle cannot contain them): `pipelineXpRatingHook`,
`WorkoutWriteConflictError`, `useSafeBack`, `MAX_QUEUED_TOASTS`,
`stabilizeDiscoverySnapshot`, `refresh and retry`,
`shouldScheduleFocusReload`, `deleteEmptyWorkoutInstances`,
`backOrFallback`, `launchAnimation`.

## Package identity (`dumpsys package com.braintraining.app`)

```
versionCode=1000 minSdk=24 targetSdk=36
versionName=0.1.0
signatures=PackageSignatures{9e3e2e version:2, signatures:[51ed3f60], past signatures:[]}
```

Signing: local debug-signed release (v2 scheme). NOT a store artifact.

## A11y audit (committed JSON)

`A11Y_AUDIT.json` in this directory (density 420, 12 surfaces):
8 tool-flagged items = 4 Progress tabs × 2 themes, all classified
hit-slop-compliant (SegmentedControl → Tappable expansion to 44dp);
0 unlabelled nodes anywhere.

## Log filter (re-runnable)

```
adb -s emulator-5554 logcat -d | Select-String -Pattern \
  "FATAL EXCEPTION|isn't responding|ANR in|SQLiteException|SQLiteConstraintException|RedBox|E ReactNativeJS"
# 063 result: 0 matches over 24,792 lines (full dump outside Git).
```

## Build provenance command

```
./gradlew.bat :app:assembleRelease --no-daemon --console=plain
# BUILD SUCCESSFUL in 3m39s, 60 executed / 471 up-to-date
# Source: exact e627473 (working tree clean of source modifications at build)
```
