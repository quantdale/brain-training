# Task Packet 002-f — Flexibility Game (WP-2F)

Campaign: 002-eight-representative-games
Status: DONE
Owner role: coder agent

## Objective

Build one production-quality Flexibility game as a self-contained module under `apps/mobile/src/games/flexibility-card-sort`, plugging into the Game SDK. The mechanic must be a **rule-switching state machine** (constitution §31 Phase-2 variety: "rule-switching state machine").

Proposed design (refine within this spec if needed): **Card Sort** — two classification rules (e.g. match by COLOR vs match by SHAPE) over a deck of colored-shape cards. Each round: a target card and four candidate cards; the ACTIVE RULE is shown; the player picks the candidate that matches the target under the active rule. The rule switches every K rounds; each switch passes through an explicit transition/notice phase. The game's core is an explicit, tested state machine (ROUND_ACTIVE → RULE_SWITCH_NOTICE → ROUND_ACTIVE, plus session phases), with speed+accuracy scoring and mistake penalties.

## Dependencies

- Game SDK contracts — read `apps/mobile/src/sdk/**` (barrel `src/sdk/index.ts`).
- Reference module — `apps/mobile/src/games/memory/**` is the pattern to mirror.
- Persistence — `getDb().sessions.completeSession` via `@/db`.
- Design tokens — `apps/mobile/src/theme/tokens.ts` (read-only).

## Required deliverables

Mirror the memory module's file layout under `apps/mobile/src/games/flexibility-card-sort/`:

- `game.json` — id `flexibility-card-sort`, name "Card Sort", primaryCategory `Flexibility`, sdkVersion = SDK_VERSION, gameVersion "1.0.0", generatorVersion "1.0.0", hasTutorial true.
- `game-definition.ts`, `types.ts`, `difficulty.ts` (Easy→Expert + Adaptive: switch frequency, notice duration, number of shapes/colors, round count; SDK difficulty contract), `versions.ts`, `scoring.ts`, `session.ts`, `hooks.ts`, `screen.tsx` + `components/` (rule banner, card grid, switch-notice overlay), `index.ts` (default export = screen), `__tests__/` — all per the memory pattern and packet 002-a conventions.
- `reducer.ts` — the rule-switching state machine as a pure reducer (mirror memory's reducer style): every transition (round start, pick, correct/wrong, switch notice, notice expiry, session end) explicitly tested; timers driven by the SDK monotonic clock, not frame counts.
- `generator.ts` — deterministic seeded candidate cards: exactly one candidate matches under the ACTIVE rule, and the same candidate must NOT also match under the other rule (validated — this is what makes the rule switch meaningful); distractor generation validated per round.
- Normalization: accuracy + speed + switch-rule accuracy (performance right after switches vs steady state) → [0,1], documented, fixed-seed tests.
- QA force-state hooks (force-win/force-lose/force-timeout), dev-only.

## Conventions

- Semantic testIDs `flexibility-card-sort-*`.
- No new dependencies; imports only `@/sdk`, `@/db`, `@/theme`, `@/constants`, react/react-native primitives, own module.
- TypeScript strict; deterministic tests; no secrets; never import other games.

## Allowed write surfaces

- `apps/mobile/src/games/flexibility-card-sort/**`

## Forbidden / shared write surfaces

- `package.json`, lockfiles, jest/tsconfig config.
- `apps/mobile/src/sdk/**`, `apps/mobile/src/db/**`, `apps/mobile/src/app/**`, `apps/mobile/src/registry/**`, `apps/mobile/src/components/**`, `apps/mobile/src/theme/**`, `apps/mobile/src/constants/**` (read-only).
- Root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`, `AGENTS.md`.

## Completion criteria

- State-machine transition tests + generator validation tests + scoring/session tests pass (targeted jest for your dir).
- Own files typecheck clean; other agents' in-flight errors elsewhere are reported, not fixed.
- `game.json` valid per registry generator contract.

## Cheap validation

- `npx jest apps/mobile/src/games/flexibility-card-sort` (from `apps/mobile`)
- `npx tsc --noEmit` (from `apps/mobile`) — fix only your surface.

## Integration notes for orchestrator

- Orchestrator regenerates the registry and validates end-to-end after convergence.
- Route renders your module's default export with no props.

## Result/evidence

(agent fills in: state machine design, switch/validation invariants)
