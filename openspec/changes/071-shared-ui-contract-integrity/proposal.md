# Change 071 — Shared UI Contract Integrity and Kit Hygiene

## Why

The shared component kit is the surface every screen and all 42 games render
through, and it has several contract defects that propagate silently to every
consumer.

The sharpest is a prop-order bug in the base pressable primitive: `Tappable`
computes a merged `accessibilityState` that injects the `disabled` flag, but
`accessibilityState` is not destructured out of props, so it is still present in
the rest-spread — and the rest-spread is applied **after** the computed value.
JSX applies props left-to-right, so the raw caller value overwrites the merge.
Any caller that supplies a partial `accessibilityState` therefore loses the
disabled announcement. `SegmentedControl` does exactly this
(`accessibilityState={{ selected }}`), so a disabled option in a segmented
control is announced to a screen reader as "selected" with no disabled state.
`Button` and `Chip` are unaffected only because they re-state `disabled`
themselves — the defect is invisible precisely where the code is redundant.

Second, the minimum-touch-target contract is exported twice under one name with
incompatible shapes: a number (`44`) from the theme tokens, and a style fragment
(`{ minHeight, justifyContent }`) from the accessibility leaf. 17 call sites use
the numeric form and 3 use the object form. A single import-path change at any
of those sites would silently produce `minHeight: [object Object]`, and nothing
in the type system distinguishes them because the two exports live in different
modules.

Third, the kit carries eight components with no product importer — including
`GameCard` (182 lines) — plus dead auxiliary exports, several of which still
have dedicated test suites, so the suite is green over code no user can reach.
Barrels still re-export them "for compatibility", which inflates the perceived
API surface and invites new code to import the wrong twin (`ResultRow` vs
`StatRow`, `game-card` vs `game-poster-tile`).

Fourth, `react-native-reanimated` 4.5.1 is a declared **runtime** dependency
with zero imports anywhere in the app: all motion uses the legacy `Animated`
API. It contributes native code and bundle weight for nothing, and it makes the
constitution's "Reanimated is preferred" statement untrue in practice.

Fifth, `docs/DESIGN_SYSTEM.md` documents the superseded v3 "Neon Arcade"
generation — its radii, type scale, and palette hexes are absent from the
shipped v4 "Signal Arcade" tokens — and claims coverage ("Confetti
reduced-motion is exercised by kit contract tests") for primitives that have no
suite.

## What Changes

- Fix the pressable primitive so the merged accessibility state is the value
  actually applied, and add a regression test that fails if the spread order is
  ever restored.
- Collapse the two minimum-touch-target exports into one canonical name and one
  shape, and update every consumer mechanically.
- Delete the unreachable components and dead exports together with their
  orphaned tests, and remove the corresponding barrel re-exports, so the kit's
  public surface matches what is actually used.
- Remove the unused `react-native-reanimated` runtime dependency, or record an
  explicit, dated decision to keep it — an unused native runtime dependency is
  not a neutral default.
- Bring `docs/DESIGN_SYSTEM.md` in line with the shipped tokens, and make its
  coverage claims match reality.
- Close the load-bearing primitive coverage gaps (Confetti, StateCard,
  SectionGrid, toast overflow).

## Capabilities

### New Capabilities

- `shared-ui-contract`: the observable behavior of the shared component kit —
  accessibility state composition, the minimum touch-target contract, and the
  guarantee that a documented kit component is a reachable, tested one.

### Modified Capabilities

None. No existing capability spec exists under `openspec/specs/`.

## Impact

- `apps/mobile/src/components/ui/tappable.tsx` (spread order),
  `apps/mobile/src/components/ui/segmented-control.tsx` (affected caller).
- `apps/mobile/src/components/a11y/touch-target.ts` + `apps/mobile/src/theme/tokens.ts`
  (single canonical export) and every consumer of either name.
- Deletion set: `ui/avatar.tsx`, `ui/screen-header.tsx`, `shell/level-card.tsx`,
  `shell/streak-card.tsx`, `discovery/game-card.tsx`, `game-ui/result-row.tsx`,
  `a11y/dialog.tsx` (`A11yDialog`), `a11y/announcements.tsx` (`LiveRegion`), and
  dead auxiliary exports; plus their barrels
  (`ui/index.ts`, `shell/index.ts`, `game-ui/index.ts`, `a11y.ts`).
- `apps/mobile/package.json` (dependency removal), `apps/mobile/package-lock.json`.
- `docs/DESIGN_SYSTEM.md`.
- No screen layout, no product behavior, no visual design change intended.
