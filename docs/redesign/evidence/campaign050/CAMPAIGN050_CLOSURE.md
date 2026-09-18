# Campaign 050 Closure

**Terminal label:** `CAMPAIGN_050_RELEASE_CONDITIONAL` for the tested
Android/repository scope
**Start SHA:** `d67aba5`
**Candidate runtime source SHA:** `d67aba5`
**Runtime:** `braintraining-ui35` / `emulator-5554`, Android 15/API 35,
1080×2400, density 420 after restoration
**Scope:** integrated release-candidate certification; no Campaign 050
product-source change was made

Campaign 050 reconciled the post-049 candidate across repository gates, native
artifacts, Metro-free runtime, protected workout/persistence flows, the
42-game certificate, responsive/a11y evidence, performance probes, and known
external boundaries. The verdict is conditional because the release journey
observed a transient first-install Android ANR before a bounded close/relaunch
recovered the app, and the Android Files import surface was not fully
validated after the provider presented an ANR. Human, iOS, store-signing,
physical/OEM, and external-CI evidence also remain outside the executable
local boundary.

## Results

- **Repository gates:** PASS — full Jest, typecheck, lint, Expo Doctor,
  dependency policy, offline/secrets/workflow/runtime-QA/repo-state,
  registry, provenance, affected-map, task-ownership, and OpenSpec checks
  completed. Jest reported 559 passed suites, 4 skipped suites; 6,575 passed
  tests, 5 skipped tests; and 5 passing snapshots.
- **Native artifacts:** PASS — sequential `assembleDebug` and
  `assembleRelease` completed. The release APK was installed with
  `adb -s emulator-5554 install -r -d`; SHA-256 is
  `8F111FB590B7957AC710A05A53A422AACC1A95DE8C609F7B01152C40141B1864`.
  Build warnings were non-fatal: SDK XML/tool-version mismatch, unset
  `NODE_ENV`, long CMake paths, hard-link fallback, and Gradle deprecation
  notices.
- **Metro-free launch:** PASS after installation — the release activity cold
  launch returned `Status: ok`, `LaunchState: COLD`, `Activity:
  com.braintraining.app/.MainActivity`, `TotalTime: 10047`, with the activity
  resumed and no filtered fatal/ANR/React/RedBox/SQLite-lock/OOM/SIGSEGV
  markers. `npx expo export --platform web` also exported 20 static routes.
- **Protected Android journey:** PASS for ordinary in-app flows — ARTEMIS
  trace `b1b2be3a-6801-430b-b336-e89fda68f567` used only `emulator-5554` and
  emulator-local semantic actions. Cue Shift, Word Chain, Order Path, and
  Color Stroop all reached results; Home showed 4/4 saved; Progress retained
  48 sessions before and after force-stop/relaunch. Pattern Tap Back and
  Signal Watch completed ordinary standalone flows and returned without a
  crash.
- **Invalid route:** PASS — one emulator-local
  `braintraining://game/not-a-real-game` intent showed `Game not found`, the
  explanatory not-in-library text, and `Back to library`; Back returned to
  the app and Home remained usable.
- **Responsive/a11y matrix:** PASS — current release captures produced 12/12
  font-scale-2 and 12/12 compact surfaces across light/dark themes. Separate
  audits reported 0 measured violations across each 12-surface profile.
  Clipped rows are recorded as scroll-under-tab observations. The compact
  harness emitted one transient `null root node returned by
  UiTestAutomationBridge` message while continuing to a PASS manifest.
- **Performance/reliability:** PASS for the bounded local scope — current
  5k/20k history/progress/export and sync/quest/achievement probes passed;
  timestamped JSON baselines are tracked under `scripts/perf/baselines/`.
  Campaign 048's three-cycle release startup and bounded memory evidence are
  inherited without source changes.

## Conditional findings

1. The first ARTEMIS release launch after installation displayed an Android
   `Brain Training isn't responding` dialog. Two Wait actions reached Home;
   the mandated one-time Close app + cold relaunch then reached a responsive
   Home and all protected flows continued. This is retained as a transient
   first-install startup observation, not relabeled as a clean first-launch
   PASS.
2. Export reached the Android share sheet and was safely cancelled. Import
   reached the Android Files picker, but the provider presented an ANR during
   dismissal; no file was selected and no merge/replace/wipe was executed.
   Import picker usability is therefore **NOT VALIDATED**.
3. The local APK remains debug-signed. Human TalkBack/VoiceOver, physical
   Android/OEM behavior, iOS runtime, production/store signing, human
   system-provider usability, and GitHub runner execution remain external or
   manual boundaries.

## Evidence locations

- [Repository gates](./REPOSITORY_GATES.md)
- [Native release validation](./NATIVE_RELEASE_VALIDATION.md)
- [Protected-flow reconciliation](./PROTECTED_FLOW_RECONCILIATION.md)
- [Performance and accessibility reconciliation](./PERFORMANCE_AND_ACCESSIBILITY_RECONCILIATION.md)
- [Runtime notes](./RUNTIME_NOTES.md)
- [External boundaries](./EXTERNAL_BOUNDARIES.md)
- Raw current matrix: `D:\Temp\campaign050-matrix`
- Raw current compact matrix: `D:\Temp\campaign050-matrix\compact`
- ARTEMIS trace: `D:\Tools\artemis\traces\b1b2be3a-6801-430b-b336-e89fda68f567`
