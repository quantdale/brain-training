# Change 058 — Product UX & Navigation Residuals

**Status:** IN_PROGRESS
**Predecessor:** `057-result-reward-correctness` (VALIDATED)
**Program SHA:** `428d293`
**Theme:** 056–058 product and behavioral completeness (last behavioral item).

## Problem / evidence

Lane-7 census residuals re-verified against current source at `9cd548f`.
Four claims wereCORRECTED by source evidence during verification (recorded
here so they are not re-filed):

- Recovery retry is deliberately dependency-free (providers may have
  failed) — the fix is a plain-style 44dp floor, NOT Tappable/Button.
- TutorialFrame has no internal scroll BY DESIGN (a ScrollView created an
  auto-height measuring cycle that collapsed the retry control —
  device-verified, 055P). Tall steps remain bounded by the overlay; no
  change.
- Error-boundary and game-not-ready retry controls already spread
  `...MinTouchTarget` (size contract holds; only haptics/press-scale
  differ) — no change.
- Button label/sublabel ellipsis at 2x is a designed fixed-chrome
  tradeoff (minHeight growth, full text in the a11y tree) — no change.

Real defects fixed by this change:

1. `progress-activity-link` and `progress-domain-back-link` are bare text
   `Tappable`s with no style: visual touch height ~20dp < 44
   (`progress.tsx:625-633`, `progress-domain.tsx:217-224`).
2. `EmptyState` truncates its message to one line (`empty-state.tsx:44`),
   hiding recovery guidance (e.g. the ~100-char unknown-game message).
3. Recovery retry has no enforced 44dp floor (`recovery-screen.tsx:158` —
   passes today only via padding arithmetic).
4. Eight app-route back usages across six routes (`progress-domain`,
   `progress-detail`, `progress-activity`, `progress-game` ×2,
   `results`, `game-detail` ×2 via a local duplicate) call bare
   `router.back()`, stranding cold deep-link landings with an empty stack.
5. Unknown-game `Browse games ›` is an unstyled raw `Pressable` (~18dp).
6. AVS tiles have no minimum floor (pass empirically today, unlike
   `memory-grid-recall` cells which pin `MinTouchTarget`).

## Desired invariant / outcome

- Every canonical-surface interactive control is ≥44dp by style (not by
  accident of padding), including provider-free degraded surfaces.
- Recovery/empty copy never truncates guidance for sighted users.
- Every app-route back resolves somewhere useful with an empty stack
  (per-route fallback); game-screen quits stay as-is (in-flow stacks only —
  accepted LOW residual for the 065 sweep).
- No pixel/visual-direction change: Signal Arcade baseline preserved.
  (Refero decision: contract-level fixes only, no new visual language —
  no style/screens research warranted; recorded explicitly.)

## Non-goals

- No visual redesign, tokens, layout, game mechanics, scoring, economy,
  schema, routing architecture, or new features.
- No Tappable/Button on provider-free degraded surfaces.
- No internal scroll in TutorialFrame.
- No game-screen quit-path changes (42 screens — 065 territory).
- Seed migration (→ 060).

## Affected areas

`app/(tabs)/progress.tsx`, `app/progress-domain.tsx`,
`components/ui/empty-state.tsx`, `components/recovery-screen.tsx`,
`components/ui/back-link.tsx` (+ 8 route usages / 6 hook sites),
`app/game-detail/[id].tsx` (local BackLink → shared),
`games/attention-visual-search/components/tile.tsx`, focused tests.

## Protected contracts

Degraded-path dependency-freedom, tutorial overlay measuring behavior,
fixed-chrome 2x behavior, existing testIDs/labels/copy, workout/session
identity, offline, console baseline, registry, a11y expectations.

## Implementation plan

1. Bare-link styles: `minHeight: MinTouchTarget` + vertical centering on
   both Tappables; unknown-browse mirrors the game-not-ready
   MinTouchTarget-on-label pattern.
2. EmptyState: message wraps (drop `numberOfLines={1}`); update the
   component doc ("one-line explanation" → wrapped explanation).
3. Recovery retry: `minHeight: 44` + `hitSlop: 12` on the plain Pressable;
   comment why Tappable is prohibited here.
4. `useSafeBack(fallbackHref)` in `back-link.tsx` (pure
   `backOrFallback(canGoBack)` core for testability) + migrate the 8 app-route back usages (6 hook sites)
   BackLinks with per-route fallbacks (`/progress` ×5 incl. both
   progress-game instances, `/` for results, `/games` for game-detail,
   replacing its local duplicate).
5. AVS tile: `minHeight/minWidth: MinTouchTarget` mirroring cell.tsx.
6. Tests: safe-back core + hook behavior; touch-floor assertions where
   cheap (styles/contracts, not pixels); run affected suites; full matrix.
7. Adversarial critic; durable state; commit; push.

## Test plan

- New: `backOrFallback` unit tests; `useSafeBack` back-vs-replace tests;
  empty-state wrap test; recovery floor test; AVS floor test.
- Existing: progress/game-detail/results/error-boundary/game-not-ready/
  AVS suites green; full gated Jest + console gate + typecheck + lint +
  validators + OpenSpec strict.

## Runtime/native evidence plan

No layout/visual-direction change (style floors only, same pixels at
default scale): repository gates are the evidence. Route-fallback behavior
covered by unit/route tests. Full six-way pixel certification stays with
067 (unchanged surfaces re-certified there anyway).

## Rollback / risk notes

- Each fix is local and independently revertible.
- Main risk: `Link asChild` + Tappable/MinTouchTarget interplay on
  unknown-browse — mitigated by mirroring the proven game-not-ready
  pattern and running game-detail tests.
- `useSafeBack` changes cold-link back behavior only when the stack is
  empty; normal flows are byte-identical (`canGoBack() === true` → back).

## Completion criteria

Standard terminal bar (spec satisfied, full matrix exact counts,
adversarial review, durable state, pushed, `HEAD == origin/main`, no temp
worktrees) + zero unresolved TRUE_UNDERSIZED on touched surfaces by
construction (style floors).
