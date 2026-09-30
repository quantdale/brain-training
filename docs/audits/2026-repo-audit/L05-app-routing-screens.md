# Lane L05 — Routing, navigation, deep links, screens

**Lane ID prefix:** L05 · **Audit tree:** `main` @ `2a765cc` · **Status:** COMPLETE (read-only audit)

## Scope covered
- Deeply inspected: `apps/mobile/src/app/**` (39 files, 15 213 lines; 13 non-test route modules +
  11 route test files), `apps/mobile/src/routing/route-params.ts` (single module, 176 lines),
  `apps/mobile/src/components/ui/back-link.tsx` (`useSafeBack` / `backOrFallback`),
  `apps/mobile/src/__tests__/safe-back-catalog.test.ts` (catalog guard),
  `apps/mobile/src/components/game-host/game-host.tsx` (hardware-back intercept),
  `apps/mobile/src/components/a11y/dialog.tsx` + `apps/mobile/src/components/a11y.ts`,
  `apps/mobile/src/components/game-ui/pause-overlay.tsx`,
  `apps/mobile/src/hooks/use-db-data.ts`, `apps/mobile/src/workout/session-provenance.ts`,
  `apps/mobile/src/workout/session-advance.ts`, `apps/mobile/src/db/workout.ts` (read-only trace),
  `apps/mobile/src/progression/focus-sync.ts`, `apps/mobile/src/app/data-management.tsx`
  (wipe path), `apps/mobile/app.json` (scheme + `predictiveBackGestureEnabled`).
- Structurally inspected: all 42 `apps/mobile/src/games/*/screen.tsx` (grep: `useSafeBack`,
  `interceptBack`, `inSession` phase predicates — no file reads), all 8 app-level pushed routes
  (grep: `useFocusEffect`, `refreshKey`, `useDbData`, `loaded`/`error` render branches,
  `router.*`), `src/app/**` grep for `router.back` / `goBack` / `BackHandler` / `useEffect`
  dependency arrays.
- Diagnostics run (all read-only, no repo mutation):
  - `find apps/mobile/src/app -type f | xargs wc -l | sort -rn` → largest files confirmed below.
  - `git grep -n "safeBack"` → 8 app routes + 42 game screens; definition at `back-link.tsx:44`.
  - `git grep -n "router.back\|\.goBack(" -- 'apps/mobile/src/app/**'` → 1 hit, test-only
    (`app/__tests__/app-shell.test.tsx:178`); **no production bare back remains**.
  - `git grep -n "eslint-disable" -- src/app src/hooks src/routing` → exactly the 3 sites the
    brief listed, no others in these three trees.
  - `git grep -n "A11yDialog"` (repo-wide) → 1 production export + 1 test file, 0 production uses.
  - `for d in games/*; do grep -q interceptBack= ...` → 42/42 game screens pass `interceptBack`.
  - `git grep -n "useDbData(" -- src/app` → 12 production call sites, all classified.
- Intentionally excluded: `src/components/**` breadth (other lanes), the 42 game engines'
  scoring/state machines beyond their route-exit contract, `openspec/**` prose, any runtime /
  emulator validation (host-interaction prohibition), iOS-specific navigation behaviour.

## Flow map
- **Route tree:** `app/_layout.tsx` → `Stack screenOptions={{ headerShown: false }}` with
  `(tabs)` (`components/app-tabs`), `game/[id]`, `game-detail/[id]`, `results`,
  `progress-detail`, `progress-activity`, `progress-domain`, `progress-game`, `rewards`,
  `data-management`; non-route modules `bootstrap-recovery` / `storage-unavailable` are rendered
  as full-screen substitutes from `_layout.tsx` when bootstrap fails.
- **Deep link ingress:** `app.json` `scheme: "braintraining"` (typed routes + React Compiler
  enabled) → expo-router parses query → route module → `@/routing/route-params` envelope
  (`parseCanonicalGameId` / `parseRegisteredGameId` / `parseCanonicalInstanceKey` /
  `parseBoundedLegIndex` / `parseCanonicalDomain` / `parseCanonicalSessionId`) →
  registry lookup or DB lookup → recoverable empty/not-found UI.
- **Workout ownership path:** `game/[id]?workoutKey=…&workoutIndex=…` → `parseWorkoutLaunchProvenance`
  (`session-provenance.ts:141`) → `registerWorkoutSessionLaunch` (`use-game-session.ts:169`) →
  `completeSession` decorates `rawResult.workoutProvenance` (`db/sessions.ts:379-395`) →
  results/`useWorkoutResultAdvance` → `advanceWorkoutForSession` (`workout/session-advance.ts:90`)
  → `db.workouts.findActiveInstanceForSession` → `advanceForSession`.
- **Exit path:** every game screen → `useSafeBack('/games')` (`back-link.tsx:44`, `backOrFallback`
  → `router.back()` when `canGoBack()` else `router.replace(fallbackHref)`); app-level pushed
  routes → `BackLink` + `useSafeBack(<owning tab>)`.
- **Focus/refresh path:** `useFocusEffect` → `setRefreshKey(k+1)` → `useDbData(load, [refreshKey…])`
  with monotonic `seqRef` supersession; three throttles exist (progress 5 s time-only,
  progression focus-sync 5 s + input fingerprint, rewards remount-on-visit).

### Check-by-check answers (L05)
1. **useSafeBack coverage** — 42/42 game screens use `useSafeBack('/games')` and are guarded by
   `src/__tests__/safe-back-catalog.test.ts`. 6 of the 8 app-level pushed routes use it
   (`results`, `game-detail/[id]`, `progress-detail`, `progress-activity`, `progress-domain`,
   `progress-game`). **No bare `router.back()` survives in production code.** The remaining two
   pushed routes (`rewards`, `data-management`) have no back affordance at all → L05-F02/L05-F04.
   The catalog guard does **not** cover app-level routes → L05-F05.
