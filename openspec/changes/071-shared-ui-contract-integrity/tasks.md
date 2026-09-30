# Tasks — 071-shared-ui-contract-integrity

## 1. Accessibility state composition

- [ ] 1.1 In `apps/mobile/src/components/ui/tappable.tsx`, destructure
      `accessibilityState` out of props so it is absent from the rest-spread, and
      move the rest-spread before the computed `accessibilityState`.
- [ ] 1.2 Re-check the composed consumers (`ui/button.tsx`,
      `game-ui/game-button.tsx`, `ui/chip.tsx`) for duplicate keys now that the
      merge is live; the merge must be idempotent with their own merges.
- [ ] 1.3 Add a regression test rendering the primitive disabled with a caller
      state of `{ selected: true }`, asserting the applied state contains both
      `disabled: true` and `selected: true`; confirm the test fails if the
      previous prop order is restored.
- [ ] 1.4 Run the a11y suites (`components/ui`, `components/game-ui`,
      `components/shell`, `components/a11y`) and justify every changed assertion
      rather than reverting the fix.

## 2. One touch-target contract

- [ ] 2.1 Keep the style fragment as the canonical `MinTouchTarget` in
      `components/a11y/touch-target.ts` and export the numeric minimum under the
      explicitly numeric name already present in that module.
- [ ] 2.2 Migrate the ~17 numeric call sites (`height`/`minHeight`/`minWidth`)
      from the theme export to the numeric accessibility export, in one commit,
      with a grep-based completeness check.
- [ ] 2.3 Delete the duplicate `MinTouchTarget` number export from
      `theme/tokens.ts` and any theme re-export that surfaced it.
- [ ] 2.4 Add a catalog-contract test asserting exactly one definition of the
      canonical name with exactly one shape, and that no other export provides
      the same value under a different shape.

## 3. Remove the unreachable kit surface

- [ ] 3.1 Delete `ui/avatar.tsx`, `ui/screen-header.tsx`, `shell/level-card.tsx`,
      `shell/streak-card.tsx`, `discovery/game-card.tsx`, `game-ui/result-row.tsx`,
      and the `A11yDialog` / `LiveRegion` exports, after re-running the importer
      census to confirm each still has zero product importers.
- [ ] 3.2 Delete the dead auxiliary exports (`CONFETTI_COLORS`,
      `CONFIRM_ARM_MS`, `CustomTabList`/`TabButton` if the web tab bar does not
      consume them).
- [ ] 3.3 Remove the matching re-exports from `ui/index.ts`, `shell/index.ts`,
      `game-ui/index.ts`, and `a11y.ts` in the same commit.
- [ ] 3.4 Delete only the tests that exist solely for removed exports; keep the
      behavior tests covering the live twins (`game-poster-tile`, `StatRow`,
      `announce()` / `accessibilityLiveRegion`).
- [ ] 3.5 Record `A11yDialog` and `LiveRegion` in `.agent/BACKLOG.md` with the
      removing commit, so the pre-built primitives are recoverable from history.
- [ ] 3.6 Prove completeness: `npm run typecheck` and a repo-wide grep showing
      no remaining reference to any removed symbol.

## 4. Unused native runtime dependency

- [ ] 4.1 Confirm once more that nothing imports `react-native-reanimated`
      (including web and plugin paths), then remove it from
      `apps/mobile/package.json` and refresh the lockfile.
- [ ] 4.2 Correct the architecture/design documentation statement that prefers
      Reanimated so it states what the code actually does (legacy `Animated`).
- [ ] 4.3 Build a debug and a release artifact and confirm the only expected
      delta is bundle/native size, with no build or startup regression.

## 5. Documentation truth for the design system

- [ ] 5.1 Rewrite `docs/DESIGN_SYSTEM.md` against the shipped v4 tokens: radii,
      type scale, and palette taken from `theme/tokens.ts` rather than from the
      superseded v3 generation.
- [ ] 5.2 Add a test that asserts the concrete values the document states
      against the token source, so the next token change fails loudly instead of
      silently re-diverging.
- [ ] 5.3 Correct `components/a11y.ts` documentation: remove the reference to a
      `result-feedback` module that does not exist and state the real font-scale
      cap.
- [ ] 5.4 Remove the components deleted in step 3 from the documented kit
      surface.

## 6. Close documented coverage gaps

- [ ] 6.1 Add suites for the shipped primitives that have none: `Confetti`,
      `StateCard`, `SectionGrid`.
- [ ] 6.2 Add a test for toast queue overflow behavior (currently the oldest
      message is dropped silently).
- [ ] 6.3 Narrow any documentation claim not backed by a test that would fail on
      regression.

## 7. Verification

- [ ] 7.1 `npx jest src/components` green; the matrix green with no new skips;
      the jest signal validator passes.
- [ ] 7.2 `npm run typecheck` and `npm run lint` clean.
- [ ] 7.3 Device check on the dedicated AVD: a disabled segmented option is
      announced as disabled; tab and list controls still meet the 44 dp target
      at the default and large font scale.
- [ ] 7.4 Re-run the accessibility audit script and confirm the unlabelled-node
      and undersized-target counts are unchanged or improved.
