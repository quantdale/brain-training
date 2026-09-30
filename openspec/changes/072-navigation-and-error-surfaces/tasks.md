# Tasks — 072-navigation-and-error-surfaces

## 1. Data-access seam reports failure

- [x] 1.1 Widen `apps/mobile/src/hooks/use-db-data.ts` so it reports loading,
      success, success-with-no-records, and failure distinctly; a failed read
      SHALL NOT be reported as `loaded: true` with a zeroed fallback.
- [x] 1.2 Preserve the generation guard so a stale read cannot overwrite a newer
      one, and add a test for that case alongside the new states.
- [x] 1.3 Log the failure with enough context to diagnose it in production.
- [x] 1.4 Keep the return shape additive so existing consumers continue to work.

## 2. Honest states on Data Management

- [x] 2.1 Render a distinct loading state while the backup/inventory read is in
      progress; do not render "no backups yet" during load.
- [x] 2.2 Render an explicit failure state on a failed read, with a retry
      affordance, and make it visually distinct from the empty state.
- [x] 2.3 Add tests: loading, failure, empty, and loaded each render differently;
      the empty-state message is absent on failure.

## 3. Honest states on Profile

- [x] 3.1 Add a loading state to Profile so its zeroed fallback is not painted
      while data loads; reuse the shell loading primitive Home already uses.
- [x] 3.2 Render an explicit failure state for failed reads, with retry.
- [x] 3.3 Add tests for loading, failure, and loaded rendering.

## 4. Navigation depth correctness

- [ ] 4.1 Audit every `router.push` call site and classify the destination as
      top-level (tab/root) or nested (detail/flow).
- [ ] 4.2 Convert top-level destinations to the stack-replacing operation;
      leave nested destinations pushing.
- [ ] 4.3 Add a back affordance to Data Management that lands on its owning
      destination, consistent with the six sibling routes that already have one.
- [ ] 4.4 Correct game detail's announced back destination so it names where
      back actually goes on every entry path, instead of naming one destination
      that only some paths reach.
- [ ] 4.5 Add tests: repeated tab visits do not grow the stack; back from a tab
      leaves the tab; back from a detail screen returns to its list; the guard
      detects the unsafe pattern in a route module outside the previously
      scanned directory.

## 5. Widen the regression guard

- [ ] 5.1 Extend `safe-back-catalog.test.ts` to scan every source location that
      can perform navigation, not only `src/games`, so a new route module is
      covered automatically.
- [ ] 5.2 Make the negative pattern match bypass-resistant (a bare back call
      written with different spacing or import form must still be detected).
- [ ] 5.3 Fix everything the widened guard finds, or annotate deliberate
      exceptions with a justifying comment.

## 6. Progress refresh consistency

- [x] 6.1 Progress's focus throttle now consults the newest-session fingerprint
      from the existing `progression/focus-sync` helpers
      (`progressionInputFingerprint` / `readNewestProgressionInput`), so a
      changed input always forces a reload. The 5s window still suppresses
      redundant re-materialization when nothing changed. The fingerprint is
      captured when a load COMPLETES (the focus handler cannot read it
      synchronously), and a focus handler that cannot read the db falls back to
      the pure-time window rather than throwing — a focus handler that throws
      takes the route down with it.
- [x] 6.2 Added 4 cases to `progress-focus-throttle.test.ts`: a new session
      inside the window forces a reload; an unchanged input still bounces
      cheaply; a DISAPPEARED fingerprint counts as a change (a backup replace can
      remove the newest session, and ignoring that would show a session the user
      no longer has); and the first-load/post-window behavior is unchanged.
      **Mutation proof:** reverting the predicate to pure-time fails 2 of the 6.

## 7. Verification

- [ ] 7.1 `npx jest src/app src/hooks src/__tests__` green; the full matrix
      green with no new skips; the jest signal validator passes.
- [ ] 7.2 `npm run typecheck` and `npm run lint` clean.
- [ ] 7.3 **NOT VALIDATED — device lane not available in this session.** On the
      dedicated AVD: force a failed read (for example by denying access) and
      confirm the failure state renders with retry on Data Management and
      Profile; confirm the empty state no longer appears for a failure. The four
      states are pinned by unit/screen tests; the on-device confirmation is not
      made.
- [ ] 7.4 On the dedicated AVD: visit Home → detail → Home three times, press
      back, and confirm the user leaves Home rather than re-entering the detail
      screen.
- [ ] 7.5 Confirm a mutation made on the results screen is reflected on the
      Progress tab without waiting for a time window.
