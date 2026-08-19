# Known Issues / Blockers

## Current blockers

- **AVD/emulator validation gap (NOT VALIDATED, environment blocker)**: this
  Windows host has no bootable Android emulator/AVD, so the emulator-gated
  exit-gate tasks cannot run here — `3.6` (Word Match emulator smoke), `6.8`
  (Daily Workout AVD journey), `12.4`, `12.7`, `12.9` (One-AVD smoke /
  journeys). Recorded as NOT VALIDATED (never faked green); requires an AVD
  session / CI emulator runner. This is a validation gap, not a product
  defect.
- **12.11 CI confirmation pending**: GitHub App CI + Repository Integrity auto-run
  on push to `main`; their result is only observable from the GitHub Actions UI.

## Open debt (tracked, non-blocking)

- **Shared game UI primitives — full catalog migrated (RESOLVED, 2026-08-20)**: all 20 games now use `apps/mobile/src/components/game-ui/*` (GameButton, PauseOverlay, TutorialFrame, QaPanelShell with `extraActions`, ResultRow/StatRow, SessionHeader, DifficultySelector) with tsc clean, lint clean, and Jest 190 suites / 2272 tests green. No per-module `GameButton`/`StatRow` copies remain. This closes the 10.2/10.3 convergence; recorded in `VALIDATION.md` (Wave: 006R 10.3 — full 20-game game-ui convergence).
- **Pattern Tap Back true path mechanics (Low, task 10.6 follow-up)**: the game
  is a distinct-span variant (not an adjacency-constrained path); its docs were
  corrected to match. Closure criterion: if a true adjacent-path generator is
  wanted, implement it deterministically and pass its generator tests.
- **iOS build unverifiable on this host (NOT VALIDATED)**: Windows host has
  no Xcode/macOS, so `expo run:ios`-equivalent cannot run. Static audit
  PASS (see VALIDATION.md). A macOS host/CI runner is required for the real
  build; not a product defect.
- **Settings sensory feedback seam deferred (Low, task 10.4 classified)**: the
  production audio/haptics service is a documented no-op; sfx/music/haptics
  toggles are in-memory prefs (not persisted, no real sound/vibration wired).
  Parity matrix and `docs/DEFERRED_DECISIONS.md` now state this honestly
  (previously the matrix claimed IMPLEMENTED). Theme selection IS persisted.
- **Achievements sync scope (Low)**: quest/achievement evaluation scans up
  to 5000 recent sessions (`SYNC_SESSION_SCAN_LIMIT`); far above realistic
  foundations-phase history, but a documented cap.
- **NativeTabs snapshot instability (tooling)**: router-tree snapshots
  contain per-render random `screenId`s; visual baselines render bare
  routes to stay deterministic (see visual-baselines test header).

## Resolved during 006R

- **REROLL-ATTEMPTS-NOT-PERSISTED (Low)**: daily workout reroll attempts are
  now persisted per date in `workout_instances.reroll_attempt`; the Workout
  repository applies rerolls transactionally and restart does not restore the
  free reroll (tasks 6.1/6.5/7.4).
- **CLAIMED-BUT-UNREWARDED WINDOW (Low)**: quest/achievement claims are now
  atomic/idempotent with a shared operation id — claimed marker and all
  XP/currency rewards commit together and roll back on failure (task 7.3).
- **3 inherited test failures (blocking full-Jest green)**: repaired as stale
  tests — content registry item-count pin (72→120) and two game tutorial tests
  that did not drive the current 3-step tutorial. Suite is now fully green.
- **Sensory toggles falsely marked IMPLEMENTED**: parity matrix corrected to
  DEFERRED (see open debt above / task 10.4).

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
