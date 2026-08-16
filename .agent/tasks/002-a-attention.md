# Task Packet 002-a — Attention Game (WP-2A)

Campaign: 002-eight-representative-games
Status: ACTIVE
Owner role: coder agent

## Objective

Build one production-quality Attention game as a self-contained module under `apps/mobile/src/games/attention-visual-search`, plugging into the Game SDK. The mechanic must be **rapid visual selection with distractor mechanics** (constitution §31 Phase-2 variety: this game exercises "rapid visual selection").

Proposed design (refine within this spec if needed): **Visual Search** — a grid of tiles; each round exactly ONE tile is the target (distinct symbol/color), all others are identical distractors; the target is shown for a difficulty-scaled display window; the player taps the target before it expires. Tapping a distractor costs a penalty (round failed + small time cost). Rounds escalate (shorter display, more tiles) within a 1–3 minute score-attack session.

## Dependencies

- Game SDK contracts — read `apps/mobile/src/sdk/**` (barrel `src/sdk/index.ts`).
- Reference module — `apps/mobile/src/games/memory/**` is the pattern to mirror (structure, conventions, session persistence, tutorial, QA hooks).
- Persistence — `getDb().sessions.completeSession` via `@/db` (see memory's `session.ts`).
- Design tokens — `apps/mobile/src/theme/tokens.ts` (read-only).

## Required deliverables

Mirror the memory module's file layout under `apps/mobile/src/games/attention-visual-search/`:

- `game.json` — id `attention-visual-search`, name "Visual Search", primaryCategory `Attention` (exact string), secondaryDomains optional, sdkVersion = SDK_VERSION from `src/sdk/version.ts`, gameVersion "1.0.0", generatorVersion "1.0.0", hasTutorial true. Must pass the registry generator contract (`scripts/generate-game-registry.mjs`; id must equal directory name).
- `game-definition.ts` — frozen definition via SDK `defineGame`.
- `types.ts` — game state, phases, actions, raw result, stats, QA patch types + `GAME_ID`.
- `difficulty.ts` — named Easy→Expert + Adaptive mapping (grid size, display window ms, rounds) using SDK difficulty contract (`resolveDifficulty`, `DEFAULT_CHALLENGE_RATINGS`) like memory's.
- `generator.ts` — deterministic seeded generation: same `(gameVersion, generatorVersion, seed, difficulty)` reproduces the same board/rounds. **Validation**: exactly one target per round, target position distinct from distractors; reject/regenerate near-duplicate round layouts (bounded attempts, documented).
- `scoring.ts` — `PerformanceNormalizer` (clamps to [0,1], documented formula combining accuracy + speed), score function, accuracy helpers.
- `session.ts` — build raw result with full reproducibility envelope (seed, versions, difficulty, generatorInfo, `createDiagnosticMetadata`), `buildSessionRecord`, persist via `completeSession` atomically; failures logged, never crash.
- `hooks.ts` — `createTutorialLifecycle` (first-play interactive tutorial, QA skip) + dev-only QA force-state hooks (force-win/force-lose/force-timeout via `isDevBuild`/`assertDevOnly`, fall back to `createNoopQaForceStateHooks`).
- `versions.ts` — `SCORING_VERSION`, `versionToNumber`.
- `screen.tsx` + `components/` — full playable screen: session lifecycle (SDK `SessionLifecycle`), monotonic timing (`systemClock`/`Stopwatch`), pause overlay (`createPauseOverlaySpec`; opaque, freezes timers, obscures board), tutorial, difficulty selector (mirror memory's), QA panel in dev, results flow.
- `index.ts` — **default export = the game screen** (generated loaders render `mod.default`), plus named exports of `gameDefinition` and the module's public logic surface for tests.
- `__tests__/` — determinism (same seed → same board), generator validation invariants, difficulty mapping, scoring/normalization math, reducer transitions, session persistence (with a stubbed persister like memory's), screen smoke (jest-expo).

## Conventions

- Semantic testIDs `attention-visual-search-*` on every interactive element (SDK `testId`).
- Timer logic must use the SDK monotonic clock, never `Date.now()` for gameplay timing.
- Do NOT add dependencies or edit any shared file. Import only `@/sdk`, `@/db`, `@/theme`, `@/constants`, react/react-native primitives, and your own module.
- TypeScript strict; deterministic tests with fixed seeds; preserve useful comments; no secrets.
- Never import other games.

## Allowed write surfaces

- `apps/mobile/src/games/attention-visual-search/**`

## Forbidden / shared write surfaces

- `package.json`, lockfiles, jest/tsconfig config (report needs to orchestrator).
- `apps/mobile/src/sdk/**`, `apps/mobile/src/db/**`, `apps/mobile/src/app/**`, `apps/mobile/src/registry/**`, `apps/mobile/src/components/**`, `apps/mobile/src/theme/**`, `apps/mobile/src/constants/**` (read-only).
- Root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`, `AGENTS.md`.

## Completion criteria

- Logic + reducer + scoring + session tests pass (targeted jest run for your game dir).
- Own files typecheck clean under `npx tsc --noEmit`. Other agents' in-flight errors in OTHER game dirs are not yours to fix — report them, don't touch.
- `game.json` valid per the registry generator contract.
- Game is playable end-to-end in principle (orchestrator verifies on emulator after convergence).

## Cheap validation

- `npx jest apps/mobile/src/games/attention-visual-search` (run from `apps/mobile`)
- `npx tsc --noEmit` (from `apps/mobile`) — fix only errors in your ownership surface.

## Integration notes for orchestrator

- Orchestrator regenerates `registry.generated.ts` and runs full validation after all games land.
- The route `app/game/[id].tsx` lazy-loads your module and renders the default export with no props — the screen must manage its own state.

## Result/evidence

(agent fills in: files created, test counts/results, deviations, anything the orchestrator must converge)
