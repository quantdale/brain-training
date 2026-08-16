# Task Packet 004-g — Flexibility: Color Stroop (WP-4G)

Campaign: 004-parallel-catalog-expansion
Status: ACTIVE
Owner role: coder agent

## Objective

Build one production-quality Flexibility game as a self-contained module under `apps/mobile/src/games/flexibility-color-stroop`, plugging into the Game SDK. **Mechanic: Color Stroop** — a color word rendered in a (sometimes conflicting) ink color; the player answers the INK color (classic Stroop), with occasional rule-flips (answer the WORD) that the player must track. Distinct from the Phase-2 Flexibility game (Card Sort: rule-switching between sort criteria): this is stimulus-response interference + rule tracking.

Proposed design (refine within spec): 4 colors; congruent/incongruent/neutral trials; rule-flip events every N trials (cue shown); 1–3 minute score-attack session.

## Dependencies

- Game SDK contracts — `apps/mobile/src/sdk/**` (barrel `src/sdk/index.ts`).
- Reference module — `apps/mobile/src/games/memory/**` is the pattern to mirror.
- Persistence — `getDb().sessions.completeSession` via `@/db`.
- Design tokens — `apps/mobile/src/theme/tokens.ts` (read-only; the four game colors should come from tokens where sensible — if tokens lack 4 distinct hues, define them in YOUR module with a documented comment, never edit tokens).
- Category string — `primaryCategory: 'Flexibility'` (exact).

## Required deliverables

Mirror the memory module's layout under `apps/mobile/src/games/flexibility-color-stroop/`:

- `game.json` — id `flexibility-color-stroop` (must equal directory name), name "Color Stroop", primaryCategory `Flexibility`, sdkVersion = SDK_VERSION, gameVersion "1.0.0", generatorVersion "1.0.0", hasTutorial true. Must pass the registry generator contract.
- `game-definition.ts`, `types.ts`, `difficulty.ts` (Easy→Expert + Adaptive: trials, incongruent ratio, time budget, rule-flip frequency), `generator.ts` (deterministic seeded trial sequence; **validation**: word/ink color pairs valid, flip cues scheduled correctly, bounded attempts), `scoring.ts` (normalizer: accuracy + speed, bonus for correct post-flip trials, documented), `session.ts` (reproducibility envelope incl. trial list + rule state trail + atomic persistence), `hooks.ts` (tutorial + QA force hooks), `versions.ts`, `screen.tsx` + `components/` (stimulus display, 4 color answer buttons, rule-cue banner), `index.ts`, `__tests__/` (determinism, generator invariants, difficulty, scoring, reducer incl. rule-flip gating, session persistence, screen smoke).

## Conventions

- Semantic testIDs `flexibility-color-stroop-*`; monotonic clock only; no new dependencies; TypeScript strict; deterministic tests; never import other games.

## Allowed write surfaces

- `apps/mobile/src/games/flexibility-color-stroop/**`

## Forbidden / shared write surfaces

- `package.json`, lockfiles, jest/tsconfig config.
- `src/sdk/**`, `src/db/**`, `src/app/**`, `src/registry/**`, `src/components/**`, `src/theme/**`, `src/constants/**`, other `src/games/**` — read-only.
- Root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`.

## Completion criteria

- Own tests pass (`npx jest src/games/flexibility-color-stroop` from `apps/mobile`).
- `npx tsc --noEmit` — fix only errors in your surface.
- `game.json` valid per the registry generator contract.

## Cheap validation

- `npx jest src/games/flexibility-color-stroop` and `npx tsc --noEmit` (from `apps/mobile`).

## Integration notes for orchestrator

- Orchestrator regenerates `registry.generated.ts` and runs full validation after games land.

## Result/evidence

(agent fills in: files created, test counts/results, deviations, anything the orchestrator must converge)
