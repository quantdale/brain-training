# Change 072 — Navigation State Integrity and Distinguishable Screen States

## Why

Three related defects make the app misreport state to the user.

First, **failed reads render as real data.** `useDbData` returns a zeroed
fallback together with `loaded: true` when its read fails, and its consumers do
not destructure an `error`. Data Management therefore shows an empty inventory
and the copy "no backups yet" when the backup read actually failed — the
opposite of the truth, presented confidently. Profile has the same shape: it has
no loading state, so its zeroed fallback paints as real records (zero streak,
zero sessions, zero coins) while data is still loading, and reads as real data
both during load and on failure.

Second, **navigation builds an unbounded stack.** Cross-destination navigation
to tabs and root-level destinations uses `push`, so the history stack grows with
every visit and hardware back re-enters screens the user already completed,
rather than leaving the flow. The safe-back helper is correct where it is used —
it replaces only when the stack cannot go back — but the guard that is supposed
to prevent regressions scans only `src/games/**`, so the six app-level pushed
routes are unguarded and the negative pattern remains trivially bypassable.

Third, **one screen has no way out and one announces the wrong destination.**
Data Management renders no back affordance while the root stack hides all
headers, so it is a dead end reachable by push. Separately, game detail
announces "Back to Games" on entry paths where back does not go to Games.

Finally, Progress's focus reload is throttled by a **time-only** 5-second
window, unlike the input-aware gate the rest of the app uses, so a mutation
performed inside the window (for example a workout leg advanced from the results
screen) leaves the Progress tab serving a pre-mutation snapshot.

## What Changes

- Make read failure and in-progress reads distinguishable from genuinely empty
  data, and render an explicit, honest state for each. A screen SHALL NOT
  present a zeroed fallback as if it were real data.
- Give every pushed route a consistent, correct exit, and make the safe-back
  regression guard cover all route sources so the pattern cannot be
  reintroduced.
- Use the navigation operation appropriate to the destination so the stack does
  not grow across tab and root destinations, with back behavior verified.
- Make the announced back destination match where back actually goes.
- Make the Progress focus gate input-aware, consistent with the other surfaces,
  so a mutation is never hidden behind a time window.

## Capabilities

### New Capabilities

- `screen-state-honesty`: the observable contract that every data-driven screen
  distinguishes loading, loaded, empty, and failed, and never presents a
  placeholder as real data.
- `navigation-stack-integrity`: the observable contract for cross-destination
  navigation, exits from pushed routes, and correct back destinations.

### Modified Capabilities

None. No existing capability spec exists under `openspec/specs/`.

## Impact

- `apps/mobile/src/hooks/use-db-data.ts` — error/loading contract.
- `apps/mobile/src/app/data-management.tsx`, `apps/mobile/src/app/(tabs)/profile.tsx`,
  `apps/mobile/src/app/(tabs)/progress.tsx` — state rendering.
- `apps/mobile/src/app/results.tsx`, `apps/mobile/src/app/rewards.tsx` — push vs
  replace for tab/root destinations.
- `apps/mobile/src/app/_layout.tsx` (root stack header policy),
  `apps/mobile/src/app/game-detail/[id].tsx` (announced destination).
- `apps/mobile/src/progression/focus-sync.ts` — input-aware gate reuse.
- `apps/mobile/src/**/__tests__/safe-back-catalog.test.ts` — guard coverage.
- No data model change; no persistence change.
