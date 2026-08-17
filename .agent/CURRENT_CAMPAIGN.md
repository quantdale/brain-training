# Campaign 006 — Platform Hardening and Polish (Phase 6)

**Status:** ACTIVE (staged; work begins on the next continuation goal)
**Campaign type:** implementation
**Hardening:** NO — moderate risk-based validation only (owner must explicitly start hardening)
**Parent plan:** `docs/MASTER_PLAN.md` Phase 6 (later phases)

## Context

Campaign 005 (Catalog Depth and UX Polish) is COMPLETED — 20-game catalog
with 3 games in Memory/Speed/Math/Language and 2 games in
Attention/Logic/Flexibility/Spatial. The catalog is now substantial; this
campaign focuses on platform quality and polish.

## Objective

Improve platform quality, accessibility, and performance:

1. **Accessibility audit and improvements**:
   - Add `accessibilityLabel` to all interactive elements across 20 games.
   - Ensure consistent `accessibilityRole` usage (button, image, text).
   - Add `accessibilityState` for disabled/selected states.
   - Test with TalkBack (Android screen reader) — basic smoke only.

2. **Performance optimizations**:
   - Add `React.memo` to frequently re-rendered game components (tiles, buttons, grids).
   - Lazy-load game screens via `React.lazy` + `Suspense` in the registry.
   - Profile and optimize generator performance for large content banks.

3. **Error handling improvements**:
   - Add error boundaries around game screens.
   - Improve persistence error handling (retry logic for transient failures).
   - Add structured logging for QA diagnostics.

4. **Tutorial consistency pass**:
   - Audit all 20 games for tutorial flow consistency.
   - Ensure all tutorials have: intro → demo → done (3 steps minimum).
   - Standardize tutorial styling across games.

5. **Content pack expansion**:
   - Add 50 more sentences to language-sentence-builder (150 total).
   - Add 20 more equation templates to math-equation-builder.
   - Add 30 more word pairs to language-word-match.

6. **Moderate validation**: repo validator + tsc + full jest + emulator smoke.

## Shared-file ownership rule (unchanged)

Orchestrator owns navigation, db schema/migrations, theme tokens, generated
artifacts, package manifests, and any new shared seams. Coders own their game
module directories only. Registry regeneration + full validation happen in
orchestrator convergence waves between swarm launches.

## Light validation required

- repository-state validator; typecheck + jest (whole tree)
- registry generator `--check`
- targeted emulator smoke for accessibility improvements (one AVD)
- CI green on every pushed wave
- no host-input interference maintained

## Exit criteria

- Accessibility audit complete with improvements applied
- Performance optimizations applied (memo, lazy-loading)
- Error boundaries around game screens
- Tutorial consistency verified across 20 games
- Content packs expanded
- no unresolved Critical/High defect
- parity matrix updated if needed; committed docs/state match reality;
  clean `main` pushed

## On completion

Archive checkpoint; the next campaign is selected by the owner (iOS
compatibility, account/auth, cloud sync, or further expansion).
