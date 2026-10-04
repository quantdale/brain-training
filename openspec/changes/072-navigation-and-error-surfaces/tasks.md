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

- [x] 4.1 Every `router.push`/`router.replace` call site audited and classified
      against ONE shared set (`TOP_LEVEL_HREFS` in `components/navigation-depth.ts`)
      rather than a per-screen judgement. Top-level = the five tabs plus `/`,
      `/results` and `/data-management`. Nested = `game/[id]`, `game-detail/[id]`
      and the four `progress-*` detail routes, which keep pushing.
- [x] 4.2 14 top-level call sites converted to `router.replace` across 7 files
      (`(tabs)/index`, `(tabs)/profile`, `(tabs)/progress`, `progress-activity`,
      `progress-domain`, `results`, `mastery-card`), plus 2 found later by the new
      guard (`results.tsx` push("/") and `rewards.tsx` push("/(tabs)/profile")).
      Nested destinations still push. Zero top-level pushes remain.
- [x] 4.3 Data Management gained `data-management-back`, a `BackLink` labelled
      "Profile" and falling back to `/profile` — the screen's only owning
      destination, and the right cold-deep-link landing.
- [x] 4.4 `game-detail/[id]` is pushed from Games, Progress AND Home, yet its
      affordance announced "Back to Games" on every path. New
      `useSafeBackAffordance` resolves the label from the same fact the fallback
      already depends on: with history it says "Back" (accurate on any entry
      path), and without one it names the fallback it will actually use. The
      42-screen `useSafeBack` call sites are untouched.
- [x] 4.5 `navigation-contract.test.ts` (7 cases) pins the classification and
      the two conversions as a source contract, including that a tap destination
      pushed (not replaced) is an offence. **Mutation proof:** reverting the
      `results.tsx` conversion fails the guard, and injecting a whitespace-
      obfuscated `router . back ()` into a NEW file under `src/app` is caught —
      the exact case the old `src/games`-only guard could not see.
      Runtime stack-depth behaviour on device is §7.4 (NOT VALIDATED).

## 5. Widen the regression guard

- [x] 5.1 Replaced with `navigation-contract.test.ts`, which scans EVERY `.ts`/`.tsx`
      under `src` (606 files) rather than the 42 game screens, and additionally
      enforces the §4 top-level-replacement rule. The original game-scoped guard
      is retained inside it rather than deleted, with a self-test asserting the
      42 screens are still covered — a scope change that accidentally dropped
      `games/` would otherwise narrow coverage silently.
- [x] 5.2 Four bypass-resistant patterns (`router . back (`, `router?.back(`,
      `router['back'](`, `navigation.goBack()`, `useNavigation().goBack()`) plus
      comment stripping, so the guard no longer fails on its own prose. The
      bypass-resistance claim is itself tested against every spelling it claims
      to catch.
- [x] 5.3 The widened guard found 2 real violations on first run (both fixed) and
      3 false positives, which were bugs IN the guard (a path-normalization
      mismatch that defeated the allowlist, and two files failing on their own
      documentation) — fixed in the guard rather than by adding exemptions. The
      single remaining exemption is the `useSafeBack` implementation itself,
      named in a `Set` with a comment explaining why it is the one legal site.

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

- [x] 7.1 `src/app`, `src/hooks`, `src/__tests__` green; full matrix **602
      passed + 4 skipped suites / 7,069 passed + 5 skipped tests / 5 snapshots,
      0 failures**; signal validator `pass: true` (5 classified skips, 0
      unclassified/ambiguous/mismatched, both floors met). **No new skips.**
- [x] 7.2 `npm run typecheck` clean; `npm run lint` clean (0 errors, 0 warnings).
- [x] 7.3 **Device lane closed 2026-10-04 — PASS (Data Management) /
      PARTIAL (Profile),** evidence
      `docs/redesign/evidence/change070-074-device/DEVICE_LANE_CLOSURE.md`.
      On the dedicated AVD, a genuinely-throwing backups read (directory
      replaced by a file) rendered `data-saved-backups-error` ("Could not read
      your saved backups.") WITH a retry control, the stranded section's own
      failure + retry, and NO empty state; counts stayed loaded (per-section
      isolation); tapping Retry after restoring the directory recovered the
      listing live. Measured boundary: POSIX chmod-000 denial is swallowed by
      the platform library (`listAsRecords` → empty, not a throw), so the
      deny-access example yields the truthful-as-known empty state on this
      stack. **Profile half PARTIAL (device):** Profile's read chain shares the
      db with the foundational bootstrap progression stage, so no device fault
      fails Profile's read while keeping the normal shell; its failure-state
      rendering remains unit-pinned, the shared seam's failure/retry mechanics
      were device-proven on Data Management.
- [x] 7.4 **Device lane closed 2026-10-04 — PASS.** Three Home → game-detail →
      Home cycles on the dedicated AVD (each verified by hierarchy), then the
      system back gesture from Home moved focus to the launcher — the user
      leaves Home; refocus lands on Home, never re-entering the detail screen.
      Evidence: `DEVICE_LANE_CLOSURE.md` §072 §7.4.
- [x] 7.5 **Device lane closed 2026-10-04 — PASS.** After a standalone game's
      result surface persisted, the Progress tab rendered the new session on
      first focus ("3 sessions across 3 active days"; pre-journey 2) — the
      input-aware focus gate refreshed instead of serving the stale window.
      Evidence: `DEVICE_LANE_CLOSURE.md` §072 §7.5.
