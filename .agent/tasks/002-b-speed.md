# Task Packet 002-b — Speed Game (WP-2B)

Campaign: 002-eight-representative-games
Status: ACTIVE
Owner role: coder agent

## Objective

Build one production-quality Speed game as a self-contained module under `apps/mobile/src/games/speed-reaction-time`, plugging into the Game SDK. The mechanic must be **precision reaction timing** (constitution §31 Phase-2 variety: this game exercises "precision reaction timing").

Proposed design (refine within this spec if needed): **Reaction Time** — a fixed number of rounds (difficulty-scaled, e.g. 8–15); each round the player watches a waiting screen, then a GO signal appears after a seeded random delay (e.g. 800–3500 ms); the player taps the trigger as fast as possible. Tapping before the signal = false start (round marked failed; too many false starts ends the session). Metric: per-round reaction time in ms via the SDK monotonic clock.

## Dependencies

- Game SDK contracts — read `apps/mobile/src/sdk/**` (barrel `src/sdk/index.ts`).
- Reference module — `apps/mobile/src/games/memory/**` is the pattern to mirror.
- Persistence — `getDb().sessions.completeSession` via `@/db`.
- Design tokens — `apps/mobile/src/theme/tokens.ts` (read-only).

## Required deliverables

Mirror the memory module's file layout under `apps/mobile/src/games/speed-reaction-time/`:

- `game.json` — id `speed-reaction-time`, name "Reaction Time", primaryCategory `Speed`, sdkVersion = SDK_VERSION, gameVersion "1.0.0", generatorVersion "1.0.0", hasTutorial true.
- `game-definition.ts`, `types.ts` (state/phases/actions/raw result/stats/QA patch + `GAME_ID`), `difficulty.ts` (Easy→Expert + Adaptive: round count, delay range, false-start budget; SDK difficulty contract), `versions.ts` (`SCORING_VERSION`), `scoring.ts`, `session.ts`, `hooks.ts`, `screen.tsx` + `components/`, `index.ts` (default export = screen), `__tests__/` — all per the memory pattern and packet 002-a conventions.
- `generator.ts` — deterministic seeded round delays (SDK RNG); same seed → same delay sequence.
- **Timing correctness is the core requirement**: reaction measurement MUST use the SDK monotonic clock (`systemClock`/`Stopwatch`); no `Date.now()` for gameplay timing; document how timing behaves across 60/120 Hz displays (constitution §20).
- Normalization: raw reaction stats (median/mean/best reaction, false starts, completion) → `NormalizedPerformance` in [0,1] against difficulty-scaled target thresholds; documented formula; fixed-seed tests.
- QA force-state hooks: force-win (e.g. all perfect reactions)/force-lose (false-start storm)/force-timeout, dev-only.

## Conventions

- Semantic testIDs `speed-reaction-time-*`.
- No new dependencies; imports only `@/sdk`, `@/db`, `@/theme`, `@/constants`, react/react-native primitives, own module.
- TypeScript strict; deterministic tests; no secrets; never import other games.

## Allowed write surfaces

- `apps/mobile/src/games/speed-reaction-time/**`

## Forbidden / shared write surfaces

- `package.json`, lockfiles, jest/tsconfig config.
- `apps/mobile/src/sdk/**`, `apps/mobile/src/db/**`, `apps/mobile/src/app/**`, `apps/mobile/src/registry/**`, `apps/mobile/src/components/**`, `apps/mobile/src/theme/**`, `apps/mobile/src/constants/**` (read-only).
- Root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`, `AGENTS.md`.

## Completion criteria

- Logic + reducer + scoring + session tests pass (targeted jest for your dir).
- Own files typecheck clean; other agents' in-flight errors elsewhere are reported, not fixed.
- `game.json` valid per registry generator contract.

## Cheap validation

- `npx jest apps/mobile/src/games/speed-reaction-time` (from `apps/mobile`)
- `npx tsc --noEmit` (from `apps/mobile`) — fix only your surface.

## Integration notes for orchestrator

- Orchestrator regenerates the registry and validates end-to-end after convergence.
- Route renders your module's default export with no props.

## Result/evidence

(agent fills in)
