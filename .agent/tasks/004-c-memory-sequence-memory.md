# Task Packet 004-c — Memory: Sequence Memory (WP-4C)

Campaign: 004-parallel-catalog-expansion
Status: ACTIVE
Owner role: coder agent

## Objective

Build one production-quality Memory game as a self-contained module under `apps/mobile/src/games/memory-sequence-memory`, plugging into the Game SDK. **Mechanic: Sequence Memory (Simon-style)** — tiles light up in a sequence; the player repeats it by tapping the tiles in order; the sequence grows each round. Distinct from the Phase-2 Memory game (grid reveal: remember card positions): this is ORDER recall.

Proposed design (refine within spec): 4/9 tiles; sequence length grows with difficulty; wrong tap ends the round; 1–3 minute score-attack session.

## Dependencies

- Game SDK contracts — `apps/mobile/src/sdk/**` (barrel `src/sdk/index.ts`).
- Reference module — `apps/mobile/src/games/memory/**` is the pattern to mirror.
- Persistence — `getDb().sessions.completeSession` via `@/db`.
- Design tokens — `apps/mobile/src/theme/tokens.ts` (read-only).
- Category string — `primaryCategory: 'Memory'` (exact).

## Required deliverables

Mirror the memory module's layout under `apps/mobile/src/games/memory-sequence-memory/`:

- `game.json` — id `memory-sequence-memory` (must equal directory name), name "Sequence Memory", primaryCategory `Memory`, sdkVersion = SDK_VERSION, gameVersion "1.0.0", generatorVersion "1.0.0", hasTutorial true. Must pass the registry generator contract.
- `game-definition.ts`, `types.ts`, `difficulty.ts` (Easy→Expert + Adaptive: tile count, initial sequence length, display speed), `generator.ts` (deterministic seeded sequences; validation: valid tile ids, adjacent duplicate suppression so repeats are intentional), `scoring.ts` (normalizer combining rounds reached + accuracy, documented), `session.ts` (reproducibility envelope + atomic persistence), `hooks.ts` (tutorial + QA force hooks incl. force-perfect), `versions.ts`, `screen.tsx` + `components/` (sequence playback animation, input locked during playback, pause overlay), `index.ts`, `__tests__/` (determinism, generator invariants, difficulty, scoring, reducer incl. playback/input gating, session persistence, screen smoke).

## Conventions

- Semantic testIDs `memory-sequence-memory-*`; monotonic clock only; no new dependencies; TypeScript strict; deterministic tests; never import other games.

## Allowed write surfaces

- `apps/mobile/src/games/memory-sequence-memory/**`

## Forbidden / shared write surfaces

- `package.json`, lockfiles, jest/tsconfig config.
- `src/sdk/**`, `src/db/**`, `src/app/**`, `src/registry/**`, `src/components/**`, `src/theme/**`, `src/constants/**`, other `src/games/**` — read-only.
- Root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`.

## Completion criteria

- Own tests pass (`npx jest src/games/memory-sequence-memory` from `apps/mobile`).
- `npx tsc --noEmit` — fix only errors in your surface.
- `game.json` valid per the registry generator contract.

## Cheap validation

- `npx jest src/games/memory-sequence-memory` and `npx tsc --noEmit` (from `apps/mobile`).

## Integration notes for orchestrator

- Orchestrator regenerates `registry.generated.ts` and runs full validation after games land.

## Result/evidence

(agent fills in: files created, test counts/results, deviations, anything the orchestrator must converge)
