# Proposal — Progression refresh on user surfaces

## Why

Quest/achievement evaluation (`syncQuestProgress` / `syncAchievements`) and definition seeding (`initializeProgression`) run at cold start and on Profile focus. Home's claimable-reward count and the Rewards inbox read persisted progress **without** syncing first, so a just-completed daily quest stays invisible until the player opens Profile. Wipe deletes `profile`, `quests`, and `achievements` and does not re-seed; the same process then presents an unusable empty catalog until restart. Both are missing rehydrate steps on the surfaces that need them.

## What Changes

- Home and Rewards MUST sync quest/achievement progress (or call `initializeProgression`) before collecting claimable rewards so post-session unlocks appear without a Profile detour.
- After a successful wipe (and after replace-import if definitions were cleared), the production UI MUST restore the singleton profile and seed current quest/achievement definitions in-process so the app is a usable empty product without requiring process death.
- Engine `wipeLocalData` MAY stay a pure clear; the **call site** is responsible for rehydrate. Tests MUST cover Data Management → Profile/Home in the same db instance.

## Capabilities

### New Capabilities

- `progression-surface-refresh`: claimable-reward and post-wipe surfaces observe current progression without requiring Profile focus or process restart.

### Modified Capabilities

- (none in main `openspec/specs/`)

## Impact

- `apps/mobile/src/progression/seeding.ts`, `sync.ts`
- `apps/mobile/src/app/(tabs)/index.tsx` `loadHome` / `loadClaimableRewardCount`
- `apps/mobile/src/app/rewards.tsx` `loadRewards`
- `apps/mobile/src/app/data-management.tsx` `onWipe`
- Optionally `completeSession` post-commit hook (not required if read paths sync)
- Tests: Home/Rewards after a completing session; wipe then Profile/Home without remounting the process

## Out of scope

- Raising `SYNC_SESSION_SCAN_LIMIT`
- Cloud sync
- Password-encrypted backups

## Evidence

- `initializeProgression` comment: Profile re-syncs on focus; grep shows no other production callers besides `_layout.tsx` bootstrap.
- `collectClaimableRewards` reads `quest_progress` / unlocks as stored; Home/Rewards call it without `syncQuestProgress`.
- `onWipe` → `wipeLocalData` → message; no `profile.ensureExists` / `initializeProgression`.
- Wipe-audit tests expect empty definitions (engine-correct); the production call site never restores them.

## Dependencies

None. Complementary to `residual-user-surface-honesty` (errors) but different root cause.

## Intended outcome

Finishing a quest-eligible session makes Rewards/Home counts update on next focus of those screens. Wiping data leaves a playable first-run profile and definition catalog in the same app process.
