# Task Packet 002-d — Language Game (WP-2D)

Campaign: 002-eight-representative-games
Status: DONE
Owner role: coder agent

## Objective

Build one production-quality Language game as a self-contained module under `apps/mobile/src/games/language-word-match`, plugging into the Game SDK. The mechanic must exercise the **curated/versioned content-pack path** (constitution §31 Phase-2 variety: "curated/content-pack language"; §10 content strategy: curated/versioned packs for vocabulary).

Proposed design (refine within this spec if needed): **Word Match** — each round shows a prompt word; the player picks its synonym from four options (one correct, three plausible distractors). Content comes from a bundled, versioned content pack; selection per round is deterministic via the SDK seeded RNG; difficulty maps to word tier within the pack.

## Dependencies

- Game SDK contracts — read `apps/mobile/src/sdk/**` (barrel `src/sdk/index.ts`).
- Reference module — `apps/mobile/src/games/memory/**` is the pattern to mirror.
- Persistence — `getDb().sessions.completeSession` via `@/db`.
- Design tokens — `apps/mobile/src/theme/tokens.ts` (read-only).

## Required deliverables

Mirror the memory module's file layout under `apps/mobile/src/games/language-word-match/`:

- `game.json` — id `language-word-match`, name "Word Match", primaryCategory `Language`, sdkVersion = SDK_VERSION, gameVersion "1.0.0", **generatorVersion `null`** (curated content, NOT procedural — the registry contract allows null), hasTutorial true.
- `content/` — bundled content pack: `pack.json` with `packId`, `packVersion` (e.g. "1.0.0"), `itemCount`, and the items array. Items: `{ id, prompt, options: [4], correctIndex, tier }` (tier maps to Easy/Normal/Hard). Requirements: at least 60 original items spanning tiers; no duplicate prompts; distractors plausibly confusable with the prompt (same part of speech / semantic neighbors), verified by validation code, not manually claimed.
- `content-validation.ts` (or similar) — loader that validates the pack at module load: schema, unique ids, unique prompts, correctIndex in range, 4 options, no option duplicated with the correct one, correct answer is a genuine synonym per the pack author's declared mapping; unit tests over the whole pack.
- `game-definition.ts`, `types.ts`, `difficulty.ts` (tier selection + round count + time budget per difficulty; SDK difficulty contract), `versions.ts` (include `CONTENT_PACK_VERSION`), `scoring.ts`, `session.ts`, `hooks.ts`, `screen.tsx` + `components/`, `index.ts` (default export = screen), `__tests__/` — all per the memory pattern and packet 002-a conventions.
- `generator.ts` (or `selection.ts`) — deterministic seeded item/option-shuffling: same seed → same round order and option arrangement; no near-duplicate rounds within a session.
- Raw result and diagnostics must record the content pack id/version (reproducibility envelope per constitution §21 — old results must remain interpretable when the pack evolves).
- Normalization: accuracy + speed → [0,1], documented, fixed-seed tests.
- QA force-state hooks (force-win/force-lose/force-timeout), dev-only.

## Conventions

- Semantic testIDs `language-word-match-*`.
- No new dependencies; imports only `@/sdk`, `@/db`, `@/theme`, `@/constants`, react/react-native primitives, own module.
- Content must be original and modest in size (keep the bundle light); no copyrighted word lists.
- TypeScript strict; deterministic tests; no secrets; never import other games.

## Allowed write surfaces

- `apps/mobile/src/games/language-word-match/**`

## Forbidden / shared write surfaces

- `package.json`, lockfiles, jest/tsconfig config.
- `apps/mobile/src/sdk/**`, `apps/mobile/src/db/**`, `apps/mobile/src/app/**`, `apps/mobile/src/registry/**`, `apps/mobile/src/components/**`, `apps/mobile/src/theme/**`, `apps/mobile/src/constants/**` (read-only).
- Root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`, `AGENTS.md`.

## Completion criteria

- Content-pack validation tests pass over the full pack; logic/scoring/session tests pass (targeted jest for your dir).
- Own files typecheck clean; other agents' in-flight errors elsewhere are reported, not fixed.
- `game.json` valid per registry generator contract (generatorVersion null is legal).

## Cheap validation

- `npx jest apps/mobile/src/games/language-word-match` (from `apps/mobile`)
- `npx tsc --noEmit` (from `apps/mobile`) — fix only your surface.

## Integration notes for orchestrator

- Orchestrator regenerates the registry and validates end-to-end after convergence.
- Route renders your module's default export with no props.

## Result/evidence

(agent fills in: item counts per tier, validation results, deviations)
