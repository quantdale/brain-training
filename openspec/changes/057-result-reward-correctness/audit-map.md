# Audit map — 057-result-reward-correctness

**Program SHA:** `428d293` · **Predecessor:** `056-workout-lifecycle-integrity` (VALIDATED)

## Evidence chain

1. Normalization survival 42/42 → `games/*/scoring.ts` (zero remaining
   `normalized performance must be finite` throws, verified by grep) ·
   per-game corrupt-stat tests (count/accuracy NaN → value 0, no throw) ·
   explicit param guards kept where they exist (tap-rush, vigilance,
   order-sweep, number-line, stroop stimulus windows); games without param
   guards never had them and gain none (no param-throw removed by any
   diff — verified by adversarial sample across all 8 domains).
   Speed-only NaN degrades that term (partial value, e.g. 0.6) — specced
   behavior, not a silent throw. `bestOf` iterative in 4 speed games + 1
   render site, `Math.min` parity incl. NaN poisoning.
2. Optimistic XP parity 42/42 → `rating/xp-hook.ts` (new, orchestrator) ·
   42 screen defaults swapped (grep: 42 imports + 42 defaults, 0 noop
   defaults remain) · shared parity test (`rating/__tests__/xp-hook.test.ts`:
   hook XP ≡ pipeline outcome XP across easy/normal/hard/expert/adaptive +
   unknown-level fallback). Per-game parity rests on the uniform code
   pattern (context difficulty ≡ record level; intro-gated difficulty
   selection verified by packet inspection + adversarial sample) plus the
   shared hook test; per-game screen pins are mirrors, and order-sweep /
   quick-compare pin no XP literal (suite-green only) — recorded, not
   hidden.
3. PB clamp → `app/results.tsx` (`toMs: min(completedAt, now)`) · skew
   test (`results-hero.test.tsx`: bound inside the test window AND
   earlier-best-wins outcome with a mid-band future session).
4. Catalog suites: 361 suites / 4,281 tests green (pre-adversarial-fix
   count; terminal count recorded at close); typecheck; lint;
   `sdk/contracts.test.ts` (noop preserved) green.

## Census findings disposition

- Lane1 #3 (normalization throw-vs-collapse): CLOSED_VERIFIED by (1).
- Lane1 #4 (XP=0 flicker): CLOSED_VERIFIED by (2). Stale "Phase 2" comment
  corrected; noop preserved for seams.
- Lane1 #7 (PB/recency skew): NARROWED on source evidence — tie-handling
  already correct, honesty gate already suppresses weak-PB celebration;
  remaining skew fixed by (3). DOWNGRADED to LOW (pathological same-ms ties
  beyond the clamp are not actionable).
- Lane1 #8 (seed FNV): DEFERRED to 060 (needs schema migration) — recorded
  in 060 scope, not silently dropped.
- Residuals: partial-value collapse for speed-only NaN (specced); latent
  mid-session difficulty-change divergence (no UI/QA path reaches it);
  NaN-budget slip-throughs in games without explicit param guards (15-pt
  default score, session persists — accepted LOW, unreachable in
  production where budgets come from resolved params); unguarded
  `targetCountRange[0]` index in the attention-target-count builder
  (params trusted from resolved profile — accepted LOW, 059/060 structural
  territory); `getById` intentionally renders a direct-linked future
  session the recents list hides (accepted UX, documented); order-sweep /
  quick-compare pin no XP literal (suite-green only). All carried as LOW
  accepted or 065 re-probe items.

## Boundaries (not claimed)

- Human/platform/store/CI per program (MANUAL_PLATFORM_PENDING / EXTERNAL).
- Native device matrix: canary scope per validation section in change record.
