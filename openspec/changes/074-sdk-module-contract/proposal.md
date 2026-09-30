# Change 074 — Game SDK Module Contract and Session Safety

## Why

The Game SDK is the contract every one of the 42 games plugs into, and it is
enforced in three places that do not agree with each other.

The loader boundary is untyped in the direction that matters. The generated
registry exposes each game's screen as a bare component type, and the game route
casts it to the shape the SDK expects in order to inject the tutorial store. That
cast is unchecked: if a game module omits or misspells a required export, nothing
fails at build time, and the failure surfaces at runtime as a missing prop deep
inside a game. The SDK documents a module contract; nothing checks that a module
satisfies it.

The catalog-wide session-lifecycle contract test is now vacuous. It asserts that
games do not create their own lifecycle primitives, but it is satisfied by the
shared host sources being present in the scanned set — so it would keep passing
even if an individual game module started implementing its own timers and
subscriptions. A gate that cannot fail is worse than no gate, because it is
reported as assurance.

Session start has no duplicate-start guard. `begin()` can be called again for the
same session, which orphans the previous non-terminal session without closing or
recording it — the abandoned session's timers, listeners, and persisted state are
left in whatever condition they were in.

And the version conversion helper contradicts both its own documentation and the
SDK's type: it is documented as packing a "major component", actually packs
major/minor/patch, and rejects the `null` that the SDK's version type and the
SDK documentation explicitly permit for non-procedural games. A game that
correctly passes `null` gets an exception.

## What Changes

- Make the game module contract checkable: a game module's exported surface is
  validated at registration time, so a missing or misspelled required export
  fails fast and is reported as a catalog integrity problem, not a runtime
  crash inside a game.
- Remove the unchecked cast at the loader boundary; make the injected surface
  part of the typed contract.
- Make the session-lifecycle contract test actually per-game, so it can fail when
  a game introduces its own lifecycle primitives.
- Add a duplicate-start guard to session start that refuses to begin a second
  session over a non-terminal one, and closes or records the abandoned session.
- Correct the version conversion so it matches the SDK's documented contract,
  including the permitted `null`, and fix its documentation to describe what it
  actually packs.
- Update the SDK documentation map to include every exported module and the
  current catalog size.

## Capabilities

### New Capabilities

- `game-module-contract`: the observable guarantees that a game module satisfies
  the interface the host relies on, that a session cannot be started twice over
  live state, and that per-game lifecycle behavior is actually verified.

### Modified Capabilities

None. No existing capability spec exists under `openspec/specs/`.

## Impact

- `apps/mobile/src/registry/registry.generated.ts` and
  `scripts/generate-game-registry.mjs` — typed module surface.
- `apps/mobile/src/app/game/[id].tsx` — remove the unchecked cast.
- `apps/mobile/src/sdk/index.ts`, `sdk/types/*`, `sdk/game-definition.ts` —
  module contract and version contract.
- `apps/mobile/src/components/game-host/use-game-session.ts` — duplicate-start
  guard.
- `apps/mobile/src/**/__tests__/catalog-contracts.test.ts` — per-game lifecycle
  enforcement.
- `docs/GAME_SDK.md` — module map, catalog size, version contract.
- 42 game modules, only if registration-time validation reveals a real
  non-conforming module.
- No change to gameplay, scoring, or persistence semantics.
