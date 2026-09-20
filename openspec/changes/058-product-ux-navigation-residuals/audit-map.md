# Audit map — 058-product-ux-navigation-residuals

**Program SHA:** `428d293` · **Predecessor:** `057-result-reward-correctness` (VALIDATED)

## Evidence chain

1. Touch floors → `progress.tsx:textLinkRow`, `progress-domain.tsx:
   textLinkRow`, recovery `retry:minHeight:44+hitSlop:12`,
   game-detail unknown-browse label `MinTouchTarget`, AVS `tile:min/max:44`
   · tests: recovery-screen floor, AVS tile floor (style-resolved).
2. Copy wrap → `empty-state.tsx` (cap removed, doc updated) · wrap test.
3. Safe back → `back-link.tsx:backOrFallback+useSafeBack` (+ barrel
   export) · 8 app-route back usages via 6 hook sites
   (progress-domain/detail/activity/game×2, results→`/`, game-detail
   shared→`/games` ×2, local duplicate deleted,
   `accessibilityLabel="Back to Games"` preserved) ·
   `back-link.test.tsx` (truth table + back/replace dispatch).
4. Suites: affected-area green incl. tutorial-frame layout, recovery,
   error-boundary, game-detail (+ unknown-browse floor), results,
   progress (+ both text-link floors), visual-baselines (3 snapshots
   regenerated — diff is exactly the removed `numberOfLines={1}`);
   typecheck; lint; OpenSpec strict. Terminal full-matrix counts recorded
   at close.

## Census claims corrected by source evidence (not re-filed)

- Recovery Tappable/Button: prohibited (provider-free degraded surface).
- TutorialFrame scroll: ScrollView measuring-cycle hazard (file comment,
  055P device-verified) — no change.
- error-boundary/game-not-ready: `...MinTouchTarget` already spread.
- Button/report ellipsis: fixed-chrome 2x design, a11y tree complete.
- Refero: not triggered — contract floors only, Signal Arcade untouched.

## Residuals

- 42 game-screen quits keep bare `router.back()` (in-flow stacks only) —
  accepted LOW, 065 re-probe.
- Below-fold CTAs + short-board dead space: accepted LOW (055 record).
- Future tall tutorial steps beyond the overlay: hypothetical, 065 watch.

## Boundaries

Manual/platform/store/CI per program. No pixel-direction change: six-way
certification stays with 067.
