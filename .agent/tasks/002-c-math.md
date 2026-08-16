# Task Packet 002-c — Math Game (WP-2C)

Campaign: 002-eight-representative-games
Status: DONE
Owner role: coder agent

## Objective

Build one production-quality Math game as a self-contained module under `apps/mobile/src/games/math-fast-math`, plugging into the Game SDK. The mechanic must be **validated procedural arithmetic** (constitution §31 Phase-2 variety: "validated procedural math").

Proposed design (refine within this spec if needed): **Fast Math** — a score-attack session of arithmetic problems (+, −, ×, and ÷ with always-exact results); each problem is generated procedurally with the SDK RNG and validated at generation (integer operands, non-negative results, division always exact); the player answers with a number pad; immediate correct/incorrect feedback; score combines speed and accuracy; difficulty scales operand ranges and operator mix.

## Dependencies

- Game SDK contracts — read `apps/mobile/src/sdk/**` (barrel `src/sdk/index.ts`).
- Reference module — `apps/mobile/src/games/memory/**` is the pattern to mirror.
- Persistence — `getDb().sessions.completeSession` via `@/db`.
- Design tokens — `apps/mobile/src/theme/tokens.ts` (read-only).

## Required deliverables

Mirror the memory module's file layout under `apps/mobile/src/games/math-fast-math/`:

- `game.json` — id `math-fast-math`, name "Fast Math", primaryCategory `Math`, sdkVersion = SDK_VERSION, gameVersion "1.0.0", generatorVersion "1.0.0", hasTutorial true.
- `game-definition.ts`, `types.ts`, `difficulty.ts` (Easy→Expert + Adaptive: operand ranges per operator, round count, optional per-problem time budget; SDK difficulty contract), `versions.ts`, `scoring.ts`, `session.ts`, `hooks.ts`, `screen.tsx` + `components/` (problem display, number pad, feedback), `index.ts` (default export = screen), `__tests__/` — all per the memory pattern and packet 002-a conventions.
- `generator.ts` — deterministic seeded problems; **validation at generation**: exactness of division, non-negative integer answers, avoidance of trivial/near-duplicate problems (bounded regeneration attempts, documented); unit tests that exhaustively verify invariants over many seeds.
- Normalization: accuracy × speed factor → [0,1], documented, fixed-seed tests.
- QA force-state hooks (force-win/force-lose/force-timeout), dev-only.
- Number pad is a semantic testID target; problems and answers carry testIDs.

## Conventions

- Semantic testIDs `math-fast-math-*`.
- No new dependencies; imports only `@/sdk`, `@/db`, `@/theme`, `@/constants`, react/react-native primitives, own module.
- TypeScript strict; deterministic tests; no secrets; never import other games.

## Allowed write surfaces

- `apps/mobile/src/games/math-fast-math/**`

## Forbidden / shared write surfaces

- `package.json`, lockfiles, jest/tsconfig config.
- `apps/mobile/src/sdk/**`, `apps/mobile/src/db/**`, `apps/mobile/src/app/**`, `apps/mobile/src/registry/**`, `apps/mobile/src/components/**`, `apps/mobile/src/theme/**`, `apps/mobile/src/constants/**` (read-only).
- Root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`, `AGENTS.md`.

## Completion criteria

- Logic + generator + scoring + session tests pass (targeted jest for your dir), including generator invariant tests over many seeds.
- Own files typecheck clean; other agents' in-flight errors elsewhere are reported, not fixed.
- `game.json` valid per registry generator contract.

## Cheap validation

- `npx jest apps/mobile/src/games/math-fast-math` (from `apps/mobile`)
- `npx tsc --noEmit` (from `apps/mobile`) — fix only your surface.

## Integration notes for orchestrator

- Orchestrator regenerates the registry and validates end-to-end after convergence.
- Route renders your module's default export with no props.

## Result/evidence

(agent fills in)
