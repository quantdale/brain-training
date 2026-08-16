# Task Packet 004-b — Speed: Tap Rush (WP-4B)

Campaign: 004-parallel-catalog-expansion
Status: ACTIVE
Owner role: coder agent

## Objective

Build one production-quality Speed game as a self-contained module under `apps/mobile/src/games/speed-tap-rush`, plugging into the Game SDK. **Mechanic: Tap Rush** — targets appear one at a time at random positions with a shrinking visible window; tap each target before it expires to chain the streak. Distinct from the Phase-2 Speed game (Reaction Time: a single signal → one tap): this is a rapid serial response task with pace escalation.

Proposed design (refine within spec): round = fixed count of targets (e.g. 10); per-round window shrinks with difficulty; missed/wrong taps break the streak; 1–3 minute score-attack session.

## Dependencies

- Game SDK contracts — `apps/mobile/src/sdk/**` (barrel `src/sdk/index.ts`).
- Reference module — `apps/mobile/src/games/memory/**` is the pattern to mirror.
- Persistence — `getDb().sessions.completeSession` via `@/db`.
- Design tokens — `apps/mobile/src/theme/tokens.ts` (read-only).
- Category string — `primaryCategory: 'Speed'` (exact).

## Required deliverables

Mirror the memory module's layout under `apps/mobile/src/games/speed-tap-rush/`:

- `game.json` — id `speed-tap-rush` (must equal directory name), name "Tap Rush", primaryCategory `Speed`, sdkVersion = SDK_VERSION, gameVersion "1.0.0", generatorVersion "1.0.0", hasTutorial true. Must pass the registry generator contract.
- `game-definition.ts`, `types.ts` (state/phases/actions/raw result/stats/QA patch types + `GAME_ID`), `difficulty.ts` (Easy→Expert + Adaptive: target window ms, count per round, spawn jitter), `generator.ts` (deterministic seeded target positions/timings; validation: positions inside bounds and non-overlapping enough to tap distinctly), `scoring.ts` (PerformanceNormalizer combining accuracy + speed, documented), `session.ts` (reproducibility envelope + atomic persistence), `hooks.ts` (tutorial + QA force hooks), `versions.ts`, `screen.tsx` + `components/`, `index.ts` (default export = screen), `__tests__/` (determinism, generator invariants, difficulty, scoring, reducer, session persistence, screen smoke).

## Conventions

- Semantic testIDs `speed-tap-rush-*`; monotonic clock only for gameplay timing; no new dependencies; TypeScript strict; deterministic tests; never import other games.

## Allowed write surfaces

- `apps/mobile/src/games/speed-tap-rush/**`

## Forbidden / shared write surfaces

- `package.json`, lockfiles, jest/tsconfig config.
- `src/sdk/**`, `src/db/**`, `src/app/**`, `src/registry/**`, `src/components/**`, `src/theme/**`, `src/constants/**`, other `src/games/**` — read-only.
- Root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`.

## Completion criteria

- Own tests pass (`npx jest src/games/speed-tap-rush` from `apps/mobile`).
- `npx tsc --noEmit` — fix only errors in your surface.
- `game.json` valid per the registry generator contract.

## Cheap validation

- `npx jest src/games/speed-tap-rush` and `npx tsc --noEmit` (from `apps/mobile`).

## Integration notes for orchestrator

- Orchestrator regenerates `registry.generated.ts` and runs full validation after games land.

## Result/evidence

(agent fills in: files created, test counts/results, deviations, anything the orchestrator must converge)
