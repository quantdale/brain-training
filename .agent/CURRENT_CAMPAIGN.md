# Campaign 005 — Catalog Depth and UX Polish (Phase 5)

**Status:** ACTIVE (staged; work begins on the next continuation goal)
**Campaign type:** implementation
**Hardening:** NO — moderate risk-based validation only
**Parent plan:** `docs/MASTER_PLAN.md` Phase 5 (later phases)

## Context

Campaign 004 (Parallel Catalog Expansion) is COMPLETED — 16-game catalog
with 2 games per cognitive domain, all registered, tested, and verified on
emulator. The catalog now has sufficient breadth; this campaign adds depth
to the most-used domains and polishes the UX across the existing catalog.

## Objective

Expand catalog depth in high-traffic domains and polish the user experience:

1. **4 new game modules** (one per high-traffic domain: Memory, Speed, Math,
   Language), each:
   - self-contained under `apps/mobile/src/games/<id>/`, plugging into the
     Game SDK (same contracts as existing games);
   - a distinct mechanic from the existing two games in the same domain;
   - deterministic seeded generation, versioned scoring, full jest coverage,
     semantic testIDs;
   - `game.json` valid per the registry generator contract.
2. **Content expansion**: add curated content packs where needed (word banks
   for Language games, equation templates for Math games).
3. **UX polish**:
   - improve tutorial flow consistency across all 20 games;
   - add game-description text to game.json for the library detail view;
   - ensure all games have consistent pause-overlay styling.
4. **Moderate validation**: repo validator + tsc + full jest + registry
   `--check` + targeted emulator smoke.
5. **Parity matrix update** at the end.

## Proposed games (4 new, 3 per domain for 4 domains)

| Domain | New Game | Mechanic |
|--------|----------|----------|
| Memory | pattern-tap-back | Observe a pattern on a grid, tap it back from memory |
| Speed | speed-color-match | Match the color word to its swatch under time pressure |
| Math | math-equation-builder | Build equations from given numbers and operators to reach a target |
| Language | language-sentence-builder | Arrange words into a grammatically correct sentence |

## Shared-file ownership rule (unchanged)

Orchestrator owns navigation, db schema/migrations, theme tokens, generated
artifacts, package manifests, and any new shared seams. Coders own their game
module directories only. Registry regeneration + full validation happen in
orchestrator convergence waves between swarm launches.

## Light validation required

- repository-state validator; typecheck + jest (whole tree)
- registry generator `--check`
- targeted emulator smoke for the new games (one AVD)
- CI green on every pushed wave
- no host-input interference maintained

## Exit criteria

- 4 new games merged, registered, tested, playable on the emulator
- 20-game catalog verified end-to-end (library, workout selection, game play)
- content packs expanded where needed
- UX polish items completed
- no unresolved Critical/High defect
- parity matrix updated; committed docs/state match repository reality;
  clean `main` pushed

## On completion

Archive checkpoint; the next campaign is selected by the owner (further
expansion, hardening, or a later-phase system).
