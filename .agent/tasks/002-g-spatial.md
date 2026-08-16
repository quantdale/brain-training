# Task Packet 002-g — Spatial Game (WP-2G)

Campaign: 002-eight-representative-games
Status: DONE
Owner role: coder agent

## Objective

Build one production-quality Spatial game as a self-contained module under `apps/mobile/src/games/spatial-mental-rotation`, plugging into the Game SDK. The mechanic must be **richer visual/spatial rendering** (constitution §31 Phase-2 variety: "richer spatial rendering"; Skia only if genuinely justified — see below).

Proposed design (refine within this spec if needed): **Mental Rotation** — each round shows a target shape (an asymmetric arrangement of colored blocks) and a candidate shape; the player answers SAME (candidate is the target rotated by some angle) vs DIFFERENT (candidate is mirrored or altered). Generation guarantees solvability: SAME candidates are produced by literally rotating the target; DIFFERENT candidates by mirroring or mutating it. Difficulty scales the rotation angle (larger angular difference is harder), shape complexity (block count), and time budget.

## Dependencies

- Game SDK contracts — read `apps/mobile/src/sdk/**` (barrel `src/sdk/index.ts`).
- Reference module — `apps/mobile/src/games/memory/**` is the pattern to mirror.
- Persistence — `getDb().sessions.completeSession` via `@/db`.
- Design tokens — `apps/mobile/src/theme/tokens.ts` (read-only).

## Required deliverables

Mirror the memory module's file layout under `apps/mobile/src/games/spatial-mental-rotation/`:

- `game.json` — id `spatial-mental-rotation`, name "Mental Rotation", primaryCategory `Spatial`, sdkVersion = SDK_VERSION, gameVersion "1.0.0", generatorVersion "1.0.0", hasTutorial true.
- `game-definition.ts`, `types.ts`, `difficulty.ts` (Easy→Expert + Adaptive: block count, angle set, time budget, round count; SDK difficulty contract), `versions.ts`, `scoring.ts`, `session.ts`, `hooks.ts`, `screen.tsx` + `components/`, `index.ts` (default export = screen), `__tests__/` — all per the memory pattern and packet 002-a conventions.
- `generator.ts` — deterministic seeded shape generation + **solver/validation**: shapes generated as block-coordinate sets; SAME candidates via exact rotation (coordinate rotation of integer block positions — validate the rotated set is well-formed and visually distinct from the original); DIFFERENT candidates via mirror/alter — validation asserts the candidate truly differs (not a rotation of the original); asymmetry invariant (a shape must not look identical under the allowed rotation set — otherwise the puzzle is ambiguous); tests over many seeds.
- Rendering: block shapes via plain RN Views with transforms (no new dependency). **Skia is allowed ONLY if you can justify a concrete need it solves** — if you cannot, use RN primitives; never add a dependency "for polish".
- Normalization: accuracy + speed → [0,1], documented, fixed-seed tests.
- QA force-state hooks (force-win/force-lose/force-timeout), dev-only.

## Conventions

- Semantic testIDs `spatial-mental-rotation-*`.
- No new dependencies unless genuinely justified (see above — if you add one, you must state the justification in your report and the orchestrator will review; adding one does not authorize editing `package.json` — you must NOT install anything, just request it).
- Imports only `@/sdk`, `@/db`, `@/theme`, `@/constants`, react/react-native primitives, own module.
- TypeScript strict; deterministic tests; no secrets; never import other games.

## Allowed write surfaces

- `apps/mobile/src/games/spatial-mental-rotation/**`

## Forbidden / shared write surfaces

- `package.json`, lockfiles, jest/tsconfig config (dependency requests go in your report).
- `apps/mobile/src/sdk/**`, `apps/mobile/src/db/**`, `apps/mobile/src/app/**`, `apps/mobile/src/registry/**`, `apps/mobile/src/components/**`, `apps/mobile/src/theme/**`, `apps/mobile/src/constants/**` (read-only).
- Root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`, `AGENTS.md`.

## Completion criteria

- Generator/solver invariant tests over many seeds + scoring/session tests pass (targeted jest for your dir).
- Own files typecheck clean; other agents' in-flight errors elsewhere are reported, not fixed.
- `game.json` valid per registry generator contract.

## Cheap validation

- `npx jest apps/mobile/src/games/spatial-mental-rotation` (from `apps/mobile`)
- `npx tsc --noEmit` (from `apps/mobile`) — fix only your surface.

## Integration notes for orchestrator

- Orchestrator regenerates the registry and validates end-to-end after convergence.
- Route renders your module's default export with no props.

## Result/evidence

(agent fills in: shape/rotation solver design, invariant test counts, any dependency justification)
