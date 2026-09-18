# Design — Campaign 048

Use the existing Metro-independent release APK on `emulator-5554` for launch
and relaunch evidence. Use the provided `scripts/perf/run-probes.mjs` for
repeatable node-side repository measurements and retain its timestamped JSON
baselines. Correlate semantic content readiness with the Activity launch time,
but record UIAutomator polling overhead separately. Filter logcat by the app
PID and never classify shell-side UIAutomator contention as an app crash.

Use bounded samples and document the sample size. If measured behavior is
within the existing release boundary, record the observation and make no code
change.
