# Change 075 — Game State-Machine Exhaustiveness Enforcement

## Why

All 42 game reducers share the same shape: a `switch (action.type)` over a
discriminated action union, terminated by

```ts
default: {
  // Exhaustiveness guard: every action is handled above.
  return state;
}
```

That comment is false in all 42 files, and 27 of them carry it verbatim. The
`default` branch cannot fail: returning the current state is always a valid
result, so a new action variant that nobody handles compiles cleanly, passes
typecheck, passes lint, and silently does nothing at runtime.

That is exactly the failure this construct is supposed to prevent. A new action
type added to a game's union — during a new feature, or a copy of a sibling
game's pattern — produces a reducer that appears to handle it and does not. The
symptom appears far from the cause: input is dispatched, nothing happens, and the
game looks "stuck" in a state the code says cannot happen.

The cost is measurable in review too: the comment asserts a guarantee that no
mechanism provides, so a reviewer reading it skips the check it claims to encode.

The fix is the one the SDK's type system is already positioned to support: a
true exhaustiveness check that fails compilation when a union member is
unhandled, with an explicit runtime fallback only for genuinely unknown input
that is not part of the union.

## What Changes

- Replace the "exhaustiveness guard" `default` branches in all 42 game reducers
  with a real exhaustiveness assertion, so adding an action type that is not
  handled is a compile-time error naming the missing member.
- Retain a runtime fallback only for input that cannot occur from a
  well-typed caller, and make it explicit rather than a silent no-op.
- Add a catalog contract test that every game reducer declares its action union
  and satisfies the exhaustiveness requirement, so a newly added game is held to
  the same standard.
- Correct the misleading comments so the code no longer claims a guarantee it
  does not provide.

## Capabilities

### New Capabilities

- `game-state-machine-exhaustiveness`: the observable guarantee that a game
  state machine's declared action set is fully handled, and that introducing an
  unhandled action is a build-time failure rather than a silent runtime no-op.

### Modified Capabilities

None. No existing capability spec exists under `openspec/specs/`.

## Impact

- `apps/mobile/src/games/*/reducer.ts` — 42 files, one branch each.
- `apps/mobile/src/__tests__/catalog-contracts.test.ts` (or a sibling catalog
  contract suite) — the catalog-wide exhaustiveness test.
- `apps/mobile/src/sdk` — a shared exhaustiveness helper if one is not already
  present, so the pattern is expressed once.
- No gameplay, scoring, difficulty, persistence, or timing behavior changes: the
  handled branches are untouched.
