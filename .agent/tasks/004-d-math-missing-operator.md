# Task Packet 004-d — Math: Missing Operator (WP-4D)

Campaign: 004-parallel-catalog-expansion
Status: ACTIVE
Owner role: coder agent

## Objective

Build one production-quality Math game as a self-contained module under `apps/mobile/src/games/math-missing-operator`, plugging into the Game SDK. **Mechanic: Missing Operator** — an equation with the operator missing (e.g. `8 _ 2 = 16`); the player picks the operator (`+ − × ÷`) that makes it true. Distinct from the Phase-2 Math game (Fast Math: rapid arithmetic with a presented result): here the arithmetic is verification/completion, and division results are constrained to exact integers.

Proposed design (refine within spec): rounds escalate (larger operands, harder operator sets); time per round shrinks; 1–3 minute score-attack session.

## Dependencies

- Game SDK contracts — `apps/mobile/src/sdk/**` (barrel `src/sdk/index.ts`).
- Reference module — `apps/mobile/src/games/memory/**` is the pattern to mirror.
- Persistence — `getDb().sessions.completeSession` via `@/db`.
- Design tokens — `apps/mobile/src/theme/tokens.ts` (read-only).
- Category string — `primaryCategory: 'Math'` (exact).

## Required deliverables

Mirror the memory module's layout under `apps/mobile/src/games/math-missing-operator/`:

- `game.json` — id `math-missing-operator` (must equal directory name), name "Missing Operator", primaryCategory `Math`, sdkVersion = SDK_VERSION, gameVersion "1.0.0", generatorVersion "1.0.0", hasTutorial true. Must pass the registry generator contract.
- `game-definition.ts`, `types.ts`, `difficulty.ts` (Easy→Expert + Adaptive: operand ranges, candidate operator set, time budget), `generator.ts` (deterministic seeded equations; **validation**: exactly one correct operator among candidates, division always exact, no trivial `×1`/`÷1` spam, bounded attempts), `scoring.ts` (normalizer: accuracy + speed, documented), `session.ts` (reproducibility envelope + atomic persistence), `hooks.ts` (tutorial + QA force hooks), `versions.ts`, `screen.tsx` + `components/` (equation display, 4 operator buttons), `index.ts`, `__tests__/` (determinism, generator invariants incl. unique-solution proof, difficulty, scoring, reducer, session persistence, screen smoke).

## Conventions

- Semantic testIDs `math-missing-operator-*`; monotonic clock only; no new dependencies; TypeScript strict; deterministic tests; never import other games.

## Allowed write surfaces

- `apps/mobile/src/games/math-missing-operator/**`

## Forbidden / shared write surfaces

- `package.json`, lockfiles, jest/tsconfig config.
- `src/sdk/**`, `src/db/**`, `src/app/**`, `src/registry/**`, `src/components/**`, `src/theme/**`, `src/constants/**`, other `src/games/**` — read-only.
- Root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`.

## Completion criteria

- Own tests pass (`npx jest src/games/math-missing-operator` from `apps/mobile`).
- `npx tsc --noEmit` — fix only errors in your surface.
- `game.json` valid per the registry generator contract.

## Cheap validation

- `npx jest src/games/math-missing-operator` and `npx tsc --noEmit` (from `apps/mobile`).

## Integration notes for orchestrator

- Orchestrator regenerates `registry.generated.ts` and runs full validation after games land.

## Result/evidence

(agent fills in: files created, test counts/results, deviations, anything the orchestrator must converge)
