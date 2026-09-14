# Proposal — Residual user-surface honesty

## Why

Campaign 028 closed silent failures on Home template start, rewards buy/equip, and profile claims. Sibling handlers on the same shells still fail closed into empty/zero UI or unhandled promises: Home paid reroll has no try/catch; Progress tab and Profile ignore `useDbData` `error` and look like a new player; sensory toggles persist with `console.error` only (theme persist was toasted). Load and reroll failures are the same user-honesty class 028 intended to finish.

## What Changes

- Home reroll rejection MUST surface a danger toast (or equivalent) and remain retryable; coins unchanged on failure.
- Progress tab and Profile MUST distinguish load failure from empty/new-player state (retry control), matching Home/Rewards/progress-detail.
- Sensory (sfx/haptics) persist failure MUST tell the user the in-session toggle may revert on restart (same pattern as theme persist).
- Daily workout load failure MUST NOT present "No plan yet… once games are registered" when the catalog is present.

## Capabilities

### New Capabilities

- `user-surface-honesty`: remaining shell load/reroll/settings persist failures are visible and retryable.

### Modified Capabilities

- (none in main `openspec/specs/`; extends 028 `user-action-reliability` to siblings 028 W1.4 missed)

## Impact

- `apps/mobile/src/app/(tabs)/index.tsx` (`onReroll`, workout empty copy)
- `apps/mobile/src/workout/use-workout.ts` (`reroll` try/catch or caller)
- `apps/mobile/src/app/(tabs)/progress.tsx`, `profile.tsx`
- `apps/mobile/src/app/_layout.tsx` `persistSettings`
- Route tests alongside 028 `home-workout-start.test.tsx` / `profile-purchases.test.tsx`

## Out of scope

- New toast infrastructure
- ErrorBoundary around every tab (separate missing-safeguard; MAY add a root boundary if cheap, not required)
- Workout sequential Next Game (`in-game-workout-next-leg`)

## Evidence

- `onReroll = workoutFlow.reroll` with no catch; `useWorkout.reroll` awaits `paidReroll` / `applyReroll` uncaught.
- `progress.tsx` destructures `{ data, loaded }` only; `isNewPlayer = data.sessions.length === 0`.
- `profile.tsx` destructures `{ data }` only.
- `_layout.tsx` `persistSettings` `.catch(console.error)`.
- 028 spec U1 listed Home CTA / rewards / claims only; W1.4 sweep missed reroll and sensory persist.

## Dependencies

None.

## Intended outcome

A failed reroll, a failed Progress/Profile load, and a failed sensory persist are visible and safe to retry; empty states are reserved for genuinely empty data.
