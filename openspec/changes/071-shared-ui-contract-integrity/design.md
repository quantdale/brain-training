# Design — 071-shared-ui-contract-integrity

## Context

See `proposal.md` — Why. The four defects share one root: **the kit's
contracts are expressed as convention rather than as a single enforced
definition**, so nothing detects a second definition, a lost merge, or a
documented component that nothing imports.

Measured at `2a765cc`:

- `ui/tappable.tsx:95` computes
  `accessibilityState={{ disabled: disabled === true, ...(rest.accessibilityState ?? {}) }}`;
  `:106` applies `{...rest}`. `accessibilityState` is not destructured, so it is
  still in `rest`. `ui/segmented-control.tsx:117` passes `{ selected }` only.
- `a11y/touch-target.ts:20` exports `MinTouchTarget` as a style fragment;
  `theme/tokens.ts:586` exports `MinTouchTarget` as the number `44`. 17 call
  sites use the numeric form (`height:`/`minHeight:`/`minWidth:`), 3 use the
  object form in a style array.
- Importer census over the tree (product vs test): `Avatar`, `ScreenHeader`,
  `LevelCard`, `StreakCard`, `A11yDialog`, `LiveRegion`, `ResultRow`,
  `TabButton` → 0 product / 1 test; `GameCard`, `CONFETTI_COLORS`,
  `CONFIRM_ARM_MS`, `CustomTabList` → 0/0. `discovery/game-card.tsx` is 182
  lines and unreachable.
- `package.json` declares `react-native-reanimated: 4.5.1`;
  `grep -rln reanimated apps/mobile/src` → 0 files. All motion is legacy
  `Animated`.
- `docs/DESIGN_SYSTEM.md` documents v3 radii 8/10/16/22/30 and a
  title 30/800 / display 38/900 scale; `theme/tokens.ts:377-382,440,442` ship
  4/8/12/16/22 and 32/900 / 42/900. Documented hexes are absent from tokens.
- `a11y.ts:14,16` documents a `result-feedback` module that does not exist and
  a "~1.35" font-scale cap; `a11y/font-scale.ts:24` sets `MAX_FONT_SCALE = 2`.

## Goals / Non-Goals

**Goals**

- A control's disabled state cannot be erased by a caller.
- One name, one shape for the touch-target contract.
- The kit's documented surface equals its reachable surface.
- Documentation describes the shipped design generation and the real test
  coverage.

**Non-Goals**

- Memoizing the kit or restructuring render performance (recorded as a separate
  observation; it is a different problem with a different measurement need).
- Adopting Reanimated, or rewriting motion. This change removes an unused
  dependency; adopting the library is a separate, larger decision.
- Any visual redesign. The current design is correct; only its documentation is
  stale.
- Changing the touch-target *value* (44 dp is correct and already certified by
  device evidence).

## Decisions

**D1 — Destructure, then order the spread.** The fix for the merge is to make
the destructured prop absent from `rest` and to place the spread before the
computed value. Both halves are required: destructuring alone leaves the
caller's value absent but leaves the ordering latent; reordering alone leaves
the caller's value in `rest` to overwrite again at the first future edit.

**D2 — One canonical name, and make the shape unambiguous.** Keep the style
fragment as the canonical `MinTouchTarget` (it is the form that guarantees the
hit area matches the visible control, and it is the form the accessibility
module documents) and expose the number under an explicitly numeric name
(`MIN_TOUCH_TARGET`) that already exists in the same module. Migrate the 17
numeric call sites to `MIN_TOUCH_TARGET`, delete the duplicate theme export, and
add a catalog-contract test asserting the name resolves to exactly one
definition with exactly one shape.

**D3 — Delete, do not deprecate.** These components were superseded by
redesign campaigns that replaced the surfaces that used them and never deleted
the predecessors. A deprecation path keeps the barrels alive and keeps the
"import the wrong twin" hazard. Deleting is safe here because the reachability
census is mechanical and reproducible: the build is the check. Two are
reversible if a future surface needs them — `A11yDialog` and `LiveRegion` are
worth recording in the backlog with the removing commit rather than retaining
them for a hypothetical.

**D4 — Delete the unused native dependency rather than keep it "for later".**
`react-native-reanimated` pulls native code and JS into every build for zero
imports. Keeping an unused native runtime dependency is a standing cost with no
benefit, and it makes a stated architectural preference look true when it is
not. Remove it, and correct the architecture documentation to say what the code
actually does. If a future change adopts it, that change re-adds it
deliberately.

**D5 — Fix the documentation by regenerating it from tokens, not by hand.**
Two generations of drift accumulated because the document was edited by hand
while the tokens moved. Where the document states a concrete value, that value
SHALL be asserted against the token source by a test, so the next token change
fails loudly instead of silently re-diverging. This is the only durable fix;
rewriting the prose alone would restore the same failure in a few campaigns.

**D6 — Cover the documented primitives, then claim them.** `Confetti`,
`StateCard`, and `SectionGrid` have no suite while the design system document
claims reduced-motion behavior is "exercised by kit contract tests". Add the
suites for the primitives that are actually shipped and load-bearing, and delete
or narrow any documentation claim not backed by a test that would fail on
regression.

## Risks / Trade-offs

- **Fixing the accessibility merge changes existing rendered-tree assertions.**
  That is the point — those assertions currently encode the wrong behavior.
  → Mitigation: expect and justify diffs in
  `components/game-ui/__tests__/*.a11y.test.tsx` and the segmented-control and
  difficulty-selector suites; do not revert the primitive to satisfy them.
- **Deleting 8 components touches four barrels.**
  → Mitigation: barrels are grep-visible, so a leftover export breaks the
  build — the desired failure mode. `npm run typecheck` is the gate.
- **Removing the reanimated dependency could change native build output or
  startup.**
  → Mitigation: verify with a debug and a release build and the startup probes;
  the app never imported the package, so the expected delta is bundle size only.
- **Migrating 17 call sites to a renamed export is mechanical but broad.**
  → Mitigation: do it as one commit with a grep-based completeness check, and
  let typecheck prove no site was missed.
- **Correcting the design-system document may be read as a redesign.**
  → Mitigation: the change states explicitly that no token value changes; the
  document is corrected *to* the shipped tokens.

## Migration Plan

1. Fix the accessibility merge + regression test; run the a11y suites and
   justify each changed assertion.
2. Collapse the touch-target contract; migrate numeric call sites; add the
   single-definition test.
3. Delete the unreachable components, dead exports, orphaned tests, and barrel
   re-exports in one commit.
4. Remove the unused dependency; update the lockfile; verify a debug and a
   release build.
5. Correct `docs/DESIGN_SYSTEM.md` and `a11y.ts` documentation; add the
   token-assertion test; add the missing primitive suites.
6. Correct the architecture documentation's motion-library statement.
7. No data migration; no user-visible change. Rollback is a clean revert per
   step.

## Open Questions

None. Each defect has a single correct resolution and the deletions are
mechanically verifiable.
