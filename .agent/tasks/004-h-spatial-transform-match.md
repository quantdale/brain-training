# Task Packet 004-h — Spatial: Transform Match (WP-4H)

Campaign: 004-parallel-catalog-expansion
Status: ACTIVE
Owner role: coder agent

## Objective

Build one production-quality Spatial game as a self-contained module under `apps/mobile/src/games/spatial-transform-match`, plugging into the Game SDK. **Mechanic: Transform Match** — a 2D pattern on a small grid is transformed (rotate/mirror); the player picks the correct transformed version among distractors. Distinct from the Phase-2 Spatial game (Mental Rotation: 3D-ish shape rotation judgment): this is 2D grid transformation prediction.

Proposed design (refine within spec): grid patterns (e.g. 3×3/4×4 with 3–6 filled cells); transformation = rotate 90/180/270 and/or mirror H/V (document the exact transform set); distractors are plausible wrong transforms; 1–3 minute score-attack session.

## Dependencies

- Game SDK contracts — `apps/mobile/src/sdk/**` (barrel `src/sdk/index.ts`).
- Reference module — `apps/mobile/src/games/memory/**` is the pattern to mirror.
- Persistence — `getDb().sessions.completeSession` via `@/db`.
- Design tokens — `apps/mobile/src/theme/tokens.ts` (read-only).
- Category string — `primaryCategory: 'Spatial'` (exact).

## Required deliverables

Mirror the memory module's layout under `apps/mobile/src/games/spatial-transform-match/`:

- `game.json` — id `spatial-transform-match` (must equal directory name), name "Transform Match", primaryCategory `Spatial`, sdkVersion = SDK_VERSION, gameVersion "1.0.0", generatorVersion "1.0.0", hasTutorial true. Must pass the registry generator contract.
- `game-definition.ts`, `types.ts`, `difficulty.ts` (Easy→Expert + Adaptive: grid size, filled cells, transform complexity, distractor count), `generator.ts` (deterministic seeded patterns + transforms; **validation**: the correct option equals the transformed source EXACTLY; distractors differ from the correct option (compare cell sets); source patterns are not symmetric under the chosen transform (else the answer is ambiguous — reject/regenerate, bounded attempts)), `scoring.ts` (normalizer: accuracy + speed, documented), `session.ts` (reproducibility envelope incl. source pattern + transform + option set + atomic persistence), `hooks.ts` (tutorial + QA force hooks), `versions.ts`, `screen.tsx` + `components/` (grid renderer shared across source/options, option buttons), `index.ts`, `__tests__/` (determinism, generator invariants incl. exact-match + non-ambiguity proofs, difficulty, scoring, reducer, session persistence, screen smoke).

## Conventions

- Semantic testIDs `spatial-transform-match-*`; monotonic clock only; no new dependencies; TypeScript strict; deterministic tests; never import other games.

## Allowed write surfaces

- `apps/mobile/src/games/spatial-transform-match/**`

## Forbidden / shared write surfaces

- `package.json`, lockfiles, jest/tsconfig config.
- `src/sdk/**`, `src/db/**`, `src/app/**`, `src/registry/**`, `src/components/**`, `src/theme/**`, `src/constants/**`, other `src/games/**` — read-only.
- Root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`.

## Completion criteria

- Own tests pass (`npx jest src/games/spatial-transform-match` from `apps/mobile`).
- `npx tsc --noEmit` — fix only errors in your surface.
- `game.json` valid per the registry generator contract.

## Cheap validation

- `npx jest src/games/spatial-transform-match` and `npx tsc --noEmit` (from `apps/mobile`).

## Integration notes for orchestrator

- Orchestrator regenerates `registry.generated.ts` and runs full validation after games land.

## Result/evidence

(agent fills in: files created, test counts/results, deviations, anything the orchestrator must converge)
