# Campaign 002 — Eight Representative Games (Phase 2)

**Status:** ACTIVE (staged; work begins on the next continuation goal)
**Campaign type:** implementation
**Hardening:** NO — light/risk-based validation only
**Parent plan:** `docs/MASTER_PLAN.md` Phase 2

## Context

Campaign 001 (Autonomous Foundation) is COMPLETED
(`.agent/checkpoints/001-autonomous-foundation-complete.md`). The platform
exists: four-tab shell, SQLite persistence, Game SDK, generated registry,
ADB/uiautomator harness, CI, recovery drill, and one representative Memory
game — all verified on the dedicated AVD `braintraining35`.

## Objective

Expand the catalog to exactly one strong representative game per top-level
category (constitution §8, MASTER_PLAN Phase 2) before any mass expansion:

1. **Memory** — `memory` (exists, campaign 001)
2. **Attention** — rapid visual selection/distractor mechanics
3. **Speed** — precision reaction timing
4. **Math** — validated procedural arithmetic
5. **Language** — curated/versioned content-pack path
6. **Logic & Problem Solving** — procedural puzzle with solver/validation
7. **Flexibility** — rule-switching state machine
8. **Spatial** — richer visual/spatial rendering (Skia only if justified)

Each new game is a self-contained module under `apps/mobile/src/games/<id>/`
with its own `game.json` (registered via `node scripts/generate-game-registry.mjs`),
unit tests, semantic testIDs, tutorial, result normalization, persistence via
`@/db`, and dev-only QA force-state hooks.

## Work packages (orchestrator splits into `.agent/tasks/` packets before swarm)

- WP-2A — Attention game
- WP-2B — Speed game
- WP-2C — Math game
- WP-2D — Language game (+ bundled content pack v1 with version metadata)
- WP-2E — Logic game (+ solver/validation)
- WP-2F — Flexibility game
- WP-2G — Spatial game
- WP-2H — shared platform: normalized scoring, domain ratings + overall score,
  XP/player level, currency ledger UI, results screens, game detail screens,
  favorites/search/filter basics, basic Progress analytics

## Shared-file ownership rule

Same as campaign 001: orchestrator owns package manifests/lockfiles, root
config, navigation registries, DB schema coordination, SDK contract
integration, generated registry/index convergence. Parallel coders never race
on those.

## Light validation required

- repository-state validator
- typecheck + jest (whole tree)
- web export smoke
- registry generator `--check`
- per-game targeted emulator smoke (orchestrator-owned runtime QA, one AVD)
- no host-input proof maintained

## Exit criteria

- all eight representative games function (playable end-to-end on the emulator)
- Game SDK survives all represented mechanics (canary coverage)
- scoring/rating/XP/currency/progress persistence and Today's Workout work
- results screens + game detail screens + favorites/search basics exist
- light validation/canary suite works; CI green
- no unresolved Critical/High defect
- committed docs/state match repository reality; clean `main` pushed

## On completion

Archive checkpoint; set the Phase 3 campaign (Platform Integration +
Autonomy/Platform Gate) per MASTER_PLAN; do NOT enter mass catalog expansion
(Phase 4) before the gate is satisfied.
