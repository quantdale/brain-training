# Campaign 049 Runtime Notes

- Runtime owner: `emulator-5554` / `braintraining-ui35` only. No host cursor,
  host keyboard, ARTEMIS, or computer-use automation was used.
- All new captures used the release APK and did not depend on Metro. The APK
  was rebuilt after the native tab-label change and installed with `adb
  install -r -d`.
- The first release build completed all compile/link/resource/lint/signing
  stages but failed at `:app:packageRelease` in the incremental splitter. A
  direct rerun of the same task passed in 1m52s without source changes. This
  is recorded as a transient generated-artifact packaging issue, not a source
  regression.
- One compact dark capture emitted `ERROR: null root node returned by
  UiTestAutomationBridge`; the harness retried/recovered and the final
  manifest was `[PASS] 12 surface capture(s)`. No app crash was observed.
- Post-install cold launch reported `Status: ok`, `LaunchState: COLD`,
  `Activity: com.braintraining.app/.MainActivity`, and `TotalTime: 6426`.
  App-PID log inspection had no fatal/ANR/React/SQLite-lock/OOM marker.
- The capture harness restored display size/density, font scale, rotation, and
  system light theme. The final ADB readback is recorded in
  `CAMPAIGN049_CLOSURE.md`.
