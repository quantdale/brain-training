# Campaign 004 — Parallel Catalog Expansion (Phase 4)

**Status:** ACTIVE (staged; work begins on the next continuation goal)
**Campaign type:** implementation
**Hardening:** NO — moderate risk-based validation only
**Parent plan:** `docs/MASTER_PLAN.md` Phase 4

## Context

Campaign 003 (Platform Integration) is COMPLETED and the constitution §32
mass-expansion gate PASSED (`.agent/checkpoints/003-platform-integration-complete.md`).
Phase 4 — Parallel Catalog Expansion — is now eligible. The parity matrix
(`docs/PARITY_MATRIX.md`) tracks the target catalog; each cognitive domain
currently has exactly one representative game from Phase 2.

## Objective

Expand the game catalog toward the parity matrix using campaign-sized swarm
waves. Concretely, this campaign adds **one additional game per cognitive
domain** (Attention, Speed, Memory, Math, Language, Logic & Problem Solving,
Flexibility, Spatial) so every domain has at least two games, plus light
catalog-health work where it is cheap and safe:

1. **8 new game modules** (one per domain), each:
   - self-contained under `apps/mobile/src/games/<id>/`, plugging into the
     Game SDK (same contracts as the Phase-2 games: lifecycle, monotonic
     timing, pause, tutorial, QA hooks, normalization, session persistence);
   - a distinct mechanic from the Phase-2 representative in the same domain
     (no near-copies);
   - deterministic seeded generation, versioned scoring, full jest coverage
     (logic/reducer/scoring/session/screen smoke), semantic testIDs;
   - `game.json` valid per the registry generator contract.
2. **Registry + catalog health**: regenerate `registry.generated.ts`
   (orchestrator), confirm library search/filter and Home workout selection
   handle 16 games, extend workout tests to 16-game catalogs.
3. **Content packs**: add a second curated versioned pack for Language
   (e.g. reading/grammar tier) only if the new Language game needs one;
   otherwise defer to a later wave.
4. **Moderate validation**: repo validator + tsc + full jest + registry
   `--check` + web export smoke + targeted emulator smoke (games render and
   are playable via QA hooks on `braintraining35`).
5. **Parity matrix update** at the end (catalog rows → IMPLEMENTED).

## Shared-file ownership rule (unchanged)

Orchestrator owns navigation, db schema/migrations, theme tokens, generated
artifacts, package manifests, and any new shared seams. Coders own their game
module directories only. Registry regeneration + full validation happen in
orchestrator convergence waves between swarm launches.

## Light validation required

- repository-state validator; typecheck + jest (whole tree)
- registry generator `--check` + web export smoke
- targeted emulator smoke for the new games (one AVD)
- CI green on every pushed wave
- no host-input interference maintained

## Exit criteria

- 8 new games merged, registered, tested (each with deterministic full-session
  coverage), playable on the emulator
- 16-game catalog verified end-to-end (library, workout selection, game play)
- no unresolved Critical/High defect
- parity matrix updated; committed docs/state match repository reality;
  clean `main` pushed

## On completion

Archive checkpoint; the next campaign is selected by the owner (further
catalog expansion, or a hardening campaign only if the owner explicitly
starts one).
