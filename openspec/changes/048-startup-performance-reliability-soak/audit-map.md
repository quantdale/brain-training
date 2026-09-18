# Audit Map — Campaign 048

| Area | Evidence | Required check |
| --- | --- | --- |
| Release launch | `D:\Temp\campaign048-release-content-cycle*.png` | three force-stop/relaunch cycles and Activity timing |
| Home readiness | semantic `Today's Workout` poll and screenshots | distinguish launch from content readiness |
| Repository scale | `scripts/perf/baselines/perf-*.json` | 5k/20k query, progress, export, quest, achievement probes |
| Runtime health | app-PID logcat and activity state | no app fatal/ANR/React/SQLite/lock/OOM markers |
| Bootstrap/persistence | Campaign 046 Metro/perf markers | DB init, progression, first interaction, persist outcomes |
| Source decision | current SHA and measured sample | no optimization without a reproduced material regression |
