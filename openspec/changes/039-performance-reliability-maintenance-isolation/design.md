# Design — Campaign 039

## Measure first

Use the current dev-only `[perf]` instrumentation, deterministic perf probes,
ADB launch timing, fresh logcat, route-verified native captures, and read-only
memory/runtime observations. Compare repeated observations on the same
`braintraining-ui35` AVD; do not compare absolute numbers to another host.

## Bounded treatment

| Concern | Evidence-led action | Protected behavior |
| --- | --- | --- |
| Bootstrap/startup | Measure DB init, progression seed, and first route readiness; repair only a reproducible redesign-created regression | Offline bootstrap, migrations, profile/progression state |
| Route/loading boundaries | Exercise Game Detail/GameHost, Progress, Profile/Rewards/Data and invalid/empty states; classify real loading vs tooling warm-up | Router, game/session identity, recoverability |
| Persistence/resume | Exercise background/foreground or stop/relaunch with existing profile and sensory state; inspect logs and DB invariants | SQLite, writes, backup/restore, workout/session identity |
| History/list work | Run existing opt-in perf probes and record same-host measurements | Read correctness and pagination/limits |
| Maintenance | Review current advisories/patch drift; only make a separately justified dependency change | Native build, offline boundary, lockfile stability |

No change is required if current evidence shows no material regression; an
evidence-only validated checkpoint is acceptable.

