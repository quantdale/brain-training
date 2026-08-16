# Task Packet 004-f — Logic: Code Cracker (WP-4F)

Campaign: 004-parallel-catalog-expansion
Status: ACTIVE
Owner role: coder agent

## Objective

Build one production-quality Logic & Problem Solving game as a self-contained module under `apps/mobile/src/games/logic-code-cracker`, plugging into the Game SDK. **Mechanic: Code Cracker (Mastermind-style)** — a hidden 4-color code; the player makes guesses and receives feedback (correct color+position, correct color wrong position); deduce the code in as few guesses as possible. Distinct from the Phase-2 Logic game (Next in Sequence: extrapolate a series): this is constraint deduction.

Proposed design (refine within spec): 4 pegs × 6 colors (scalable with difficulty); feedback after each guess; limited guesses per round; score rewards few-guess solves; 1–3 minute session (may be 2–4 rounds).

## Dependencies

- Game SDK contracts — `apps/mobile/src/sdk/**` (barrel `src/sdk/index.ts`).
- Reference module — `apps/mobile/src/games/memory/**` is the pattern to mirror.
- Persistence — `getDb().sessions.completeSession` via `@/db`.
- Design tokens — `apps/mobile/src/theme/tokens.ts` (read-only).
- Category string — `primaryCategory: 'Logic & Problem Solving'` (exact).

## Required deliverables

Mirror the memory module's layout under `apps/mobile/src/games/logic-code-cracker/`:

- `game.json` — id `logic-code-cracker` (must equal directory name), name "Code Cracker", primaryCategory `Logic & Problem Solving`, sdkVersion = SDK_VERSION, gameVersion "1.0.0", generatorVersion "1.0.0", hasTutorial true. Must pass the registry generator contract.
- `game-definition.ts`, `types.ts` (incl. guess feedback model: exact + color-only counts), `difficulty.ts` (Easy→Expert + Adaptive: code length, color count, guess budget), `generator.ts` (deterministic seeded codes; **validation**: the feedback oracle is consistent — implement and test the oracle (exact matches, color-only matches, no double-counting of colors)), `scoring.ts` (normalizer: solves within budget weighted by guesses used, documented), `session.ts` (reproducibility envelope incl. the full guess/feedback trail + atomic persistence), `hooks.ts` (tutorial + QA force hooks incl. force-solve), `versions.ts`, `screen.tsx` + `components/` (guess builder, feedback pegs, guess history), `index.ts`, `__tests__/` (determinism, oracle correctness vs brute-force cross-check on small alphabets, difficulty, scoring, reducer incl. guess-commit + budget exhaustion, session persistence, screen smoke).

## Conventions

- Semantic testIDs `logic-code-cracker-*`; monotonic clock only; no new dependencies; TypeScript strict; deterministic tests; never import other games.

## Allowed write surfaces

- `apps/mobile/src/games/logic-code-cracker/**`

## Forbidden / shared write surfaces

- `package.json`, lockfiles, jest/tsconfig config.
- `src/sdk/**`, `src/db/**`, `src/app/**`, `src/registry/**`, `src/components/**`, `src/theme/**`, `src/constants/**`, other `src/games/**` — read-only.
- Root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`.

## Completion criteria

- Own tests pass (`npx jest src/games/logic-code-cracker` from `apps/mobile`).
- `npx tsc --noEmit` — fix only errors in your surface.
- `game.json` valid per the registry generator contract.

## Cheap validation

- `npx jest src/games/logic-code-cracker` and `npx tsc --noEmit` (from `apps/mobile`).

## Integration notes for orchestrator

- Orchestrator regenerates `registry.generated.ts` and runs full validation after games land.

## Result/evidence

(agent fills in: files created, test counts/results, deviations, anything the orchestrator must converge)
