# Task Packet 004-e — Language: Word Scramble (WP-4E)

Campaign: 004-parallel-catalog-expansion
Status: ACTIVE
Owner role: coder agent

## Objective

Build one production-quality Language game as a self-contained module under `apps/mobile/src/games/language-word-scramble`, plugging into the Game SDK. **Mechanic: Word Scramble** — a word's letters are scrambled with a category hint; the player picks the correct unscrambled word from options (or taps letters to rebuild it — choose ONE interaction, options-tap is preferred for accessibility). Distinct from the Phase-2 Language game (Word Match: synonym matching): this is lexical decoding with a hint.

Proposed design (refine within spec): a curated word list with category hints (reuse vocabulary from `games/language-word-match/content/pack.json` READ-ONLY — e.g. its families as hint categories, but choose NEW target words or reuse; do NOT modify the pack); rounds escalate (longer words, fewer distractors); 1–3 minute score-attack session.

## Dependencies

- Game SDK contracts — `apps/mobile/src/sdk/**` (barrel `src/sdk/index.ts`).
- Reference module — `apps/mobile/src/games/memory/**` is the pattern to mirror.
- Persistence — `getDb().sessions.completeSession` via `@/db`.
- Design tokens — `apps/mobile/src/theme/tokens.ts` (read-only).
- Content — `apps/mobile/src/games/language-word-match/content/pack.json` + `content-validation.ts` (READ-ONLY reference for style; do not import the other game's module at runtime — if you reuse words, embed a small curated list in YOUR module with a documented provenance comment).
- Category string — `primaryCategory: 'Language'` (exact).

## Required deliverables

Mirror the memory module's layout under `apps/mobile/src/games/language-word-scramble/`:

- `game.json` — id `language-word-scramble` (must equal directory name), name "Word Scramble", primaryCategory `Language`, sdkVersion = SDK_VERSION, gameVersion "1.0.0", generatorVersion "1.0.0", hasTutorial true. Must pass the registry generator contract.
- `game-definition.ts`, `types.ts`, `difficulty.ts` (Easy→Expert + Adaptive: word length, distractor count, time budget), `generator.ts` (deterministic seeded scrambles; **validation**: scramble differs from the original, unique options (no duplicates), bounded attempts), `scoring.ts` (normalizer: accuracy + speed, documented), `session.ts` (reproducibility envelope + atomic persistence), `hooks.ts` (tutorial + QA force hooks), `versions.ts`, `screen.tsx` + `components/` (scrambled word display, category hint, option buttons), `index.ts`, `__tests__/` (determinism, generator invariants, difficulty, scoring, reducer, session persistence, screen smoke).

## Conventions

- Semantic testIDs `language-word-scramble-*`; monotonic clock only; no new dependencies; TypeScript strict; deterministic tests; never import other games (content pack read-only at development time only).

## Allowed write surfaces

- `apps/mobile/src/games/language-word-scramble/**`

## Forbidden / shared write surfaces

- `package.json`, lockfiles, jest/tsconfig config.
- `src/sdk/**`, `src/db/**`, `src/app/**`, `src/registry/**`, `src/components/**`, `src/theme/**`, `src/constants/**`, other `src/games/**` (including the language-word-match module and its pack) — read-only.
- Root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`.

## Completion criteria

- Own tests pass (`npx jest src/games/language-word-scramble` from `apps/mobile`).
- `npx tsc --noEmit` — fix only errors in your surface.
- `game.json` valid per the registry generator contract.

## Cheap validation

- `npx jest src/games/language-word-scramble` and `npx tsc --noEmit` (from `apps/mobile`).

## Integration notes for orchestrator

- Orchestrator regenerates `registry.generated.ts` and runs full validation after games land.

## Result/evidence

(agent fills in: files created, test counts/results, deviations, anything the orchestrator must converge)
