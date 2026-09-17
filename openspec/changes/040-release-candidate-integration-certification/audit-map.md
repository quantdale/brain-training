# Audit map — Campaign 040

| Surface / condition | Protected seam | Required proof |
| --- | --- | --- |
| Daily workout and standalone game | workout/session identity, Game SDK lifecycle, result persistence | emulator-local start/intro/play/result path or an honest unavailable classification; focused/current tests |
| Relaunch/background and local state | SQLite, migrations, profile/progression, no duplicate writes | force-stop/relaunch, UI/XML or read-only state inspection, filtered logcat |
| Games catalog and all 42 entries | generated registry, stable game IDs, detail/play routing | registry check plus runtime catalog count/identity collection and search/filter observation |
| Progress/history and Profile/Rewards/Data | analytics reads, ownership/idempotency, backup/delete safeguards | current native routes, drill-down/return observation, no destructive action without explicit need |
| Empty/error/invalid routes | recoverable navigation and truthful state | deep-link captures and retry/back behavior |
| Theme/accessibility/offline | semantic IDs, touch targets, local content, sensory settings | light/dark captures, automated a11y, system-condition toggles, offline route checks |
| Copy/debt/unsupported claims | locked no-medical-claim boundary, no stale ownership | source scan and current route/source review |
| Repository/release candidate | build, dependency lock, CI honesty | full practical validators, release build/install, current CI query and exact classification |
