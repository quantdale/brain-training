# Campaign 032 runtime and visual validation

## Device and build

- Disposable AVD: `braintraining-c030b`
- Serial: `emulator-5556`
- Android 35 Google APIs x86_64, 1080×2400, density 420, phone-oriented
  normal profile, host GPU
- Protected user-owned `braintraining-ui35` / `emulator-5554` was not touched.
- All actions were emulator-local ADB/deep-link actions; no host mouse,
  keyboard injection, foreground stealing, or desktop-coordinate automation was
  used.
- `apps/mobile/android/gradlew.bat :app:assembleDebug --no-daemon`: **PASS**,
  353 actionable tasks.
- APK: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
- APK SHA-256:
  `80E9B29134FB70D7C45E30B7BB0FB6F6E90EE8D358B1880B9FA236E98A877D6A`
- Package installed: `com.braintraining.app`, version `0.1.0`.

## Light/dark rendered pixels

`node scripts/qa/ui-capture.mjs --device emulator-5556 --out D:\Temp\campaign032-runtime-after --surfaces games,game-detail,game-intro --theme light,dark`

Result: **6/6 PASS**. Every entry in
`D:\Temp\campaign032-runtime-after\manifest.json` is nonblank, has a
non-empty XML tree, and is route-verified. PNG/XML sizes:

| Theme | Games | Game Detail | Game Intro |
| --- | ---: | ---: | ---: |
| Light | 223,905 / 11,383 | 226,123 / 30,336 | 185,973 / 10,586 |
| Dark | 213,765 / 11,383 | 199,792 / 30,336 | 176,130 / 10,586 |

The first number is PNG bytes and the second is XML bytes. Direct visual
inspection confirmed actual Games Suggested Next/Browse content in both themes,
identity/mechanic/Play-first Game Detail, and the standalone intro handoff.

## Stateful discovery evidence

Additional emulator-local captures are retained outside Git:

- `D:\Temp\campaign032-runtime-after\games-clean.png` / XML
- `D:\Temp\campaign032-runtime-after\games-search-memory.png` / XML
- `D:\Temp\campaign032-runtime-after\games-filter-language.png`
- `D:\Temp\campaign032-runtime-after\games-favorites-populated.png`
- `D:\Temp\campaign032-runtime-after\games-favorites-empty.png`
- `D:\Temp\campaign032-runtime-after\no-results.png` / XML
- `D:\Temp\campaign032-runtime-after\game-detail-language-favorite.png`

The clean Games tree exposes Suggested Next, Browse All, and the current 42
count. The Memory query reduced results to 7; Language reduced results to 5;
the favorite replay reduced Favorites to one and the clean empty replay exposed
the dedicated empty-Favorites recovery; `zzz` exposed the dedicated no-results
recovery.

## Eight-family route evidence

Each of the following has a real PNG and UIAutomator XML under
`D:\Temp\campaign032-runtime-after\representatives\`, with title, identity
verb, and Play semantic nodes present:

`attention-visual-search`, `memory-prospective-cue`, `speed-reaction-time`,
`math-equation-builder`, `language-context-fit`, `logic-deduction-table`,
`flexibility-task-switch`, and `spatial-transform-match`.

## Logs and helper self-test

- `bash scripts/android/self-test.sh --no-boot` with the disposable AVD:
  **PASS**, 5 passes / 0 failures / 2 documented launcher-home warning skips.
  It verified boot, PNG capture, emulator-local power-key round trip, logcat,
  and the runtime-QA contract.
- Final logcat snapshot: `D:\Temp\campaign032-runtime-after\final-logcat.log`,
  64,020 lines; no `FATAL EXCEPTION`, AndroidRuntime fatal, RedBox, invariant,
  or unresolved-module pattern.
- The initial dev-client transport capture was rejected as invalid when it
  showed a blank/redbox frame; Metro was corrected to the emulator-reachable
  LAN/reverse transport before the authoritative 6/6 capture. The invalid
  frame is not counted as evidence.

