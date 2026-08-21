# Campaign 010 — Mass Product Implementation (worker packets)

**Campaign id:** `010-mass-product-implementation`
**Baseline:** `main` @ `e0d92ce` (post-009), clean tree, 38 games.
**Topology:** 1 parent orchestrator (sole git/integration/registry authority) + workers W01–W16 with strict disjoint write ownership.

## Binding contract (every worker)

1. READ FIRST: this file, your packet `Wxx.md`, root `AGENTS.md`, `apps/mobile/AGENTS.md`, and skim `docs/PROJECT_CONSTITUTION.md`.
2. You NEVER run git commands (no branch/commit/push/stash/merge). The parent owns Git exclusively.
3. You write ONLY inside your packet's **Owned paths**, plus the Status / Implementation summary / NOT VALIDATED gaps sections of your own packet file. Everything else is read-only.
4. Universal forbidden paths (unless your packet explicitly grants an exception):
   - `apps/mobile/src/registry/registry.generated.ts` and `apps/mobile/src/registry/registry.ts` — parent regenerates once at convergence via `node scripts/generate-game-registry.mjs`
   - `package.json`, lockfiles, `app.json` (exception: W15), `android/`, `ios/`, `metro.config.js`
   - `apps/mobile/src/db/schema.ts`, `apps/mobile/src/db/migrate.ts` (exception: W11, only if genuinely required)
   - `.agent/**` except your own packet file
   - any path owned by another worker (see ownership map below)
5. Cross-worker needs: DO NOT edit the other surface. Add a `NEEDS_PARENT:` block to your packet (required interface / why / desired signature / consumer) and continue without it if possible.
6. Validation policy — THIS IS NOT A TESTING CAMPAIGN:
   - Do NOT run full Jest, lint, builds, exports, emulators, or benchmark suites.
   - Allowed: reading code, TS reasoning, at most ONE `npx tsc --noEmit` run near completion (expect concurrent-edit noise from other workers — fix only errors in YOUR files), and optionally ONE targeted run of `npx jest src/sdk/__tests__/catalog-contracts.test.ts` if you touched game-module conventions (ignore failures originating in files you do not own).
   - Small unit tests for NEW pure logic (generator/scoring determinism) are welcome but capped (~≤8 tests each); do not build test suites.
7. New game modules MUST follow existing module conventions. Study `apps/mobile/src/games/memory-pair-recall/` and `apps/mobile/src/games/math-number-line-estimation/` (newest full-bar slices) plus `math-fast-math` (classic shape). Required files: `game.json`, `game-definition.ts`, `difficulty.ts`, `generator.ts`, `reducer.ts`, `scoring.ts`, `session.ts`, `screen.tsx`, tutorial, `hooks.ts`, `types.ts`, `versions.ts`, `index.ts`, `components/`. Required qualities: deterministic seeded generation, injectable monotonic clock (`sdk/timing.ts`), pause/resume freeze semantics, AppState auto-pause, dev-gated QA force-win path, semantic testIDs, tutorial, adaptive-profile seam, sensory calls via the shared SFX alias vocabulary (`sdk/audio-haptics*.ts`), accessibility semantics (roles/labels/challenge hidden while paused), named difficulties, registry-ready `game.json`.
8. Interfaces you did not create are frozen: keep public export shapes of modules you merely consume backward-compatible (additive only) unless your packet owns them.
9. Record honestly: anything not validated is reported as NOT VALIDATED — never claimed as tested.
10. Expo SDK 57 / RN 0.86 / React 19 / TS 6. Per `apps/mobile/AGENTS.md`: consult https://docs.expo.dev/versions/v57.0.0/ before using Expo APIs.

## Ownership map (strict; exact paths in packets)

| Worker | Surface |
|---|---|
| W01 | `games/attention-sustained-vigilance/**` (NEW game) |
| W02 | `games/speed-<new>/**` (NEW game) |
| W03 | `games/math-<new>/**` (NEW game) |
| W04 | `games/memory-<new>/**` OR `games/logic-<new>/**` (NEW game) |
| W05 | `components/game-host/**` (NEW) + designated migration games |
| W06 | workout engine except `personalize.ts` + `db/workout.ts` |
| W07 | `workout/personalize.ts` + `personalization/**` (NEW) |
| W08 | analytics except `queries.ts` + progress screens + progress charts |
| W09 | `analytics/queries.ts` + new projection modules |
| W10 | `data-portability/**` |
| W11 | db core (except domain db files owned by W06/W12) |
| W12 | engagement domains + their db files + rewards screen |
| W13 | shell app screens (home/games/profile/results/game/game-detail/data-management/storage-unavailable) + new shared shell components |
| W14 | a11y primitives + themed text/view + `game-ui/**` + `sensory/**` |
| W15 | `app.json` + committed Android manifest + platform config cleanup (package.json diffs reported to parent, parent applies) |
| W16 | `screen-shell.tsx` + `theme/tokens.ts` (additive platform values) + new `platform/**` adapters |

Shared hotspots reserved for the PARENT: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, generated registry, `package.json`/lockfiles, `db/schema.ts`/`migrate.ts` (via W11's granted exception), durable state files, git.

## Worker exit protocol

When done (or blocked), edit YOUR packet file only: set `Status`, fill `Implementation summary` and `NOT VALIDATED gaps`. List every `NEEDS_PARENT:` item there too.
