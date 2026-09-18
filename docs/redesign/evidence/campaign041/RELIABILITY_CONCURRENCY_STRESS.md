# Reliability, Concurrency, and Lifecycle Stress

## Bounded actions exercised

`[OBSERVED_RUNTIME]` and `[VERIFIED_TEST]` checks covered the current high-risk UI/database seams without infinite loops or destructive broad resets:

- repeated Start/Continue/result/Finish attempts around the workout path;
- pause/resume and force-stop/relaunch around an active game;
- route push/pop and repeated deep-link entry for game/detail/data routes;
- tutorial transition and game start with the shared GameHost;
- reward/economy claim replay and operation-ID dedupe through targeted tests;
- rapid-looking Favorite/settings/reward operations through concurrency-focused tests;
- Next Game and final completion transition replay;
- offline/startup and release launch after Metro was stopped;
- backup wipe/import confirmation, including the moving two-step confirmation button;
- ADB/UI hierarchy/logcat inspection after each material state change.

No observed replay produced a duplicate session identity, duplicate currency operation, duplicate rating key, or second workout completion. The four-game path and the interruption/resume path both preserved the expected index and data after force-stop.

## Current intermittent observation

`[OBSERVED_RUNTIME]` One debug matrix run displayed Home’s `Couldn’t load today’s workout` retry state. Logcat showed bootstrap success followed by `[workout] load failed` with `NativeDatabase.prepareAsync ... NullPointerException`. A cold force-stop/relaunch recovered Home and subsequent exact matrix replay ended with `REPRO_FINAL_ERROR=absent` and `REPRO_FINAL_LOGBOX=absent`.

This was not minimized to a deterministic reproduction, did not recur in the exact replay, and has no proven root cause. It is therefore an unresolved Medium/conditional reliability observation, not a repair claim. The likely source seam is the `useWorkout → workouts.reconcile → getByDate → expo SQLite getFirstAsync` path, but that is an investigation lead, not a root-cause finding.

## Test-quality/race notes

The targeted tests are strong on authoritative writes: real migrations/triggers, append-only behavior, rollback windows, operation IDs, reward claim-all, rating/session identity, workout reconciliation, and settings serialization. Two passing tests emit mock-only noise: a results CTA mock lacks `db.workouts.reconcile`, and a minimal settings layout mock emits route warnings. These do not reproduce in the native current build but should remain visible as test-maintenance debt.

## Conclusion

`[INFERRED]` Current local persistence is resilient under the exercised bounded stress. The single unreduced SQLite startup observation, plus absent physical-device and production-network stress, prevents a claim of exhaustive reliability certification.

