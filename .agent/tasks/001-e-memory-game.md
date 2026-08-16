# Task Packet 001-e — Representative Memory Game (WP-E)

Campaign: 001-autonomous-foundation
Status: PENDING (wave 2; depends on 001-c Game SDK + 001-a shell)
Owner role: coder agent

## Objective

Build one production-quality Memory game as a self-contained module under `apps/mobile/src/games/memory` plugging into the Game SDK:

- `game.json` metadata (id `memory`, name, category Memory, versions) consumed by the orchestrator's registry generator.
- deterministic generation: seeded tile/sequence generation via SDK RNG; same `(gameVersion, generatorVersion, seed, difficulty)` reproduces the same board.
- named/adaptive difficulty: Easy→Expert parameter mapping (grid size, reveal time, round count).
- classic sequence-recall variant: tiles flash a sequence; player repeats it; rounds escalate; deterministic validation.
- pause: SDK lifecycle + opaque blur overlay obscuring the board; timers frozen.
- result normalization: raw accuracy/score → SDK `NormalizedPerformance`; XP hook call.
- persistence: completed session recorded through the db layer's `completeSession` (via SDK result object).
- tutorial: first-play interactive tutorial with QA skip.
- semantic IDs everywhere interactive (`memory-*`).
- QA force-state hooks: force-win/force-lose/force-timeout paths gated dev-only.

## Dependencies

- 001-c Game SDK contracts (read `apps/mobile/src/sdk/**` once landed).
- 001-b persistence `completeSession` API.
- Orchestrator registry generator + `app/game/[id].tsx` route (convergence, provided in wave 2).
- 001-a design tokens for styling.

## Allowed write surfaces

- `apps/mobile/src/games/memory/**` (all game code, components, logic, tests)
- `apps/mobile/src/games/memory/__tests__/**`

## Forbidden / shared write surfaces

- `package.json`, lockfiles, jest/tsconfig config (report needs to orchestrator).
- `apps/mobile/src/sdk/**`, `apps/mobile/src/db/**`, `apps/mobile/app/**`, `apps/mobile/src/theme/**` (read-only).
- Registry/generated files, root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`.

## Completion criteria

- Game logic unit tests pass: determinism (same seed → same board), difficulty param mapping, round validation, normalization math, force-state paths.
- Typecheck passes; game renders in `app/game/[id].tsx` when registered.
- Tutorial completes and skips via QA hook.

## Cheap validation

- `npm test` (jest) for the memory suite
- `npx tsc --noEmit`

## Integration notes for orchestrator

- Orchestrator runs the registry generator to register the game and validates the end-to-end route.

## Result/evidence

(agent fills in)
