# Audit map — Campaign 039

| Surface / condition | Protected seam | Required proof |
| --- | --- | --- |
| Cold and warm app startup | offline bootstrap, SQLite initialization, progression hydration | ADB launch timing, dev-only perf records, fresh logcat, and no state-loss signature |
| Representative route transitions | lazy route loading, recoverable navigation, first interactive state | emulator-local route journey, route-verified native capture, and transition observations |
| Games catalog and search | catalog data, scrolling, search state, stable game identity | native interaction/timing observation and no route/session identity regression |
| Progress and history loads | local snapshot reads, chart/detail drill-down, empty-state truth | representative populated/empty route observations, perf records, and persisted-state check |
| Workout/game session start and result persistence | session identity, game lifecycle, result write, resume/relaunch | existing perf records, deterministic workout journey, relaunch/read-only persistence inspection |
| Background/relaunch and sensory settings | root lifecycle, queued local writes, profile state | force-stop/relaunch checks, filtered logcat, and unchanged persisted settings |
| Runtime warnings and memory | React/Android fatal signals, render churn, process health | fresh logcat, `dumpsys meminfo`, and measured before/after comparison where a change is made |
| Dependency/maintenance surface | package compatibility, CI honesty, offline boundary | lockfile/package diff review, dependency audit, workflow validator, and build/install if touched |

