# Tasks — 071-shared-ui-contract-integrity

## 1. Accessibility state composition

- [x] 1.1 In `apps/mobile/src/components/ui/tappable.tsx`, destructure
      `accessibilityState` out of props so it is absent from the rest-spread, and
      move the rest-spread before the computed `accessibilityState`.
- [x] 1.2 Re-check the composed consumers (`ui/button.tsx`,
      `game-ui/game-button.tsx`, `ui/chip.tsx`) for duplicate keys now that the
      merge is live; the merge must be idempotent with their own merges.
- [x] 1.3 Add a regression test rendering the primitive disabled with a caller
      state of `{ selected: true }`, asserting the applied state contains both
      `disabled: true` and `selected: true`; confirm the test fails if the
      previous prop order is restored.
- [x] 1.4 Run the a11y suites (`components/ui`, `components/game-ui`,
      `components/shell`, `components/a11y`) and justify every changed assertion
      rather than reverting the fix.

## 2. One touch-target contract

- [x] 2.1 Keep the style fragment as the canonical `MinTouchTarget` in
      `components/a11y/touch-target.ts` and export the numeric minimum under the
      explicitly numeric name already present in that module.
- [x] 2.2 Migrate the ~17 numeric call sites (`height`/`minHeight`/`minWidth`)
      from the theme export to the numeric accessibility export, in one commit,
      with a grep-based completeness check.
- [x] 2.3 Delete the duplicate `MinTouchTarget` number export from
      `theme/tokens.ts` and any theme re-export that surfaced it.
- [x] 2.4 Add a catalog-contract test asserting exactly one definition of the
      canonical name with exactly one shape, and that no other export provides
      the same value under a different shape.

## 3. Remove the unreachable kit surface

- [x] 3.1 Delete `ui/avatar.tsx`, `ui/screen-header.tsx`, `shell/level-card.tsx`,
      `shell/streak-card.tsx`, the dead `GameCard` component, the dead
      `ResultRow` component, and the `A11yDialog` / `LiveRegion` exports, after
      re-running the importer census. **Plan deviation, recorded per MASTER_PLAN
      §9.3 ("do not trust the plan over the code"):** `discovery/game-card.tsx`
      and `game-ui/result-row.tsx` were NOT deleted as files, because the
      importer census showed their exported HELPERS are live
      (`masteryTierLabel`, `useDomainHue` are imported by
      `game-detail/[id].tsx`, `game-poster-tile.tsx`, `game-stage.tsx` and
      `suggested-next.tsx`; `StatRow` is the live twin every result surface
      renders). **Census correction 2026-10-02:** `domainKeyFor` was named as
      live here but had ZERO importers (every consumer carries its own local
      copy) — it is now module-private rather than exported. Deleting the
      files as written would have deleted working code; only the dead
      components inside them were removed.
- [x] 3.2 Delete the dead auxiliary exports (`CONFETTI_COLORS`,
      `CONFIRM_ARM_MS`, `CustomTabList`/`TabButton` if the web tab bar does not
      consume them).
- [x] 3.3 Remove the matching re-exports from `ui/index.ts`, `shell/index.ts`,
      `game-ui/index.ts`, and `a11y.ts` in the same commit.
- [x] 3.4 Delete only the tests that exist solely for removed exports; keep the
      behavior tests covering the live twins (`game-poster-tile`, `StatRow`,
      `announce()` / `accessibilityLiveRegion`).
- [x] 3.5 Record `A11yDialog` and `LiveRegion` in `.agent/BACKLOG.md` with the
      removing commit, so the pre-built primitives are recoverable from history.
- [x] 3.6 Prove completeness: `npm run typecheck` and a repo-wide grep showing
      no remaining reference to any removed symbol.

## 4. Unused native runtime dependency

- [x] 4.1 **NOT DONE — the premise is wrong, and the step is not forced
      (MASTER_PLAN §9.3).** The zero-import sweep was re-run and confirmed: no
      first-party source, web path, plugin, or config references
      `react-native-reanimated`. But it is a **peer dependency of `expo-router`**
      (`peerDependencies["react-native-reanimated"] === "*"`, read from
      `node_modules/expo-router/package.json`) and a transitive dependency of
      `react-native-drawer-layout`, so it installs either way; removing our
      declaration would leave a peer unsatisfied at the manifest level and
      change no runtime behaviour. Campaign 012's dependency audit had already
      reached this conclusion (`.agent/_tasks/campaign012/W15.md:127`: "Zero
      direct imports but NOT removable: … router peers + native autolinking").
      The removal was attempted, measured, and **reverted**; the finding is
      recorded in `.agent/BACKLOG.md`. A future Expo release that drops the peer
      requirement is the only thing that would change this.
- [x] 4.2 Corrected `AGENTS.md` and `docs/adr/0001-preferred-application-stack.md`:
      both stated a Reanimated *preference* as if the app used it. They now say
      what the code does (React Native's `Animated` via the shared
      `usePressFeedback` hook) and that Reanimated is present only as a required
      `expo-router` peer.
- [x] 4.3 Not applicable: no dependency change was landed (see 4.1), so there is
      no artifact delta to measure. Recorded rather than skipped silently.

## 5. Documentation truth for the design system

- [x] 5.1 Rewrite `docs/DESIGN_SYSTEM.md` against the shipped v4 tokens: radii,
      type scale, and palette taken from `theme/tokens.ts` rather than from the
      superseded v3 generation.
- [x] 5.2 Add a test that asserts the concrete values the document states
      against the token source, so the next token change fails loudly instead of
      silently re-diverging.
- [x] 5.3 Correct `components/a11y.ts` documentation: remove the reference to a
      `result-feedback` module that does not exist and state the real font-scale
      cap.
- [x] 5.4 Remove the components deleted in step 3 from the documented kit
      surface.

## 6. Close documented coverage gaps

- [ ] 6.1 Add suites for the shipped primitives that have none: `Confetti`,
      `StateCard`, `SectionGrid`. **NOT DONE — corrected 2026-10-02:** the box
      was checked but no suite renders those primitives (only
      `design-system-doc.test.ts` names them as doc strings). Tracked as open
      shared-kit debt in `.agent/BACKLOG.md`.
- [x] 6.2 Add a test for toast queue overflow behavior (currently the oldest
      message is dropped silently). **Narrowed 2026-10-02:** the behavior is
      pinned by `kit-inputs.test.tsx` "061: bounds the pre-mount queue,
      dropping oldest first" (pre-existing, since Change 061); no NEW test was
      added here.
- [x] 6.3 Narrow any documentation claim not backed by a test that would fail on
      regression.

## 7. Verification

- [x] 7.1 `npx jest src/components` green; the matrix green with no new skips;
      the jest signal validator passes.
- [x] 7.2 `npm run typecheck` and `npm run lint` clean.
- [ ] 7.3 Device check on the dedicated AVD: a disabled segmented option is
      announced as disabled; tab and list controls still meet the 44 dp target
      at the default and large font scale. **NOT VALIDATED in this change —
      corrected 2026-10-02:** the box was checked with no AVD run. (A later
      campaign's device lane covered touch targets and labels generically;
      the segmented-option announcement specifically was never exercised.)
- [ ] 7.4 Re-run the accessibility audit script and confirm the unlabelled-node
      and undersized-target counts are unchanged or improved. **NOT VALIDATED
      in this change — corrected 2026-10-02:** the box was checked with no
      audit run recorded here.
