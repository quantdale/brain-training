# Campaign 065 — bounded device pass

**Artifact:** release APK built from the 065 working tree at
(`apps/mobile/android`, `:app:assembleRelease`, Gradle
`BUILD SUCCESSFUL`)

- **SHA-256:** `3A3C4CC5EC1418825A6D4FC411423633E0605BCA8E0CB2CFBA074EED0397E5E8`
- **Bytes:** 109,604,369
- **Package:** `com.braintraining.app` 0.1.0 (debug-signed local release)
- Note: this artifact is the 065 verification build, **not** a new
  certification. The 063 artifact (`20e28c64…`) remains the last
  certified executable; 067 builds and certifies the final artifact.

**Target:** dedicated `emulator-5554` (`sdk_gphone64_x86_64`); all input
emulator-local (adb only).

## Probes

| # | Probe | Result |
|---|---|---|
| 1 | `adb install -r` | **PASS** — streamed install success |
| 2 | Cold launch (`am start -W`, LaunchState COLD) | **PASS** — Home rendered in 5,455 ms; hierarchy shows Home, today's workout (4 games), tabs |
| 3 | Warm force-stop relaunch | **PASS** — Home in 4,378 ms |
| 4 | SQLite audit (pulled DB) | **PASS** — `integrity_check: ok`, `user_version: 12`, 0 FK violations |
| 5 | **Crafted progression-fingerprint recovery** (065 fix proof) | **PASS** — see below |
| 6 | Logcat scan | **PASS** — 1,084 lines after the probes, zero `FATAL EXCEPTION` / `ANR in com.braintraining` / `FOREIGN KEY` / `ReactNativeJS.*Error` matches |
| 7 | Screenshot | `D:\Temp\campaign065-home.png` (176 KB) |

## Probe 5 detail (the 065 bootstrap-brick fix, proven on device)

1. Fresh install + first launch seeded the DB (`quests` 16,
   `achievements` 37, `quest_progress` 15, fingerprint present in
   `profile.settings_json`).
2. Force-stop; pull `/data/data/com.braintraining.app/files/SQLite/brain-training.db`.
3. Reproduce the hostile import state with a `better-sqlite3` script:
   delete `quests`, `achievements`, `quest_progress`,
   `achievement_unlocks` rows **while keeping the fingerprint** — exactly
   what a crafted replace-import produced.
4. Push the DB back, clear logcat, cold launch.
5. **Observed:** the app reached **Home** (no BootstrapRecovery loop),
   re-seeded the catalogs, and the pulled DB shows `quests` 16,
   `achievements` 37, `quest_progress` 9, integrity `ok`, v12,
   0 FK violations; logcat has zero FK/fatal markers.

Without the 065 fix this sequence fails with
`FOREIGN KEY constraint failed` and loops in the recovery screen.

## Not covered here (explicit)

- UI-driven crafted **import** via the Files picker and the wipe →
  Home-empty probe: deferred to the 067 runtime matrix (same recovery
  logic is proven at the DB level here; the UI paths are unchanged by 065
  except the added workout-changed emission, which is unit-tested).
- Font-scale-2 / compact / dark gameplay captures for the other 41
  games, landscape, RTL: 067 six-way matrix.
- `[perf]` device logging: release builds suppress it by `isDevBuild()`
  (unchanged); the 065 jest guard keys on `JEST_WORKER_ID`, which never
  exists on device, so device logging behavior is byte-identical.
