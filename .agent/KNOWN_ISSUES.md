# Known Issues / Blockers

## Current blockers

None. Campaign 003 complete; §32 gate PASS; campaign 004 staged.

## Open debt (tracked, non-blocking)

- **iOS build unverifiable on this host (NOT VALIDATED)**: Windows host has
  no Xcode/macOS, so `expo run:ios`-equivalent cannot run. Static audit
  PASS (see VALIDATION.md). A macOS host/CI runner is required for the real
  build; not a product defect.
- **REROLL-ATTEMPTS-NOT-PERSISTED (Low)**: Home's `rerollAttempt` resets on
  app restart (daily reroll budget is in-memory only). Constitution §14
  economics still enforced within a session; persistence (per-date
  attemptsUsed) is a later-wave improvement.
- **Settings sensory toggles in-memory (Low, pre-existing)**: SFX/music/
  haptics toggles reset on restart; profile `settings_json` exists but the
  provider is not wired to it. Theme selection IS persisted (separate path).
- **CLAIMED-BUT-UNREWARDED WINDOW (Low, documented)**: quest/achievement
  claim is the once-only commit point; a crash between claim and the XP
  award + ledger append leaves claimed-but-unrewarded (never double
  reward). Detectable via `claimedAt` vs `xp_awards`; auto-heal is future
  work.
- **Achievements sync scope (Low)**: quest/achievement evaluation scans up
  to 5000 recent sessions (`SYNC_SESSION_SCAN_LIMIT`); far above realistic
  foundations-phase history, but a documented cap.
- **NativeTabs snapshot instability (tooling)**: router-tree snapshots
  contain per-render random `screenId`s; visual baselines render bare
  routes to stay deterministic (see visual-baselines test header).

## Resolved during Campaign 003

- None beyond the above debt (no Critical/High findings).

## Resolved during Campaign 002

- **STALE-DB-SCREENS (Medium, fixed `0a16f68`)**: game-detail/results/Progress/
  Games rendered stale data after returning to an already-mounted screen
  (React Navigation keeps screens mounted; no refetch on focus). Fixed with
  `useFocusEffect`-driven refresh keys in `useDbData` consumers + optimistic
  favorite override. Re-verified on-device.
- **Typed-routes local staleness**: `.expo/types/router.d.ts` is generated
  only by `expo start` (not `expo export`); a stale local copy rejected new
  routes in `tsc`. `.expo/` is gitignored and CI typechecks without the file
  (loose href typing, consistent with CI). If a dev runs `expo start`, the
  file regenerates with correct routes and everything still typechecks.

## Resolved during Campaign 001

- **GAME-ROUTE-TRAPPED-IN-NATIVETABS (High, fixed `d380699`)**: `/game/[id]`
  was unreachable from taps and deep links because the route lived inside the
  NativeTabs navigator, which only handles declared triggers. Fixed by moving
  tab screens into `app/(tabs)/` and making the root layout a Stack. Verified
  on-device; add a shell test covering route reachability when the router
  testing library supports it.
- `@types/jest` gap: wave-0 typecheck failure fixed in wave-1 convergence.
- Registry generator dropped the game `id` (fixed wave 2).
- Root README had a UTF-16 tail (fixed wave 0); remote history also fixed it.
