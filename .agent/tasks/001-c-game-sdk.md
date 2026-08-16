# Task Packet 001-c — Game SDK Skeleton (WP-C)

Campaign: 001-autonomous-foundation
Status: DONE
Owner role: coder agent

## Objective

Establish the mandatory shared Game SDK skeleton under `apps/mobile/src/sdk` with versioned TypeScript contracts and working reference implementations for cross-cutting concerns:

- `GameDefinition` metadata contract: stable `id`, display name, primary category (one of Memory/Attention/Speed/Math/Language/Logic/Flexibility/Spatial), optional secondary domains, `sdkVersion`, `gameVersion`, `generatorVersion`, tutorial flag.
- named difficulty (`easy|normal|hard|expert|adaptive`) → internal difficulty parameters/challenge rating mapping contract.
- deterministic seeded RNG: `createRng(seed: string | number)` producing a reproducible sequence; unit-test determinism and distribution sanity. Explicit `seed` + `generatorVersion` reproducibility rule.
- monotonic timing service: injectable clock abstraction (real monotonic clock + fake/test clock), `now()`, `elapsed()`.
- session lifecycle state machine: created → active → paused ↔ active → completed | abandoned; pause freezes timers; illegal transitions rejected; `SessionLifecycle` service.
- pause obscuring contract: `PauseOverlay` behavior spec (opaque blur/overlay, challenge hidden).
- result contract: game raw result → `NormalizedPerformance` (0..1 or documented scale) conversion interface + XP/rating hook interface (implementations deferred to Phase 2, contracts + no-op default now).
- audio/haptics service interface with a working no-op/default implementation and global-mute flags.
- tutorial lifecycle contract: first-play state, completion, replay, QA skip.
- semantic testID helper: stable id builder (`testId(gameId, element)`).
- diagnostic metadata: structured session/game metadata types (versions, seed, difficulty, duration, generator info).
- QA force-state hooks contract: typed interface games implement to force win/lose/state; safe defaults, documented as dev-only.

Keep the design so future games plug in without hand-editing shared files: the registry generator (orchestrator) consumes `GameDefinition` from `game.json` files.

## Dependencies

- Orchestrator scaffold commit including jest-expo.

## Allowed write surfaces

- `apps/mobile/src/sdk/**`
- `apps/mobile/src/sdk/__tests__/**` (unit tests: RNG determinism, lifecycle transitions, difficulty mapping, testID builder)

## Forbidden / shared write surfaces

- `package.json`, `package-lock.json`, jest config (report needs to orchestrator).
- `apps/mobile/app/**`, `apps/mobile/src/db/**`, `apps/mobile/src/games/**`, `apps/mobile/src/theme/**`.
- Root `scripts/**`, `.github/**`, `.agent/**`, `docs/**` — EXCEPT you may write `docs/GAME_SDK.md` ONLY if you are superseding its bootstrap content with the concrete API reference (keep the bootstrap requirements; append the concrete contracts section).

## Completion criteria

- All contracts above exported with types; reference implementations for RNG, timing, lifecycle, difficulty mapping, testID builder, no-op audio/haptics.
- RNG determinism tests pass (same seed → same sequence; different seed → different sequence).
- Lifecycle tests pass (legal transitions, pause freezes elapsed time, illegal transitions throw).
- `npx tsc --noEmit` passes.

## Cheap validation

- `npm test` (jest) for the sdk suite
- `npx tsc --noEmit`

## Integration notes for orchestrator

- The memory game packet (001-e) depends on this surface; the orchestrator will run convergence (registry generator + wiring) after both land.

## Result/evidence

(agent fills in)
