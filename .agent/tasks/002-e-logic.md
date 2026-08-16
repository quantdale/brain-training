# Task Packet 002-e — Logic Game (WP-2E)

Campaign: 002-eight-representative-games
Status: ACTIVE
Owner role: coder agent

## Objective

Build one production-quality Logic & Problem Solving game as a self-contained module under `apps/mobile/src/games/logic-next-sequence`, plugging into the Game SDK. The mechanic must be a **procedural puzzle with solver/validation** (constitution §31 Phase-2 variety: "procedural logic validation").

Proposed design (refine within this spec if needed): **Next in Sequence** — each round shows a number-sequence with one term missing (the next term); the player picks the correct continuation from four options. Sequences are produced by pattern recipes (arithmetic, geometric, alternating, squares/cubes, Fibonacci-like, mixed two-step). A solver/validator at generation time proves the puzzle is solvable: exactly one option is the true continuation and every distractor is generated from a plausible near-miss pattern (not random noise).

## Dependencies

- Game SDK contracts — read `apps/mobile/src/sdk/**` (barrel `src/sdk/index.ts`).
- Reference module — `apps/mobile/src/games/memory/**` is the pattern to mirror.
- Persistence — `getDb().sessions.completeSession` via `@/db`.
- Design tokens — `apps/mobile/src/theme/tokens.ts` (read-only).

## Required deliverables

Mirror the memory module's file layout under `apps/mobile/src/games/logic-next-sequence/`:

- `game.json` — id `logic-next-sequence`, name "Next in Sequence", primaryCategory `Logic & Problem Solving` (exact string), sdkVersion = SDK_VERSION, gameVersion "1.0.0", generatorVersion "1.0.0", hasTutorial true.
- `game-definition.ts`, `types.ts`, `difficulty.ts` (Easy→Expert + Adaptive: pattern complexity/recipe pool, sequence length, round count; SDK difficulty contract), `versions.ts`, `scoring.ts`, `session.ts`, `hooks.ts`, `screen.tsx` + `components/`, `index.ts` (default export = screen), `__tests__/` — all per the memory pattern and packet 002-a conventions.
- `generator.ts` — deterministic seeded puzzle generation from pattern recipes; **solver/validation is a first-class deliverable**: a `solve(sequence)`-style function that computes the continuation and the generator must assert uniqueness of the answer among the four options for every emitted puzzle (bounded regeneration, documented); distractors derived from near-miss recipes; integer-only sequences (avoid floating-point ambiguity); tests that run the solver over many seeds and assert the invariants (exactly one correct option, valid integers, no negative-by-construction traps, difficulty-appropriate).
- Normalization: accuracy + speed → [0,1], documented, fixed-seed tests.
- QA force-state hooks (force-win/force-lose/force-timeout), dev-only.

## Conventions

- Semantic testIDs `logic-next-sequence-*`.
- No new dependencies; imports only `@/sdk`, `@/db`, `@/theme`, `@/constants`, react/react-native primitives, own module.
- TypeScript strict; deterministic tests; no secrets; never import other games.

## Allowed write surfaces

- `apps/mobile/src/games/logic-next-sequence/**`

## Forbidden / shared write surfaces

- `package.json`, lockfiles, jest/tsconfig config.
- `apps/mobile/src/sdk/**`, `apps/mobile/src/db/**`, `apps/mobile/src/app/**`, `apps/mobile/src/registry/**`, `apps/mobile/src/components/**`, `apps/mobile/src/theme/**`, `apps/mobile/src/constants/**` (read-only).
- Root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`, `AGENTS.md`.

## Completion criteria

- Solver + generator invariant tests pass over many seeds; logic/scoring/session tests pass (targeted jest for your dir).
- Own files typecheck clean; other agents' in-flight errors elsewhere are reported, not fixed.
- `game.json` valid per registry generator contract.

## Cheap validation

- `npx jest apps/mobile/src/games/logic-next-sequence` (from `apps/mobile`)
- `npx tsc --noEmit` (from `apps/mobile`) — fix only your surface.

## Integration notes for orchestrator

- Orchestrator regenerates the registry and validates end-to-end after convergence.
- Route renders your module's default export with no props.

## Result/evidence

(agent fills in: recipe pool, solver design, invariant test counts)