2. **Deep-link envelope** — `routing/route-params.ts` enforces non-empty + `<= 128` length before
   any regex; canonical ASCII forms; `parseRegisteredGameId` additionally requires registry
   membership; `parseCanonicalDomain` requires the `isGameCategory` enum; `parseBoundedLegIndex`
   requires ASCII digits, `Number.isSafeInteger`, `0..MAX_ROUTE_LEG_INDEX(5)`; arrays coerce to
   `[0]`; unknown query keys are simply never read (there is no unknown-key rejection, and none is
   needed because each consumer reads a fixed key set). **The only state-changing UI an
   unauthenticated link can reach is playing a game** — see "Checked and found clean" #5 for the
   concrete path and the provenance bound that stops link-forged workout ownership.
3. **Data-driven screens lacking state** — `data-management.tsx` has **no error state** for either
   of its two `useDbData` reads (sources: `countLocalData(getDb())` and the backup transport
   listing) → L05-F01. `(tabs)/profile.tsx` has an error state but **no loading state** (data
   source `loadProfile`) → L05-F03. All other data screens (Home, Progress, Rewards, Results,
   game-detail, progress-*) render loading + error + empty.
4. **Stale data on focus** — Home/Profile/Progress/game-detail/progress-*/results all bump
   `refreshKey` on focus; `rewards` relies on remount-per-visit (documented in
   `progression/focus-sync.ts`); `data-management` has no outbound navigation, so its missing
   focus effect is inert. The one reachable staleness is the Progress tab's **time-only** 5 s
   throttle → L05-F06.
