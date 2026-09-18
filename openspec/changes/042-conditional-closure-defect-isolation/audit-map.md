# Audit map — Campaign 042

| Surface / condition | Protected seam | Required proof |
| --- | --- | --- |
| Runtime reload/startup | Expo SQLite handles, initialization, offline bootstrap | Pre/post NPE logs, focused adapter tests, release cold/transition/relaunch |
| Results reachability | Results content order and navigation | Font-scale-2 pre/post XML/pixels and automated a11y audit |
| Representative games | Game mechanics, session identity, scoring, rewards | Three real mechanic observations, explicit deterministic completion, SQLite invariants |
| Persistence/relaunch | Local state, favorite/theme, pause/resume, result retention | Force-stop/offline relaunch and direct database checks |
| Release accessibility | Bundled release artifact, route/theme surfaces, semantic controls | Non-debuggable no-Metro install, 22-surface manifest, XML/a11y audit |
| Governance and CI | Durable state, OpenSpec binding, workflow honesty | Repository validators, external run/step/log classification, adversarial second pass |
