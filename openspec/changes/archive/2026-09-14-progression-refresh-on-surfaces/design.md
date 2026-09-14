## Context

`initializeProgression` seeds definitions (fingerprint-gated) then `syncQuestProgress` + `syncAchievements`. Callers today: `_layout.tsx` bootstrap and Profile `loadProfile`. Home `loadClaimableRewardCount` → `collectClaimableRewards` reads rows as stored. Rewards `loadRewards` same. Wipe uses `wipeLocalData` → `clearTablesIgnoringTriggers(FK_DELETE_ORDER)` including `profile`, `quests`, `achievements`. `initializeProgression` already `profile.ensureExists()` when reading the fingerprint, so calling it after wipe both recreates the profile and reseeds.

## Goals / Non-Goals

**Goals:** claimable UIs see post-session progress in-process; wipe leaves a first-run catalog without restart.

**Non-Goals:** changing 5000-sample cap; syncing on every `completeSession` (read-path sync is enough and cheaper to test).

## Decisions

1. **Read-path sync, not write-path.** Home and Rewards call `await initializeProgression(db)` (or the two sync helpers if the fingerprint is known current) inside their loaders before `collectClaimableRewards`. Profile already does this — extract a shared `refreshProgression(db, now)` to avoid drift.
2. **Wipe call site, not engine.** Keep `wipeLocalData` a pure clear (wipe-audit tests stay valid). `onWipe` after success calls `initializeProgression(getDb())` then `refresh()`.
3. **Replace-import:** if replace can also drop definitions, the apply path should finish with `initializeProgression` when the backup omitted definitions. Smallest: always `initializeProgression` after replace/wipe on the Data Management screen.
4. **Do not double-grant.** Sync is monotonic-MAX + INSERT OR IGNORE unlocks; claims remain transactional. Tests: two Home loads after one session do not duplicate unlocks.

## Risks / Trade-offs

- Home focus already reloads via `refreshKey`; adding sync repeats the 5000-sample scan. Acceptable: Profile already paid this cost; 027 bounded it.
- Wipe tests that mount Data Management must expect definitions after wipe if they go through `onWipe` (engine tests unchanged).

## Testing strategy

- Home/Rewards loader with a real db: complete a session that finishes a daily quest, **do not** call Profile, load Home/Rewards, assert claimable.
- Data-management: `onWipe` then `getDb().quests` list definitions non-empty and sessions 0.
- Existing wipe-audit engine tests remain on `wipeLocalData` directly.
