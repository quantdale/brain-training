# Audit Map — Campaign 050

| Area | Evidence | Required check |
| --- | --- | --- |
| Repository gates | `.agent/VALIDATION.md`, validator outputs | full Jest, typecheck, lint, Doctor, dependency/offline/workflow/provenance/repo gates |
| Native artifacts | Gradle output and APK hash | sequential debug/release builds; release install and launch without Metro |
| Core journeys | Campaign 042/045/046 evidence plus current canaries | four-game workout, standalone games, result persistence, relaunch |
| Catalog | Campaign 046 registry/lifecycle matrix | 42 IDs and eight-domain coverage reconciled to current product lineage |
| Data integrity | Campaign 047 persistence/portability packet | migration, backup/import, idempotency, no destructive retained-device mutation |
| Product surfaces | Campaign 049 matrix plus current route smoke | Home/Games/Progress/Profile/Rewards/Data, invalid route recovery, a11y/state |
| Performance/reliability | Campaign 048 baselines | 5k/20k probes, startup/relaunch/resource summary and app-only log health |
| External boundaries | Campaigns 043/044 evidence | CI account/policy, human/platform, system-provider, and store limits remain explicit |
| Final state | closure + overnight handoff | exact SHA, HEAD/origin parity, clean tree, truthful verdict |
