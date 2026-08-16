# Task Packet 004-a — Attention: Odd One Out (WP-4A)

Campaign: 004-parallel-catalog-expansion
Status: ACTIVE
Owner role: coder agent

## Objective

Build one production-quality Attention game as a self-contained module under `apps/mobile/src/games/attention-odd-one-out`, plugging into the Game SDK. **Mechanic: Odd One Out** — a grid of similar items where exactly ONE differs from the others (shape/orientation/color); the player taps the odd item. Distinct from the Phase-2 Attention game (Visual Search: find the specified target among distractors — here there is NO specified target; the deviation is defined only by majority).

Proposed design (refine within spec if needed): rounds escalate (larger grid, subtler difference, shorter window); 1–3 minute score-attack session; penalty for wrong taps.

## Dependencies

- Game SDK contracts — `apps/mobile/src/sdk/**` (barrel `src/sdk/index.ts`).
- Reference module — `apps/mobile/src/games/memory/**` is the pattern to mirror (structure, conventions, session persistence, tutorial, QA hooks).
- Persistence — `getDb().sessions.completeSession` via `@/db`.
- Design tokens — `apps/mobile/src/theme/tokens.ts` (read-only).
- Category string — `primaryCategory: 'Attention'` (exact).

## Required deliverables

Mirror the memory module's layout under `apps/mobile/src/games/attention-odd-one-out/`:

- `game.json` — id `attention-odd-one-out` (must equal directory name), name "Odd One Out", primaryCategory `Attention`, sdkVersion = SDK_VERSION from `src/sdk/version.ts`, gameVersion "1.0.0", generatorVersion "1.0.0", hasTutorial true. Must pass `scripts/generate-game-registry.mjs` (id must equal directory name).
- `game-definition.ts` — frozen definition via SDK `defineGame`.
- `types.ts` — state, phases, actions, raw result, stats, QA patch types + `GAME_ID`.
- `difficulty.ts` — named Easy→Expert + Adaptive mapping (grid size, difference subtlety, display window, rounds) using SDK difficulty contract.
- `generator.ts` — deterministic seeded generation: same `(gameVersion, generatorVersion, seed, difficulty)` reproduces the same boards. **Validation**: exactly one odd item per board; odd item is genuinely different by the board's deviation dimension; reject/regenerate near-duplicate boards (bounded attempts, documented).
- `scoring.ts` — `PerformanceNormalizer` (clamps to [0,1], documented formula combining accuracy + speed), score function, accuracy helpers.
- `session.ts` — raw result with full reproducibility envelope (seed, versions, difficulty, generatorInfo, `createDiagnosticMetadata`), `buildSessionRecord`, persist via `completeSession` atomically; failures logged, never crash.
- `hooks.ts` — `createTutorialLifecycle` (first-play interactive tutorial, QA skip) + dev-only QA force-state hooks (`isDevBuild`/`assertDevOnly`, fall back to `createNoopQaForceStateHooks`).
- `versions.ts` — `SCORING_VERSION`, `versionToNumber`.
- `screen.tsx` + `components/` — full playable screen: SDK `SessionLifecycle`, monotonic timing (`systemClock`/`Stopwatch`), pause overlay, tutorial, difficulty selector (mirror memory), QA panel in dev, results flow.
- `index.ts` — **default export = the game screen**, plus named exports of `gameDefinition` and public logic.
- `__tests__/` — determinism, generator invariants (exactly one odd item), difficulty mapping, scoring math, reducer transitions, session persistence (stubbed persister), screen smoke (jest-expo).

## Conventions

- Semantic testIDs `attention-odd-one-out-*` on every interactive element.
- Gameplay timing via SDK monotonic clock only; never `Date.now()` for timing.
- No new dependencies; import only `@/sdk`, `@/db`, `@/theme`, `@/constants`, react/react-native, and your module.
- TypeScript strict; deterministic tests with fixed seeds; useful comments; no secrets; never import other games.

## Allowed write surfaces

- `apps/mobile/src/games/attention-odd-one-out/**`

## Forbidden / shared write surfaces

- `package.json`, lockfiles, jest/tsconfig config.
- `src/sdk/**`, `src/db/**`, `src/app/**`, `src/registry/**`, `src/components/**`, `src/theme/**`, `src/constants/**`, `src/games/**` (everything outside your directory) — read-only.
- Root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`.

## Completion criteria

- Own tests pass (`npx jest src/games/attention-odd-one-out` from `apps/mobile`).
- `npx tsc --noEmit` — fix only errors in your surface.
- `game.json` valid per the registry generator contract.

## Cheap validation

- `npx jest src/games/attention-odd-one-out` and `npx tsc --noEmit` (from `apps/mobile`).

## Integration notes for orchestrator

- Orchestrator regenerates `registry.generated.ts` and runs full validation after games land. Route `app/game/[id].tsx` lazy-loads your module's default export with no props.

## Result/evidence

(agent fills in: files created, test counts/results, deviations, anything the orchestrator must converge)
