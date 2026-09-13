## Context

028 W1 toasted Home `onStartTemplate`, rewards buy/equip, profile claims, and theme persist. Remaining siblings:

- Home `onReroll = workoutFlow.reroll` — `useWorkout.reroll` awaits `paidReroll`/`applyReroll` with no catch.
- Progress tab ignores `error`; empty snapshot ⇒ new-player copy.
- Profile ignores `error` and `loaded`.
- `_layout.tsx` `persistSettings` console-only.
- Workout load catch logs; Home shows `home-workout-empty` catalog copy.

Home already has `home-data-error` + toast helpers.

## Goals / Non-Goals

**Goals:** same honesty pattern as 028 for these siblings.

**Non-Goals:** root ErrorBoundary (optional); Next Game (`in-game-workout-next-leg`); quest sync (`progression-refresh-on-surfaces`).

## Decisions

1. **Reroll:** wrap `onReroll` in try/catch (prefer UI layer so the hook can still throw for tests). Insufficient funds should already be disabled via `rerollAffordable`; still toast unexpected rejects. Keep CTA enabled in `finally`.
2. **Progress/Profile:** destructure `error` from `useDbData`; render `StateCard`/danger `Card` + retry (`refreshKey`) like progress-detail. Empty states only when `error == null && loaded`.
3. **Sensory persist:** copy theme persist toast wording in `persistSettings` catch.
4. **Workout empty copy:** if `error`/load fail and catalog non-empty, use a failure empty state, not "once games are registered". Gate the empty hero on `workoutFlow.status !== 'loading'` to avoid flash if cheap.

## Testing strategy

- Home: inject `reroll` rejection → danger toast, balance unchanged (`home-workout-start.test.tsx` sibling).
- Progress: inject snapshot reject → error card, not Browse-empty-only.
- Profile: inject `loadProfile` reject → error, not zeroed identity as success.
- Settings: reject `profile.update` on sfx toggle → toast (layout or settings test).