5. **Effect correctness** — the three `eslint-disable` sites are all **justified** (see "Checked
   and found clean" #7). App-level screens use effects sparingly: `rewards.tsx:240`
   (`useEffect(() => disarmBuy, [disarmBuy])` — timer cleanup), `results.tsx:214` (personal-best
   celebration, deps `[showPersonalBest, session]`, writes only to a module-level `Set` and the
   sensory service) and `results.tsx:229` (workout-advance failure toast, deduped by
   `advanceErrorShownRef`) — no stale-closure or setState-in-effect defects found. React Compiler
   (`app.json` `experiments.reactCompiler: true`) additionally memoizes these.
6. **Android back** — all 42 game screens pass `interceptBack={inSession}`; `game-host.tsx:171-183`
   consumes hardware back in both states (first press pauses; while paused the press is swallowed,
   so exit only through the overlay's explicit Resume/Quit — documented audit-B6 intent). The
   pause surface is an opaque overlay, not a navigator modal; there is no RN `Modal` in the app and
   `predictiveBackGestureEnabled: false` in `app.json`.
7. **Oversized screens** — see L05-F07 table.

## Findings

### L05-F01 — Data Management renders a zeroed inventory and "no backups yet" when its reads fail; it has no error state
- Severity: P2
- Confidence: confirmed
- Category: correctness | frontend | data-integrity
- Files: `apps/mobile/src/app/data-management.tsx:101-106` (`loadCounts`), `:152-157` (backup list),
  `:455-460` (`!countsLoaded` skeleton), `:612-620` (empty-backups state),
  `apps/mobile/src/hooks/use-db-data.ts:20-27, 66-77` (the contract that a failed read still sets
  `loaded = true`).
- Evidence:
  ```ts
  // data-management.tsx:101 (error is never destructured)
  const { data: counts, loaded: countsLoaded } = useDbData(loadCounts, [refreshKey], EMPTY_COUNTS);
  // data-management.tsx:152
  const { data: savedBackups, loaded: backupsLoaded } = useDbData(…, [refreshKey], []);
  ```
  and the hook's documented failure behaviour (`use-db-data.ts:20-27`): *"in that case `loaded`
  becomes true with `data` at its fallback and `error` set, so screens render a graceful empty
  state instead of crashing"*. Every sibling screen consumes the error branch
  (`progress.tsx:457`, `rewards.tsx:462`, `results.tsx:301`, `game-detail/[id].tsx:310`,
  `profile.tsx:591`); `data-management.tsx` is the only one that does not.
- Problem: when `countLocalData()` (the `Local database` card, `:455`) or the backup listing
  (`:612`) rejects, the screen paints `EMPTY_COUNTS` (all zeros, `hasProfile: false`) as if it were
  measured data and shows the designed "no saved backups" empty state. The same holds for a
  partial failure: `hasInitializedLocalState === false` renders the "Empty" summary alongside real
  table counts (`:107-125` comment acknowledges only the PRAGMA-metadata case, not a rejected read).
- Why it matters: this is the screen a user opens to decide whether to export, import-replace or
  **wipe**. A transient read failure is presented as "you have no data / no backups", which is the
  strongest possible prompt to restore-or-wipe, and it also hides a failing store that the other
  screens would have surfaced with a retry.
- Root cause: the screen adopted `useDbData` for its loading skeleton but only destructured
  `data`/`loaded`, dropping the `error` half of the hook contract.
- Recommended solution: mirror the sibling idiom — destructure `error`/`errorBackups`, render the
  shared `StateCard variant="error"` with a "Try again" action calling `refresh()` before the
  counts/backups paragraphs, and keep `hasInitializedLocalState` from being interpreted when
  `countsError !== null`.
- Implementation considerations: keep the destructive actions (Load/Replace/Delete/Wipe) disabled
  while the counts read is in error, otherwise the user can act on an unverified inventory; keep
  the existing copy/testIDs (`data-management.test.tsx` asserts current testIDs); a second error
  state for the backup listing must not mask the counts error (order them so the first failure
  wins, and log both).
- Dependencies: `useDbData` (shared hook), the shared `StateCard`/`EmptyState` primitives,
  `data-portability` loaders (Lane L02 owns the portability semantics).
- Risks: adding an error branch changes the render tree that `data-management.test.tsx` and the
  visual baselines pin; an over-eager error state could hide legitimate empty states (only gate on
  `loaded && error`).
- Validation required: `npx jest apps/mobile/src/app/__tests__/data-management.test.tsx` with a new
  case that mocks `countLocalData`/read transport to reject and asserts an error card plus a
  disabled Wipe control; re-run the visual baseline suite.
- Completion criteria: a rejected counts read or backup listing renders a retryable error surface;
  no destructive control is enabled while the inventory is unknown; existing green tests stay green.

### L05-F02 — Navigation to tab/root destinations uses `push`, so the stack grows and back re-enters completed screens
- Severity: P2
- Confidence: strongly indicated (stack semantics confirmed by expo-router `push` contract and by
  the app's own tests; the duplicated tab-bar render needs runtime validation)
- Category: frontend | correctness
- Files: `apps/mobile/src/app/results.tsx:510-517` (`Finish workout` → `router.push("/")`),
  `apps/mobile/src/app/rewards.tsx:806-814` (`Done` → `router.push("/(tabs)/profile")`),
  `apps/mobile/src/app/(tabs)/index.tsx:791, 1117, 1124` (`/progress`, `/games`, `/progress`),
  `apps/mobile/src/app/_layout.tsx:283-296` (every route is a sibling in one root `Stack`).
- Evidence:
  ```tsx
  // results.tsx:513-516
  label="Finish workout" sublabel="Back to Today" testID="results-finish-workout"
  onPress={() => router.push("/")}
  // rewards.tsx:806-814
  label="Done" accessibilityLabel="Back to profile" onPress={() => router.push("/(tabs)/profile")}
  ```
  Compare with the correctly-implemented sibling: `results.tsx:180` uses
  `useSafeBack("/")` (`backOrFallback` → `router.back()`), and `games.tsx`/tab switching is done by
  the tab navigator. The app's own deep-link test proves `push`/`back` stack semantics
  (`app/__tests__/app-shell.test.tsx:172-181`: push `/game-detail/memory`, then `router.back()` →
  pathname `/games`).
- Problem: `push` always adds a new stack entry. Neither "Finish workout" nor Rewards' "Done"
  dismisses the current screen, so (a) hardware/edge back from the tab root returns to the screen
  the user just left — an already-completed `results` screen, or the `rewards` screen they already
  dismissed — and (b) a repeated loop (Home → workout → results → Finish → Home → workout → …)
  grows the root stack without bound, keeping every completed results screen mounted (each holds a
  `useDbData` snapshot and a `useWorkoutResultAdvance` hook). Home also pushes `/progress` and
  `/games` instead of switching tabs, which mounts a second instance of the tab navigator under
  the first when the push lands on the `(tabs)` route.
- Why it matters: back is the primary Android escape hatch; instead of leaving a finished flow it
  replays it. Long sessions accumulate mounted route trees (memory + duplicated DB loads), and the
  "Done" affordance on Rewards does not behave like the dismissal its label promises.
- Root cause: `push` was used as a generic "go there" call where the intent was
  dismiss-to-destination (`router.dismissTo` / `router.replace`) or tab switch
  (`router.navigate`/`Link href="/(tabs)/…"`); the two screens that need dismissal are exactly the
  two that never adopted `useSafeBack`.
- Recommended solution: in this repo's idiom, `results.tsx` "Finish workout" and `rewards.tsx`
  "Done" should use `useSafeBack(<owning tab>)` (or `router.dismissTo('/')` when the target may be
  below the current screen), and cross-tab jumps in `index.tsx` should use `router.navigate` /
  typed `Link` to the tab route so the existing tab instance is reused. Add both routes to the
  safe-back catalog guard's surface list (L05-F05).
- Implementation considerations: `dismissTo` requires target-route awareness and no-ops on an
  empty stack, so pair it with the existing `backOrFallback` decision function rather than a naked
  call; preserve current labels/testIDs (`results-finish-workout`, `rewards-done`) so the existing
  tests keep passing; verify that dismissing lands on the tab the user came from (Home vs
  Profile) — `results` is reachable from Progress too, so the fallback target must stay a tab that
  is always reachable.
- Dependencies: `components/ui/back-link.tsx`, the route-guard test (L05-F05), tab navigator
  (`components/app-tabs.tsx`).
- Risks: over-dismissal could pop more than intended (e.g. dismissing from a workout leg);
  changing Home's tab jumps to `navigate` may alter back-stack expectations pinned in
  `home-workout-start.test.tsx`/`games-library.test.tsx`.
- Validation required: `npx jest apps/mobile/src/app/__tests__/app-shell.test.tsx
  apps/mobile/src/app/__tests__/results-workout-cta.test.tsx apps/mobile/src/app/__tests__/rewards.test.tsx`
  plus one runtime pass (ARTEMIS, emulator-local): Home → complete workout → results → "Finish
  workout" → press hardware back → must land on Home/launcher, never back on `results`.
- Completion criteria: `Finish workout` and `Done` dismiss instead of stack-push; a repeat loop
  produces a constant stack depth; hardware back from the tab root does not re-enter a completed
  results screen.

### L05-F03 — Profile paints its zeroed fallback as real data because it has no loading state
- Severity: P3
- Confidence: confirmed
- Category: frontend | correctness
- Files: `apps/mobile/src/app/(tabs)/profile.tsx:427-432` (`useDbData(loadProfile, …, EMPTY_PROFILE)`),
  `:187-210` (`EMPTY_PROFILE` = `displayName: "Player"`, `balance: 0`, `totalXp: 0`,
  `currentStreak: 0`, empty maps), `:591-604` (error branch), `grep -c Skeleton` → 0, `grep -c '!loaded'` → 0.
- Evidence: `const { data, loaded, error } = useDbData(loadProfile, [refreshKey], EMPTY_PROFILE);`
  with no `!loaded` render guard and no `Skeleton` import, while the hook contract states the
  fallback is returned until the first read settles. Home gates on `{!loaded && (<… testID="home-loading">)}`
  (`index.tsx:689`), Progress on `{!loaded ? … : error ? …}` (`progress.tsx:452-457`), Rewards,
  Results, game-detail, progress-game/detail/domain/activity all do the same.
- Problem: on first visit the Profile tab renders `Level`/XP/coin/streak counters computed from
  `EMPTY_PROFILE` (0 XP, 0 balance, "Player", empty quest/achievement maps) with no loading
  affordance; the numbers then jump when the read lands.
- Why it matters: the screen whose job is "your records" briefly asserts zeros. On a slow first
  read on an entry-level device this is indistinguishable from progress loss, and Profile is the
  screen that also offers streak-protection purchases (a user who "lost" a streak may act on it).
- Root cause: the error branch was added (hardening for the zeroed-fallback presentation) but the
  matching loading branch was not.
- Recommended solution: add the loading branch used by the sibling screens (`Skeleton` blocks
  under a `profile-loading` testID) before the counters, or gate the counters on `loaded`.
- Implementation considerations: keep the title/`profile-error` and current testIDs stable
  (`profile-purchases.test.tsx` asserts counters); the error branch already runs first, so add the
  loading branch after it; keep provider-driven controls (theme) rendered during loading so the
  screen is not empty.
- Dependencies: `useDbData`, `components/ui/Skeleton`, shared loading idiom.
- Risks: the visual baseline snapshots for Profile will need regeneration in the owning change;
  react-compiler memoized subtrees are unaffected.
- Validation required: `npx jest apps/mobile/src/app/__tests__/profile-purchases.test.tsx` plus a
  new case asserting no zeroed counters render before `loadProfile` resolves.
- Completion criteria: Profile shows a loading presentation until the first read settles, then
  real values; no zeroed "records" frame is observable.

### L05-F04 — Data Management has no back affordance and the root stack hides all headers
- Severity: P3
- Confidence: confirmed
- Category: frontend | accessibility
- Files: `apps/mobile/src/app/data-management.tsx` (`git grep -c BackLink` → 0; no router back/navigate
  call at all), `apps/mobile/src/app/(tabs)/profile.tsx:1109` (only entry point,
  `router.push("/data-management")`), `apps/mobile/src/app/_layout.tsx:283`
  (`<Stack screenOptions={{ headerShown: false }}>`), `app.json` `predictiveBackGestureEnabled: false`.
- Evidence: the six other pushed routes render `<BackLink …>` (`results.tsx:288`,
  `game-detail/[id].tsx:180,206`, `progress-detail.tsx:134`, `progress-activity.tsx:105`,
  `progress-domain.tsx:241`, `progress-game.tsx:160,200`); `data-management.tsx` renders none, and
  its only navigation-shaped control is `label="Export a backup first"` which is a `ConfirmButton`
  for the wipe flow.
- Problem: the screen is a navigation dead end for users who do not use the Android back gesture
  or the iOS edge-swipe: there is no visible "Back"/"Done" control, and headers are globally
  hidden. TalkBack/VoiceOver users have no announced exit either (there is no `accessibilityLabel`
  of the form "Back…" anywhere in the file).
- Why it matters: reachable from Profile, the backup/restore/wipe screen can appear to trap the
  user; this is the same class of defect the 058 safe-back hardening fixed for game screens
  (stranded users on an empty stack) and it is the only remaining pushed route without an exit
  control.
- Root cause: the route was authored before the shared `BackLink`/`useSafeBack` pattern was
  standardised and was never migrated (it is also absent from the safe-back catalog guard's scan
  set — L05-F05).
- Recommended solution: render `<BackLink testID="data-management-back" onPress={useSafeBack("/(tabs)/profile")} />`
  at the top of `ScreenShell` (fallback to the Profile tab, the only entry point), or `<button>Done</button>`
  mirroring `rewards-done`.
- Implementation considerations: reusing `useSafeBack` also protects a cold deep link
  (`braintraining://data-management`) where `canGoBack()` is false; the screen keeps its two-tap +
  typed-DELETE confirmations untouched; keep the `ScreenShell` a11y contract (the file is listed in
  `app/__tests__/shell-a11y-source.test.ts` OWNED_SURFACES, so new controls need labels/roles).
- Dependencies: `components/ui/back-link.tsx`, the safe-back guard (L05-F05), Profile's push site.
- Risks: minimal; a new control changes the shell-a11y counting rules only if it is a raw
  `<Pressable>` without a role.
- Validation required: `npx jest apps/mobile/src/app/__tests__/data-management.test.tsx apps/mobile/src/app/__tests__/shell-a11y-source.test.ts`;
  runtime: cold link `braintraining://data-management` → the control must return to the app (not
  exit) with an empty stack.
- Completion criteria: Data Management exposes a visible, labelled exit that works from both a
  pushed and a cold-deep-link landing.

### L05-F05 — The safe-back catalog guard covers only `games/**`; the six app-level pushed routes are unguarded and the negative pattern is bypassable
- Severity: P3
- Confidence: confirmed
- Category: testing | frontend
- Files: `apps/mobile/src/__tests__/safe-back-catalog.test.ts:21-40`,
  `apps/mobile/src/components/ui/back-link.tsx:40-52`.
- Evidence:
  ```ts
  const gamesDir = resolve(__dirname, '..', 'games');
  const screenFiles = readdirSync(gamesDir).map((gameId) => resolve(gamesDir, gameId, 'screen.tsx'))…
  expect(screenFiles).toHaveLength(42);
  expect(source).toMatch(/useSafeBack\(\s*['"]\/games['"]\s*\)/);
  expect(source).not.toMatch(/router\.back\s*\(/);
  ```
  The scan root is `src/games`; `src/app/**` is never read, even though six app routes
  (`results.tsx:180`, `game-detail/[id].tsx:131`, `progress-detail.tsx:89`,
  `progress-activity.tsx:72`, `progress-domain.tsx:106`, `progress-game.tsx:95`) depend on the same
  helper, and the two remaining pushed routes (`rewards.tsx`, `data-management.tsx`) have no exit
  control at all (L05-F02, L05-F04). The negative pattern is token-level: a screen could legitimately
  import `const { back } = useRouter()` or `router['back']()` and pass the guard; the positive
  pattern is also coupled to the literal `'/games'` fallback, so an app route with a correct but
  different fallback can never be added to this assertion as-is.
- Problem: the tripwire that is supposed to prevent a repeat of 058 covers 42 of the 50 screens that
  have this failure mode, and it cannot express per-route fallbacks.
- Why it matters: the regression it exists to catch is silent (a `back()` that no-ops on a cold deep
  link strands the user behind GameHost's pause intercept); the app-level routes have exactly the
  same cold-link exposure (`braintraining://results?id=…`, `…/progress-game?gameId=…`) and are
  currently protected only by author discipline.
- Root cause: the guard was written inside the games-only hardening packet (058) with a directory
  scan scoped to game modules.
- Recommended solution: generalise the guard to a table of
  `{ file, expectedFallback }` covering the 8 app-level pushed routes plus a `readdirSync`-driven
  scan of `games/**`, and add a `/useRouter\(\)|router\.back\(/`-style pattern check that fails on a
  router instance whose `back` is called without `useSafeBack` in the same file.
- Implementation considerations: the file lives outside `games/**` deliberately (catalog scanners
  treat every `games/*` directory as a module) — keep it in `src/__tests__/`; keep the hard
  `toHaveLength(42)` tripwire (it is intentional) but move the app-route list under the same
  "renames must update this list" comment style used by `shell-a11y-source.test.ts`.
- Dependencies: L05-F02/L05-F04 fixes; `components/ui/back-link.tsx`.
- Risks: an over-broad regex can flag legitimate `router.push`/`replace` usage — anchor the negative
  check on `.back(` only.
- Validation required: `npx jest apps/mobile/src/__tests__/safe-back-catalog.test.ts`.
- Completion criteria: the guard fails if any pushed route (game or app-level) calls bare
  `router.back()` or loses its `useSafeBack` exit; the guard's per-route fallback table matches the
  routes' owning tabs.

### L05-F06 — Progress tab focus reload is throttled by a time-only 5 s window, so a mutation performed within the window stays stale
- Severity: P3
- Confidence: strongly indicated (code path confirmed; the exact 5 s repro requires runtime validation)
- Category: correctness | frontend
- Files: `apps/mobile/src/app/(tabs)/progress.tsx:180-193` (`shouldScheduleFocusReload` gate),
  `apps/mobile/src/app/__tests__/progress-focus-throttle.test.ts:1-22`,
  `apps/mobile/src/progression/focus-sync.ts:12-25` (the newer, input-aware gate),
  `apps/mobile/src/workout/use-workout-result-advance.ts:111` / `workout/session-advance.ts:90`
  (the mutation that can land inside the window).
- Evidence:
  ```ts
  // progress.tsx:183-192
  if (shouldScheduleFocusReload(lastLoadRef.current, now)) { lastLoadRef.current = now; setRefreshKey((k) => k + 1); }
  // progress-focus-throttle.test.ts: "loads on first focus and after the window settles"
  ```
  The gate is `now - lastLoad >= 5000` only. `focus-sync.ts` documents why a pure window was later
  rejected for the sibling surfaces: *"Unlike a pure time window, the gate is INPUT-AWARE: the newest
  persisted session is fingerprinted, and a changed fingerprint always forces a sync."*
- Problem: the Progress snapshot (sessions, ratings, `workouts`/`workoutsCompletedLifetime`,
  calendar, training balance) is not re-read when the tab regains focus inside the 5 s window. A
  mutation that does not require minutes of play can land in that window: opening a session row →
  `results` (which advances the owned workout leg on mount via `advanceWorkoutForSession`) → back to
  Progress within 5 s leaves the workout card showing the pre-advance index/status until an explicit
  retry or a later focus.
- Why it matters: the screen labels itself as today's progress; showing a pre-advance workout leg
  invites the user to re-play a leg the engine already counted, and the retry affordance only
  appears in the error branch (it is invisible while the stale snapshot renders).
- Root cause: the 061 throttle predates the input-aware `progress/focus-sync` gate and was not
  revisited when that pattern was established; the Progress screen's mutation inventory also grew
  after the throttle (results-mounted leg advance).
- Recommended solution: extend the existing gate rather than inventing a new one — reuse
  `progressionInputFingerprint`/`shouldSyncProgression`-style input awareness (newest session id +
  completed-at) for the Progress snapshot, or have `advanceWorkoutForSession`/`emitWorkoutChanged`
  invalidate `lastLoadRef` so a mutation forces the next focus reload.
- Implementation considerations: the Progress snapshot materializes full history, so the fix must
  stay O(1) to decide; reuse the existing `workout/events` emitter (`emitWorkoutChanged` is already
  wired to mounted consumers) instead of adding polling; keep `nowMs` per-focus freshness intact.
- Dependencies: `progression/focus-sync.ts`, `workout/events.ts`, `useWorkoutResultAdvance`,
  Lane L01/L02 data-layer owners (mutation notification surface).
- Risks: removing the throttle entirely reintroduces the cost the 061 change removed; an
  invalidation hook that fires on every event must not trigger a reload storm during workout
  progression.
- Validation required: extend `apps/mobile/src/app/__tests__/progress-focus-throttle.test.ts` (pure
  decision) and add a screen-level test that mutates a workout instance, re-focuses inside the
  window, and asserts the new index renders.
- Completion criteria: a session-less mutation (workout leg advance, purchase, claim) is visible on
  the next Progress focus regardless of the 5 s window; the throttle still suppresses pure
  focus-bounce reloads.

### L05-F07 — Oversized screens: the eight largest route files carry several independent responsibilities each
- Severity: P3
- Confidence: confirmed (`wc -l` + section comments)
- Category: architecture | frontend
- Files: (8 largest route files, largest first)
  | # | File | Lines | Mixed responsibilities (from in-file section comments) |
  |---|------|-------|----------------------------------------------------------|
  | 1 | `apps/mobile/src/app/(tabs)/progress.tsx` | 1521 | snapshot load + window/cadence controls + domain insights + composite explainer + activity calendar + training balance + workout card + history list |
  | 2 | `apps/mobile/src/app/(tabs)/profile.tsx` | 1350 | profile records + theme/settings controls + streak-protection purchase + reward-claim counters + milestone tease |
  | 3 | `apps/mobile/src/app/(tabs)/index.tsx` | 1311 | daily workout hero + reroll economy + workout templates/history (W24) + spotlight + mastery milestones + recent games |
  | 4 | `apps/mobile/src/app/data-management.tsx` | 1024 | inventory summary + export + share + saved-backup CRUD + import preview/merge/replace + wipe with typed confirmation |
  | 5 | `apps/mobile/src/app/rewards.tsx` | 910 | inbox/claim + purchase (arm-timer) + equip + claim-all + celebration host + history report + purchase queue |
  | 6 | `apps/mobile/src/app/progress-game.tsx` | 714 | per-game snapshot + rating window + insights + session list + practice CTA + workout provenance |
  | 7 | `apps/mobile/src/app/progress-domain.tsx` | 702 | domain snapshot + game ranking + sessions + empty/error states + insights |
  | 8 | `apps/mobile/src/app/results.tsx` | 680 | session resolution + rating movement + workout advance/navigation + recent sessions + hero/celebration + CTAs |
- Evidence: `find apps/mobile/src/app -type f \( -name '*.tsx' -o -name '*.ts' \) | xargs wc -l | sort -rn`
  (15213 total; the table's top eight are stable under `git ls-files`).
- Problem: no route exceeds 1521 lines for a single reason; each mixes data loading, derived
  analytics, mutation flows and presentation, and the shared analytics helpers they use
  (`buildDomainInsights`, `buildActivityCalendar`, `compareRecentVsLifetime`, `buildTrainingBalance`)
  are already extracted — so what remains is screen-local orchestration that cannot be reused or
  unit-tested in isolation (tests must render the whole route, e.g.
  `progress-insights.test.tsx`, `results-hero.test.tsx`).
- Why it matters: these five files are the shared write surface for every UI wave, which is the
  exact hotspot the repo's swarm policy says to minimise; review/diff cost and regression surface
  scale with them, and the two navigation defects in this lane (L05-F02, L05-F03) both sit in these
  files precisely because their exit/loading orchestration is buried among twelve other concerns.
- Root cause: incremental campaign additions (006R, 012, 014, 024, 026, W24) appended sections to
  existing routes instead of extracting per-section components/hooks.
- Recommended solution: extract per-section components + data hooks along the existing comment
  boundaries (e.g. `progress/*-card.tsx` under `components/progress/`, `use-progress-snapshot.ts`),
  following the precedent already set by `components/game-host/*` and `workout/use-workout-*`.
- Implementation considerations: extract pure derivation first (no behaviour change, no test
  churn), then presentational sections; keep every `testID` and the single `useDbData` call per
  screen (splitting the load would duplicate the query cost); do not move shared analytics that
  other screens already import from `@/progress`/`@/insights`-style modules.
- Dependencies: none functional; coordinate with any lane touching these files (the audit's other
  lanes may propose edits to the same routes — convergence must own the conflict).
- Risks: mechanical extraction can change render/effect ordering (and therefore the focus-throttle
  timing in L05-F06) or React-Compiler memoization boundaries; do it as pure-move commits with the
  existing route tests as the safety net.
- Validation required: existing route suites for each touched screen
  (`progress-insights`, `results-hero`, `results-workout-cta`, `home-*`, `rewards`,
  `profile-purchases`, `data-management`) plus the visual baselines.
- Completion criteria: no route file above ~600 lines; each extracted unit has its own test; all
  shipped `testID`s unchanged.

### L05-F08 — `game-detail` announces "Back to Games" on three different entry paths where back does not go to Games
- Severity: P3
- Confidence: confirmed
- Category: accessibility | frontend
- Files: `apps/mobile/src/app/game-detail/[id].tsx:180, 206` (`accessibilityLabel="Back to Games"`),
  entry paths `apps/mobile/src/components/discovery/game-poster-tile.tsx:52` and
  `apps/mobile/src/components/discovery/game-card.tsx:121` (Games library),
  `apps/mobile/src/components/spotlight/spotlight-card.tsx:91`,
  `apps/mobile/src/components/mastery/mastery-card.tsx:92`,
  `apps/mobile/src/components/discovery/suggested-next.tsx:90` (Home),
  `apps/mobile/src/app/progress-detail.tsx:324`, `apps/mobile/src/app/progress-game.tsx:184` (Progress).
- Evidence: `<BackLink testID="game-detail-back" onPress={goBack} accessibilityLabel="Back to Games" />`
  with `const goBack = useSafeBack('/games')` (`:131`). The `'/games'` value is only the empty-stack
  fallback; on the Home (spotlight/mastery/suggested-next) and Progress entry paths `router.back()`
  returns to the pushing screen, while the visible label stays `Back` and the announced name stays
  "Back to Games". (Note: `game-detail/[id].tsx:272` is the only site that pushes the game route
  `/game/${id}`, so the library's poster grid reaches detail before play.)
- Problem: the screen-reader name states a destination that is wrong on four of the six entry
  paths; the label is derived from a cold-link fallback rather than from where back actually goes.
- Why it matters: TalkBack users navigate by label; a "Back to Games" announcement that lands on
  Home or on `progress-game` breaks the mental model and can send the user hunting for the library.
  This is the label-accuracy class the shell guard enforces for controls, but navigation names are
  unchecked.
- Root cause: the fallback href (a cold-link concern) was used as the accessibility label (an
  origin-dependent concern).
- Recommended solution: label it with the honest action ("Go back") as `BackLink` already defaults
  to, or derive the label from `router.canGoBack()`/the origin param.
- Implementation considerations: `game-detail.test.tsx` asserts the current testID (and possibly the
  label) — update it in the same change; keep the `'/games'` fallback untouched.
- Dependencies: `components/ui/back-link.tsx` defaults.
- Risks: none beyond the test assertion.
- Validation required: `npx jest apps/mobile/src/app/__tests__/game-detail.test.tsx` plus a
  Home-origin and a Progress-origin runtime check of the announced name.
- Completion criteria: the announced label matches where back actually goes for every entry path.

## Checked and found clean
1. **No bare `router.back()` in production app code** — `git grep -n "router.back\|\.goBack("
   -- 'apps/mobile/src/app/**'` returns one test-only hit (`app/__tests__/app-shell.test.tsx:178`).
   The 42 game screens use `useSafeBack('/games')` (guard-enforced); 6 app routes use the same
   helper with their owning-tab fallback.
2. **`useSafeBack` semantics are correct for cold deep links** — `backOrFallback` returns
   `'replace'` only when `router.canGoBack()` is false, so a `braintraining://` landing cannot
   no-op (`back-link.tsx:34-52`; unit-tested in `components/ui/__tests__/back-link.test.tsx`).
3. **Deep-link envelope parameters** — length is checked before form (`isBounded`,
   `MAX_ROUTE_PARAM_LENGTH = 128`), forms are ASCII-canonical regexes (no unicode-digit acceptance;
   `/^\d+$/` is ASCII-only), leg index is digit-bounded and `Number.isSafeInteger`-checked against
   `MAX_ROUTE_LEG_INDEX = 5`, `parseCanonicalDomain` requires the `isGameCategory` enum,
   `parseRegisteredGameId` requires registry membership, array params coerce to `[0]`
   (`firstRouteValue`), and unknown keys are never read by any consumer. The accepted upstream
   `decode-uri-component` ReDoS stays inside the accepted-debt boundary (the module documents this
   explicitly at `route-params.ts:30-37`) — no new evidence that it is worse than recorded.
4. **Workout-launch provenance cannot be forged by a link** — `parseWorkoutLaunchProvenance`
   validates form only, but the persistence/advance path is membership-checked:
   `db/workout.ts:692-704` requires `provenance.gameId === session.gameId` **and**
   `ownsCurrentLeg(instance, provenance)` where `instance` comes from the read-only
   `getByDate` (`:298-304`); the only create path is `getOrCreate…` from the selector's own seed
   (`:319-353`). A crafted `workoutKey=2099-01-01::standard::standard&workoutIndex=5` therefore
   degrades to a standalone session and cannot create or advance a workout row.
5. **What an unauthenticated deep link can actually change** — the concrete reachable
   state-changing UI is a *game*: `braintraining://game/memory` → the game intro renders with a
   Start control → completing a session writes `game_sessions`, XP, ledger, rating history and
   triggers quest/achievement evaluation. Every other route is read-only
   (`results?id=`, `progress-*`, `game-detail/[id]`, `(tabs)/*`), and the two destructive screens are
   gated: `data-management` requires two-tap `ConfirmButton` plus typed `DELETE`, `rewards`
   purchases require the 4 s arm-tap (`rewards.tsx:217-249`) — no route performs a mutation on mount.
   This matches the accepted "unauthenticated `braintraining://` scheme" debt; no new defect found
   inside that boundary.
6. **Android back during a paused/countdown session** — all 42 game screens pass
   `interceptBack={inSession}`; `game-host.tsx:171-183` consumes the press in both branches
   (`onPause()` when active, swallow while paused) with the latest-value `backStateRef` pattern, so
   quit is only possible through the overlay's explicit Resume/Quit. No RN `Modal` exists in the app
   (`git grep "Modal,"` → 0 hits), and `predictiveBackGestureEnabled: false` in `app.json` avoids the
   predictive-back gesture racing the intercept. The only other modal-ish surfaces are the tutorial
   overlay (`game-host.tsx:354-358`) and the pointer-transparent `ToastHost`.
7. **The three `eslint-disable` sites are justified**:
   - `app/_layout.tsx:219` (`react-hooks/set-state-in-effect`) — bootstrap must publish
     `loading|ready|recovery` on mount; the effect body is the startup pipeline and is guarded by
     `cancelledRef`, so the disable is the correct escape hatch rather than a mask.
   - `hooks/use-db-data.ts:72` (`react-hooks/exhaustive-deps`) — `deps` is the caller-declared
     refresh trigger propagated as the effect's dependency array; the effect body is
     generation-guarded (`seqRef`, `cancelled`), and all 12 production call sites pass a loader that
     closes over route params also present in `deps` (`game-detail` `[routeGameId, refreshKey]`,
     `results` `[sessionId, refreshKey]`, `progress-domain` `[refreshKey, domain]`), so no stale
     closure was found. The residual risk is the documented caller contract ("the load closure is
     stable"), which is not type-enforced — worth a comment-level lint rule at most.
   - `hooks/use-color-scheme.web.ts:12` (`react-hooks/set-state-in-effect`) — the hydration flag is
     the standard static-rendering pattern; setting it on mount is the entire purpose.
   No other `react-hooks/*` disable exists in `src/app`, `src/hooks`, or `src/routing`.
8. **Wipe is followed by in-process recovery** — `data-management.tsx:401-425` calls
   `wipeLocalData`, emits `emitWorkoutChanged()` (so mounted workout consumers drop the deleted
   instance), then `refreshProgression(getDb())` to restore the singleton profile + versioned
   definitions, and refreshes its own counts; a failure is surfaced in copy
   ("…could not be restored. Reopen the app to retry."). No route/screen state machine is left
   holding pre-wipe rows.
9. **Rewards has no focus-effect gap despite lacking `useFocusEffect`** — it is a pushed route that
   remounts per visit, and the module-level gate in `progression/focus-sync.ts:12-25` documents and
   handles that ("Rewards which remounts per visit rather than focusing"), with the gate also
   exercised by `app/__tests__/progression-focus-sync.test.tsx`.
10. **The game route has a single pushing site** — `game/[id]` is entered only from
    `game-detail/[id].tsx:272` and from the `gameHref(...)` helpers in `results.tsx`/`index.tsx`'
    workout hero, so the id handed to the game route always originates from a registry-validated or
    catalogue-owned value (cold deep links still pass through `parseCanonicalGameId`).
11. **Focus reload wiring is consistent on the data screens** — Home (`index.tsx:258-262, 331-336`),
    Profile (`:434-438`), Progress (`:184-193`), game-detail (`:108-112`), results (`:181-185`),
    progress-activity/detail/domain/game all bump a refresh key from `useFocusEffect`, and the
    hook's `seqRef` generation guard prevents an out-of-order payload from overwriting a fresher
    one.

## Not covered / could not verify
- **Runtime back-stack and tab-bar behaviour** (L05-F02): whether pushing `/`, `/progress` or
  `/(tabs)/profile` duplicates the tab navigator visually, and whether the tab highlight survives,
  needs emulator validation (ARTEMIS, emulator-local). Static evidence (expo-router `push`
  contract + `app-shell.test.tsx` stack assertions) is strong but not authoritative for the visual
  result.
- **The 5 s stale window repro** (L05-F06): confirmed by code reading; a device/emulator run
  (Progress → session row → results → back inside 5 s) is required to observe the stale workout
  card.
- **Per-game `inSession` phase coverage** (check 6): all 42 screens pass `interceptBack`, and the
  sampled predicates (`attention-odd-one-out:121`, `attention-symbol-tracker:148-152`,
  `language-*`, `logic-*`, `math-*`) cover each game's active phases, but a 42-game phase-by-phase
  verification was not performed — a game whose "active round" phase is missing from `inSession`
  would allow an unconfirmed exit. Grep-level sample only.
- **iOS-specific navigation** (edge-swipe dismissal, `hasHydrated` scheme behaviour) — outside the
  Android-first audit target.
- **`components/app-tabs.tsx`** internals (tab switching semantics, deep-link handling into a tab)
  were only inspected through their call sites in `(tabs)/_layout.tsx`; the component's own
  behaviour belongs to a components lane.

## Contradictions with existing documentation
- `apps/mobile/src/components/a11y.ts:17,39` advertises `A11yDialog` as the app's accessible modal
  dialog primitive ("dialog: accessible modal dialog primitive", Android-back + scrim dismiss,
  44 pt Close), and `docs`/campaign notes (`.agent/_tasks/campaign010/W14.md:77`) instructed screens
  to "use `A11yDialog` for confirm dialogs (data-management delete flows)". In the shipped tree the
  component has **zero production usages** (`git grep -n "A11yDialog"` → the export, the props
  type, and `components/a11y/__tests__/dialog.a11y.test.tsx`); data-management uses
  `ConfirmButton` and the paused-game surface uses the bespoke `game-ui/pause-overlay.tsx`. So the
  documented Android-back-dismiss contract for modals is now exercised only by its own unit test,
  and the pause overlay deliberately does not adopt it (its header documents an Android a11y
  grouping failure that forced the custom shape). Either the primitive should be deleted/retitled
  as test-only, or the modal surfaces should adopt it — as written, the library contract and the
  production navigation behaviour disagree.
- `apps/mobile/src/app/__tests__/shell-a11y-source.test.ts` describes itself as a guard over "ALL
  W12-owned shell surfaces" and includes `app/data-management.tsx`; that file has no exit control
  (L05-F04), so the shell contract is satisfied for roles/labels but not for navigation
  reachability. No contradiction in wording, but the coverage claim in `safe-back-catalog.test.ts`
  ("routes every game exit…") is narrower than a reader may assume — it covers games only (L05-F05).
