# Audit map — in-game-workout-next-leg

| Item | Evidence |
|---|---|
| In-game results have no Next Game | `apps/mobile/src/components/game-host/results.tsx` props `onRestart`/`onQuit` only |
| Done returns Home | `games/*/screen.tsx` `quitToLibrary` → `router.back()` (e.g. memory, attention-target-count) |
| Advance only on `/results` | `useWorkoutResultAdvance` imported only from `app/results.tsx` |
| 006r requirement | `openspec/changes/006r-core-integrity-correction/specs/daily-workout/spec.md` Sequential workout flow |
| Autobot detour | `scripts/qa/autobot.mjs` `flowWorkout` BACK Home → recent → `/results` |
