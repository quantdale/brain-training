# Known Issues / Blockers

## Current blockers

- **AVD/emulator validation — partially validated this session, remainder still blocked**: the `no AVD` was an environment gap; this wave provisioned `CRBABot_API_36` (API 36 x86_64 `-no-window`, Metro `packager-status:running`, `adb reverse tcp:8081`) and proved Home `testID`s + deep-linked `Memory`/`Tap Rush` `testID`s and session drive (see `VALIDATION.md` AVD hardening wave). Still `NOT VALIDATED` for the persistence/journey gates that require a full run: `3.6` (Word Match emulator smoke), `6.8` (Daily Workout AVD 4/4 + restart/resume), `12.4` (One-AVD per-game start/pause/finish/persist), `12.7`, `12.9` (One-AVD smoke canaries + targeted journeys). Recorded as NOT VALIDATED (never faked green); AVD is live for the next hardening slice. Not a product defect.
- **12.11 CI confirmation pending**: GitHub App CI + Repository Integrity auto-run
  on push to `main`; their result is only observable from the GitHub Actions UI.
- **Host NDK toolchain pinned per-host (SDK patch, reversible)**: the app NDK pin `27.0.12077973` lives in generated `android/gradle.properties` (`.gitignored` under `android/`, so not pushed — survives `prebuild --clean` but per-host). The SDK-side `27.1.12297006` fix (`android-legacy.toolchain.cmake` `c++_shared` + `-lstdc++`) is likewise a per-host reversible block with `BUILD SUCCESSFUL` evidence — not a blind forced upgrade; see open debt below and `VALIDATION.md`.

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
- **Host NDK / provenance-allowlist / warning-class handling (Low, 006R)**: the SDK NDK pinned `27.1.12297006 → 27.0.12077973` and the `android-legacy.toolchain.cmake` `c++_shared`/`-lstdc++` patch are warning-class fixes (same-target-toolchain `lld` mismatch evidence in `VALIDATION.md`) — no blind forced major upgrade, documented with reversible block + artifact path and `BUILD SUCCESSFUL 484 tasks` witness. Provenance validator allowlist (`.agent/provenance-allowlist.json`) is for non-semantic edits (comments/formatting) only; real generator/content changes still require `gameVersion`/`generatorVersion` bumps. The 187 `src/games` `eslint` unused-var/`import/no-duplicates` warnings stay as warnings (out of scope) — catalog is `0 errors` via the `6f75d09` JSX-entity + `memory-sequence-memory` state-driven label fix (no `eslint-disable` to hide it); deterministic replay snapshots cover the procedural/hybrid contract, `scripts/validate-provenance.mjs --check` is wired as a CI warning, not a fake green. XP/rating is clamped/verified by pipeline tests.

## Resolved during 006R

- **WORKOUT-ADVANCE-UNWIRED (High, resolved 006R hardening wave)**: the durable
  daily workout's `WorkoutRepository.advance()` was implemented and unit-tested
  (task 6.2/6.3) but no screen ever invoked it, so on-device `current_index`
  stayed at 0, `home-workout-game-*` rows never marked current/completed, and
  kill/relaunch always resumed at game 1. Fixed by wiring `useWorkoutResultAdvance`
  into `results.tsx` (advances a freshly-completed current-game session exactly
  once, idempotent via the `completedAt > updatedAt` guard in `shouldAdvanceWorkout`),
  adding `Next Game` / `Workout complete` CTAs, and reflecting progress on Home
  via a router-free workout-change event (`@/workout/events`). Covered by
  `src/workout/__tests__/advance.test.ts` (guard + real `WorkoutRepository`). The
  4/4 AVD journey (6.8) is still NOT VALIDATED pending the on-device probe.
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
