# Audit map — residual-user-surface-honesty

| Item | Evidence |
|---|---|
| Reroll uncaught | `index.tsx` `onReroll = workoutFlow.reroll`; `use-workout.ts` `reroll` |
| Progress masks error | `app/(tabs)/progress.tsx` `{ data, loaded }` only |
| Profile masks error | `app/(tabs)/profile.tsx` `{ data }` only |
| Sensory persist | `_layout.tsx` `persistSettings` `console.error` |
