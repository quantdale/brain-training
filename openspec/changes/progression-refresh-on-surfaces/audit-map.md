# Audit map — progression-refresh-on-surfaces

| Item | Evidence |
|---|---|
| Sync callers | `progression/seeding.ts`; `_layout.tsx` bootstrap; Profile `loadProfile` |
| Home/Rewards skip sync | `app/(tabs)/index.tsx` `loadClaimableRewardCount`; `app/rewards.tsx` `loadRewards` |
| Wipe no reseed | `app/data-management.tsx` `onWipe` → `wipeLocalData` only |
| Engine wipe clears definitions | `data-portability/wipe.ts` + `FK_DELETE_ORDER` |
