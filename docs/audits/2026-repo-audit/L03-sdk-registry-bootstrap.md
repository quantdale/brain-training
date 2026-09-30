# Lane L03 — Game SDK + registry + generator + bootstrap

**Status: COMPLETE.** Read-only lane. No repository file other than this report was created or modified.

## Scope covered
- Deeply inspected: `apps/mobile/src/sdk/{index,version,rng,lifecycle,timing,numeric,testid,pause,perf}.ts`, `apps/mobile/src/sdk/types/game-definition.ts`; `apps/mobile/src/registry/{registry.ts,registry.generated.ts}`; `apps/mobile/src/bootstrap/run-bootstrap.ts`; `apps/mobile/src/components/game-host/{game-host.tsx,session-identity.ts,use-game-session.ts,timers.ts}`; `apps/mobile/src/components/error-boundary.tsx`; `apps/mobile/src/app/game/[id].tsx`; `apps/mobile/src/games/speed-tap-rush/{index.ts,screen.tsx,reducer.ts,session.ts,versions.ts,types.ts}`; `scripts/generate-game-registry.mjs`; `scripts/validate-provenance.mjs`; `docs/GAME_SDK.md`; `docs/PARITY_MATRIX.md`.
- Structurally inspected (grep/symbol map/call trace, no full read): all 42 `apps/mobile/src/games/*/{screen.tsx,reducer.ts,generator.ts,game.json,versions.ts,scoring.ts}` for `Math.random`, `interceptBack`, `claimFinalize`, `AppState`, `BackHandler`, `Animated.loop`, `.stop()`, `SCORING_VERSION`; `.github/workflows/*.yml`; `apps/mobile/src/sdk/__tests__/catalog-contracts.test.ts` and `sdk/__tests__/catalog/registry-membership.test.ts` (the two catalog-wide gates that police this lane's area).
- Diagnostics run:
  - `node scripts/generate-game-registry.mjs --check` → `registry generator: generated registry is up to date`, exit 0.
  - `grep -l '"generatorVersion": null' apps/mobile/src/games/*/game.json | wc -l` → `0` (all 42 declare a non-null generatorVersion).
  - `grep -rn "Math\.random" games/*/{generator,reducer,scoring,session,hooks}.ts` → 1 hit, a comment only (`games/flexibility-task-switch/generator.ts:21`).
  - `grep -rn "interceptBack" games/*/screen.tsx | wc -l` → 42 (42/42 screens intercept hardware back during a session).
  - `grep -o '^    primaryCategory: "[^"]*"' registry.generated.ts | sort | uniq -c` → 7 Memory + 5 × 7 other categories = 42.
  - `grep -h "SCORING_VERSION =" games/*/versions.ts | sort -u` → 7 distinct literals, all single-quoted literals (the provenance regex matches every one).
  - `grep -rn "registerGameDefinitions" apps/mobile/src` → wired once in `app/_layout.tsx:156` inside `runBootstrap`'s `registerCatalog` stage.
- Intentionally excluded: the 41 non-representative game screens beyond targeted greps (per lane budget); `sdk/audio-haptics*.ts`, `sdk/tutorial.ts`, `sdk/perf.ts` internals (owned by other lanes' concerns); device/runtime execution (host-interaction prohibition); `db/**` persistence internals (lane L01); backup/sync (lane L02).

## Flow map
1. `node scripts/generate-game-registry.mjs` reads each `games/<id>/game.json` → validates → emits `registry.generated.ts` with `registry` + `gameScreenLoaders`; `--check` re-generates in memory and diffs (CI gate in all 3 app workflows).
2. `app/_layout.tsx:156` → `registerGameDefinitions(registry)` (`registry/registry.ts:31`) → `defineGame()` re-validates + freezes into module state inside `runBootstrap`'s `catalog-registry` foundational stage.
3. Route `app/game/[id].tsx`: `parseCanonicalGameId` → `getGameDefinition` → `getLazyGameComponent` → `<ErrorBoundary>` → `<Suspense>` → `WorkoutSessionLaunchProvider` → game screen (`tutorialStore` injected via an `as` cast).
4. Game screen (`games/speed-tap-rush/screen.tsx`) → `useGameSession` (`components/game-host/use-game-session.ts`) owns id/seed, `SessionLifecycle`, AppState auto-pause, finalization claim → reducer (`reducer.ts`, pure, clock-free, seeded RNG) → finalize effect → `buildTapRushRawResult` → `normalizeTapRushResult` → `buildSessionRecord` (`versionToNumber`/`seedToNumber`) → `persistTapRushSession` → `completeSession`.
5. Pause/resume/quit: `GameHost` back interception (`interceptBack={inSession}`, 42/42) and pause overlay → `session.requestPause()` / `resumeIfPaused()` / `abandonIfActive()`; `useGameTimeout`/`useGameDeadlineTimeout` cancel on pause and re-schedule from the monotonic deadline.

## Findings

### L03-F01 — The SDK has no behavioral game-module contract; the loader boundary is a bare `ComponentType` and the route patches the gap with an unchecked cast
- Severity: P2
- Confidence: confirmed
- Category: api-contract
- Files: `apps/mobile/src/sdk/types/game-definition.ts:31-60` (`GameDefinition`), `apps/mobile/src/registry/registry.generated.ts:598` (`gameScreenLoaders`), `apps/mobile/src/app/game/[id].tsx:99` (`InjectableGameComponent`), `apps/mobile/src/sdk/index.ts:1-107`, `docs/GAME_SDK.md:7-24`
- Evidence:
  - The generator emits the loader map typed as: `export const gameScreenLoaders: Record<string, () => Promise<{ default: ComponentType }>> = {` — a screen is `ComponentType` with **no props or behavior contract**.
  - The route then re-widens it by force: `const InjectableGameComponent = GameScreenComponent as ComponentType<{ tutorialStore?: TutorialStore; }>;` with the comment *"Screens all accept an optional `tutorialStore` injection seam; the shared loader type is the bare ComponentType, so widen it here once."*
  - `GameDefinition` (the only machine-checked "game module contract") carries 9 metadata fields (`id, name, primaryCategory, secondaryDomains, description, sdkVersion, gameVersion, generatorVersion, contentVersion, hasTutorial`) and **zero behavioral fields**. Every entry in `docs/GAME_SDK.md` "Required concepts" — lifecycle, seed, normalizer, XP hook, QA hooks, tutorial, diagnostics — is enforced only by per-game hand-written tests and source-regex scans, not by a type or a runtime seam.
  - Consequence already visible: 42/42 screens hand-roll the same finalization effect (e.g. `games/speed-tap-rush/screen.tsx:200-282`); there is no interface that makes "game reaches `results` but never calls `claimFinalize()`/persists" a type error or a startup error.
- Problem: a game module can satisfy the entire SDK/registry contract while omitting required session behavior. `tutorialStore` is the concrete instance: it is injected through a cast and is *optional*, and the route documents that "Games that omit the prop keep the in-memory default" (`app/game/[id].tsx:16-20`) — i.e. a game that omits it silently loses persisted tutorial state, with no gate that says so.
- Why it matters: the failure mode is silent. A newly added game that never persists a completed session loses the player's XP/rating for that session with no error, no runtime diagnostic, and no failing shared gate (the catalog scan intended to catch this is vacuous — see L03-F02). The catalog is explicitly designed for many independent coder packets, so this is the exact class of mistake the shared SDK exists to prevent.
- Root cause: the SDK grew a metadata contract (`GameDefinition`) and a set of optional services, but never grew the module-level behavioral contract (`GameModule`/`GameScreenProps`) that the host and route now assume implicitly.
- Recommended solution: define the seam in `@/sdk` and use it in the generated registry instead of `ComponentType`: a `GameScreenContract` interface (required `gameId`, required `tutorialStore?: TutorialStore` as a *typed* optional field on a declared props type, plus a required `persistSession`/`normalizer` surface the route and tests can rely on), have `generate-game-registry.mjs` emit `Record<string, () => Promise<{ default: ComponentType<GameScreenContract>; gameDefinition: GameDefinition }>>`, and drop the cast in `app/game/[id].tsx`. Keep per-game mechanics inside the game module; only the cross-cutting obligations become typed.
- Implementation considerations: the generator emits static literals; adding a props type is a one-line change in the emitted header plus a type-only import, so `--check` stays deterministic. 42 screens must adopt the props type in one convergent wave (touch each `screen.tsx`, not shared files). `createNoopQaForceStateHooks`/`noopXpRatingHook` show the repository's established "no-op default" idiom — reuse it for any new optional hook rather than making fields optional-but-unguarded. Do not make the props runtime-validated at boot (a thrown `defineGame` already fails the whole shell via `recovery-required`); keep this compile-time plus the existing startup validation.
- Dependencies: `generate-game-registry.mjs`, `registry/registry.ts`, `app/game/[id].tsx`, all 42 `screen.tsx` files; the two catalog gates in `sdk/__tests__/catalog-contracts.test.ts` and `sdk/__tests__/catalog/registry-membership.test.ts`.
- Risks: a typed loader will surface existing prop-shape drift across 42 screens at once; land it as type-only first (no behavior change) to keep the diff reviewable.
- Validation required: `node scripts/generate-game-registry.mjs --check`; `npx tsc --noEmit`; `npx jest apps/mobile/src/sdk/__tests__/catalog/registry-membership.test.ts`.
- Completion criteria: `gameScreenLoaders` carries the shared props/behavior type; `app/game/[id].tsx` contains no `as ComponentType` cast; a screen that omits a required behavior fails `tsc`; registry `--check` still green.

### L03-F02 — The catalog-wide session-lifecycle gate is now vacuous: it is satisfied by the shared host sources, not by each game
- Severity: P3
- Confidence: confirmed
- Category: testing
- Files: `apps/mobile/src/sdk/__tests__/catalog-contracts.test.ts:160-176` (`GAME_HOST_SOURCES`, `delegatesToGameHost`, `contractSource`), `:231-273` (the three lifecycle assertions)
- Evidence:
  ```ts
  const GAME_HOST_SOURCES = (() => {
    const dir = join(GAMES_ROOT, '..', 'components', 'game-host');
    const names = ['game-host.tsx', 'use-game-session.ts'];
    return names.map((name) => readFileSync(join(dir, name), 'utf8')).join('\n');
  })();
  function contractSource(game: GameSource): string {
    const screen = requireFile(game, 'screen.tsx');
    return delegatesToGameHost(screen) ? `${screen}\n${GAME_HOST_SOURCES}` : screen;
  }
  ```
  and the assertions themselves are pure source regexes: `if (!/new\s+SessionLifecycle/.test(screen))`, `if (!/AppState\.addEventListener/.test(screen))`, `if (!/\.abandon\(\)/.test(screen))`, `if (!/finalizedRef/.test(screen))`.
  `new SessionLifecycle`, `AppState.addEventListener`, `.abandon()` and `finalizedRef` all now live **only** in `components/game-host/use-game-session.ts`, and all 42 screens delegate (`grep -rn "interceptBack" games/*/screen.tsx` → 42 hits, every one through `@/components/game-host`).
- Problem: for every one of the 42 games the test's `screen` string is `screen.tsx` + the same two shared files, so all four regexes match shared code regardless of what the individual screen does. The test cannot fail because a game screen stopped calling `session.claimFinalize()`, `abandonIfActive()`, or `resumeIfPaused()`. The stated intent — *"drives SessionLifecycle, auto-pauses on background, abandons on quit"*, *"guards result finalization against double submission"* — is no longer verified per game, while the gate still reports green.
- Why it matters: this is the only catalog-wide gate covering this lane's per-game obligations, and it silently stopped testing them during the GameHost extraction (campaign 010 D1). Combined with L03-F01 it means a new game can ship without persistence wiring and every shared gate stays green; only a hand-written per-game test would notice.
- Root cause: `contractSource` was widened to make the shared-host migration pass (the screens legitimately no longer contain those tokens) without adding a replacement assertion that the screen actually *calls* the host seam.
- Recommended solution: keep the shared-source concatenation for the mechanical checks, but add per-screen assertions that are specific to the delegation contract — e.g. require `/useGameSession\s*\(/`, `/\bclaimFinalize\s*\(/`, `/\babandonIfActive\s*\(/`, `/interceptBack=\{/` and a `persist<Game>Session` reference in `screen.tsx` itself — and, per L03-F01, prefer a type-level contract so the check is not a regex at all. Keep the `collectViolations` idiom and the "guards against vacuous scans" style already in this file.
- Implementation considerations: source-regex assertions remain brittle (they pass on comments — this file already greps files that contain explanatory comments mentioning these tokens). If any assertion survives as a regex, strip comments before matching, as `sdk/__tests__/catalog/non-migrated-qa-gates.test.ts` already does elsewhere in this area. Do not weaken the existing checks; add alongside them.
- Dependencies: `components/game-host/use-game-session.ts`, the 42 screens, L03-F01's typed seam.
- Risks: per-screen assertions will be red until every screen is confirmed to wire the seam; verify against the 42 screens in the same wave.
- Validation required: `npx jest apps/mobile/src/sdk/__tests__/catalog-contracts.test.ts`; negative test — delete `claimFinalize()` from one screen and confirm the suite fails.
- Completion criteria: removing the host-seam call from any single `screen.tsx` fails the suite; the negative test above is recorded.

### L03-F03 — `useGameSession.begin()` has no duplicate-start guard and silently orphans a non-terminal session
- Severity: P3
- Confidence: confirmed
- Category: concurrency
- Files: `apps/mobile/src/components/game-host/use-game-session.ts:154-178` (`begin`), `apps/mobile/src/games/speed-tap-rush/screen.tsx:342-355` (`handleStart` / `handleRestart = handleStart`), `apps/mobile/src/components/game-host/game-host.tsx:286-292` (Start `Button`), `apps/mobile/src/workout/session-provenance.ts:74-90` (`registerWorkoutSessionLaunch`)
- Evidence:
  ```ts
  begin: useCallback((): SessionStartIdentity => {
    finalizedRef.current = false;
    const lifecycle = new SessionLifecycle({ clock });
    lifecycle.start();
    lifecycleRef.current = lifecycle;
    markGameSessionStart(gameId);
    ...
  ```
  No check of `lifecycleRef.current?.status` and no `abandon()` of the previous lifecycle. `GameHost`'s Start control is a plain `<Button testID={testId(gameId, 'start')} ... onPress={onStart} />` with no press lock, and `handleRestart = handleStart` (`screen.tsx:355`).
- Problem: two activations of Start (or Start racing the results-screen restart) create a second `SessionLifecycle` while the first stays `active` forever with no `abandon()`. Its `markGameSessionStart` perf window is opened and never closed, and its `sessionId` stays registered in `pendingLaunches` (`session-provenance.ts:35`). No state corruption results — the reducer's `sessionId` is overwritten (`reducer.ts:140`) and the persistence callback self-validates via `session.isCurrentSession(record.id)`, which is exactly why this is not P1.
- Why it matters: creates an unbounded-in-time "ghost" active session per double Start (bounded only by `pendingLaunches`'s eviction at `session-provenance.ts:87`); any future per-session side effect added to `begin()` (an analytics open, a crash/report breadcrumb, a server-side sync intent) will leak with it. It also means the lifecycle layer cannot be used to answer "is a session already running?" authoritatively.
- Root cause: `begin()` models "start the next session" without considering that a session may still be in flight; the previous implementation lived per-screen where the phase guard made double-entry impossible.
- Recommended solution: make `begin()` total in the repository's existing idiom — if `lifecycleRef.current?.status === 'active' || 'paused'`, call `abandon()` on it (and release its provenance registration) before constructing the new one, or return a discriminated `{ ok: false, reason: 'in-flight' }`. Expose the previous session id so the caller can clear it. `SessionLifecycle` already throws `IllegalTransitionError` on illegal transitions, so the guard must live in `useGameSession`, not in the state machine.
- Implementation considerations: `begin()` is currently synchronous and returns `SessionStartIdentity`; keep it synchronous and keep `resumeIfPaused()`'s "never throw from a UI handler" policy consistent with whatever guard is chosen. `claimFinalize`'s re-arm semantics on `begin()` are correct today and must be preserved (a restart legitimately re-arms the guard). Verify the workout-launch path: `registerWorkoutSessionLaunch` only registers when `workoutLaunch?.gameId === gameId` (`use-game-session.ts:167-170`), so the clear must be conditioned identically.
- Dependencies: `session-provenance.ts`, `workout/session-launch-context.ts`, all 42 screens (they all call `begin()`), `app/game/[id].tsx` (route-level remount semantics).
- Risks: abandoning a lifecycle that a concurrent completion is reading could change `elapsedMs()` mid-flight; the only reader is the finalize effect, which is already identity-guarded — assert that ordering with a test rather than assuming it.
- Validation required: `npx jest apps/mobile/src/components/game-host/__tests__`; a new host test calling `begin()` twice and asserting the first lifecycle's status is terminal and its provenance entry is gone; `npx jest apps/mobile/src/workout`.
- Completion criteria: no lifecycle left `active`/`paused` after a second `begin()`; provenance map contains at most one entry per `gameId`; existing host/game tests green.

### L03-F04 — `versionToNumber` contradicts both its own docstring and the SDK's nullable version contract
- Severity: P3
- Confidence: confirmed
- Category: data-integrity
- Files: `apps/mobile/src/games/speed-tap-rush/versions.ts:14-29`, `apps/mobile/src/games/speed-tap-rush/session.ts:137-139`, `apps/mobile/src/sdk/types/game-definition.ts:44-60`, `apps/mobile/src/db/schema.ts:55-57`
- Evidence:
  ```ts
  /**
   * Map a semantic version string to the integer recorded in the db
   * (`game_sessions.game_version` etc.): the numeric major component. ...
   * `null` (non-procedural games) is rejected.
   */
  export function versionToNumber(version: string | null): number {
    const match = /^(\d+)/.exec(version ?? '');
    if (match === null) throw new Error(`versionToNumber: "${version}" has no numeric major component`);
    const ma = Number(parts[0] ?? 0); const mi = Number(parts[1] ?? 0); const pa = Number(parts[2] ?? 0);
    return ma * 1000000 + mi * 1000 + pa;
  }
  ```
  The docstring says "the numeric major component"; the body packs `major*10^6 + minor*10^3 + patch`. Meanwhile `GameDefinition.generatorVersion` is typed `string | null` and `docs/GAME_SDK.md:34-36` states generator version "or `null` for non-procedural games", and `buildSessionRecord` passes it straight in: `generatorVersion: versionToNumber(raw.generatorVersion)`.
- Problem: two contradictions in one place. (a) The documented mapping is not the implemented mapping — anyone reconstructing a version from `game_sessions.generator_version = 1001000` by reading the comment gets `1`, and the minor/patch encoding is undocumented there (`docs/PROJECT_CONSTITUTION.md` §21 discipline is versioned metadata, so the contract must be readable). (b) The SDK permits a `null` generatorVersion that the persistence mapping throws on. Today no game uses it — verified `grep -l '"generatorVersion": null' apps/mobile/src/games/*/game.json | wc -l` → `0`, and `sdk/__tests__/catalog-contracts.test.ts:187-205` actively fails any game that declares null — so the throw is latent, not live.
- Why it matters: if a future curated/non-procedural game follows `game-definition.ts` + `GAME_SDK.md` (both explicitly allow `null`) and the catalog test is relaxed for it, the throw happens inside the finalization `useEffect` (`games/speed-tap-rush/screen.tsx:200-282`). React routes an effect throw to the nearest boundary — the route's `<ErrorBoundary>` (`app/game/[id].tsx:144-163`) — so the player sees "Something went wrong" and the finished session is **never persisted**. Silent-looking loss of a completed session, at the one moment the player most expects a record.
- Root cause: the version→integer mapping was specified as "major" and implemented as a packing; the nullable branch of the SDK contract was left unreachable but never removed from the type.
- Recommended solution: pick one contract and make the other side follow it. Preferred: document the packing explicitly (e.g. `MAJOR * 1_000_000 + MINOR * 1_000 + PATCH`, plus the `Number.isSafeInteger` bound) since the db column is `INTEGER NOT NULL` with a row trigger asserting `typeof(...) = 'integer'` (`db/schema.ts:445-447`), and change `GameDefinition.generatorVersion` to non-nullable (`string`) so the SDK stops advertising a state the persistence layer rejects — the catalog test already enforces exactly that.
- Implementation considerations: the packing is already persisted in existing rows, so any change to the encoding is a data migration (`game_sessions` is append-only/canonical — see lane L01). Prefer fixing the docstring and the type over changing the encode function. `catalog/registry-membership.test.ts` already packs `gameVersion` and `scoringVersion` and asserts safe-integer range; extend it to `generatorVersion` and `contentVersion` so future versions cannot silently collide or exceed the range.
- Dependencies: `db/schema.ts` trigger, lane L01 (schema/migrations), the provenance validator (`scripts/validate-provenance.mjs` reads `game.json` directly, so it is unaffected), all 42 `versions.ts` copies.
- Risks: tightening `generatorVersion` to non-null touches `parseGameDefinitionJson` and the generator fixtures (which use `generatorVersion: '1'` — note that is not semver either, while the registry-membership test only `expectSemver`s non-null values).
- Validation required: `npx jest apps/mobile/src/sdk/__tests__/catalog-contracts.test.ts apps/mobile/src/sdk/__tests__/catalog/registry-membership.test.ts apps/mobile/src/governance/__tests__/registry-generator.test.ts`; `node scripts/generate-game-registry.mjs --check`.
- Completion criteria: the docstring states the exact encoding; no SDK type or doc advertises a `null` generatorVersion that `versionToNumber` rejects; the safe-integer bound is test-covered for all four version fields.

### L03-F05 — Shared finalization pattern consumes the once-per-session claim before validating the state it depends on (latent; 42 copies)
- Severity: P3
- Confidence: strongly indicated (defect confirmed by reading; reachability analysis says currently unreachable, so confidence in *impact* is lower than in the code shape)
- Category: correctness
- Files: `apps/mobile/src/games/speed-tap-rush/screen.tsx:200-210` (representative), `apps/mobile/src/components/game-host/use-game-session.ts:101` (declaration) / `:219-231` (implementation of `claimFinalize`), `apps/mobile/src/games/speed-tap-rush/reducer.ts:140, 259, 364, 395`
- Evidence:
  ```ts
  if (
    state.phase !== 'results' ||
    !session.claimFinalize() ||
    state.profile === null ||
    state.sessionId === null ||
    state.startedAtMs === null
  ) {
    return;
  }
  ```
  `claimFinalize()` is evaluated before the three null checks, and it is documented as returning true *"exactly once per session"* (`use-game-session.ts:101` declaration, `:219-231` implementation). All 42 screens contain `!session.claimFinalize()` (grep count 42).
- Problem: if `phase === 'results'` were ever reached with `profile`/`sessionId`/`startedAtMs` unset, the once-per-session token is consumed and the function returns without persisting — and because the token is spent it returns early on every subsequent render too, so the session is unrecoverable for the lifetime of that screen instance. I checked reachability and it is currently safe: `sessionId` is written only by `start-session` (`reducer.ts:140`), `phase: 'results'` is written at `reducer.ts:259` (session end) and `364`/`395` (`qa/force-win`/`qa/force-lose`), and both QA paths `return state` unless `state.phase !== 'intro' && state.profile !== null`, which requires a prior `start-session`. So this is a latent trap, not a live defect.
- Why it matters: the guard's correctness depends on an invariant that lives in a *different* file (the reducer) and is nowhere asserted. Any future early-results path (a "give up and see score" action, a QA force-state patch that bypasses `profile`, a game restoring a persisted session into `results`) turns a graceful no-op into permanent silent non-persistence of a completed session — the highest-value event the app records. The same fragile ordering is duplicated 42 times, so the fix is 42× a one-line reorder.
- Root cause: the effect was written as a single chained guard where the cheapest-to-check (phase) is first and the side-effecting claim is second, while the state requirements were appended in the order they were discovered.
- Recommended solution: read the state requirements before claiming — evaluate `state.profile === null || state.sessionId === null || state.startedAtMs === null` first, then `!session.claimFinalize()`. Better: give `useGameSession` a `tryClaimFinalize(requiredState)`-style precondition or make `begin()` the single place that guarantees the identity is stored, so the screen-level effect cannot observe `results` without identity.
- Implementation considerations: do not change `claimFinalize`'s exactly-once semantics — the crash-restart/double-render path in React (and StrictMode double-invoked effects in dev) relies on it, and the self-validating `session.isCurrentSession(record.id)` check in the persist callback already handles late responses. Reordering is behavior-preserving today, so it can land per game without coordination.
- Dependencies: 42 `screen.tsx` files; L03-F02's gate should assert the ordering once the pattern is stable.
- Risks: none behaviorally today; the change is only meaningful against future code paths, so it must not be bundled with a functional change or its effect cannot be measured.
- Validation required: `npx jest apps/mobile/src/games/speed-tap-rush/__tests__`; a unit test that dispatches `{type:'qa/force-state'}`/a synthetic `results` phase with `sessionId: null` and asserts persistence is still attempted after the reorder.
- Completion criteria: no screen consumes `claimFinalize()` before its state preconditions are checked; a test proves an incomplete-results state does not permanently disable finalization.

### L03-F06 — Documentation drift: GAME_SDK.md's module map omits two exported SDK modules; a catalog-size comment is stale
- Severity: P3
- Confidence: confirmed
- Category: docs-dx
- Files: `docs/GAME_SDK.md:53-69` (module map), `apps/mobile/src/sdk/index.ts:14` (`canonicalClamp01`) and `:88-105` (perf block), `apps/mobile/src/sdk/__tests__/catalog-contracts.test.ts:180-182`
- Evidence:
  - `sdk/index.ts` exports `canonicalClamp01` from `./numeric` and the whole `./perf` surface (`PERF_SCHEMA_VERSION`, `PERF_RING_CAPACITY`, `markGameSessionStart`, `markGameFirstInteraction`, `trackSessionPersist`, `trackProgressSnapshotLoad`, `getRecentPerfRecords`, `startPerfMeasure`, `markPerfEvent`), and `./timing` also exports `createMonotonicClock`. The `docs/GAME_SDK.md` "Module map" table lists only `version.ts, rng.ts, timing.ts, lifecycle.ts, pause.ts, audio-haptics.ts, tutorial.ts, testid.ts, types/*` — `numeric.ts` and `perf.ts` are absent, and the `timing.ts` row names only `systemClock, createFakeClock, Stopwatch, Clock, FakeClock`.
  - `catalog-contracts.test.ts:180` comments *"The catalog ships 36 games; a floor well below that catches a broken GAMES_ROOT resolution"* while `registry.generated.ts` and `PARITY_MATRIX.md` both carry 42 (verified: 42 `game.json` files, 42 registry entries, 42 loaders, and the per-category counts 7 Memory + 5 × 7 matching PARITY_MATRIX exactly).
- Problem: `docs/GAME_SDK.md` is the document a new coder packet is told to implement against ("used by all 42 catalog games"); a module map that silently omits `perf.ts` (the campaign-010 dev-only instrumentation seam the GameHost depends on, `game-host.tsx:20, 166`) and `numeric.ts` misdirects integration work. The stale "36 games" comment makes the catalog-size floor look more conservative than it is and will mislead the next person who raises it.
- Why it matters: low direct runtime impact, but this file is the contract-of-record for 42 modules and the audit's cross-check ("documentation claims are evidence to verify") shows it is already behind the code.
- Root cause: the module map was written for the Phase-1 skeleton and updated for campaign-010 modules (audio-haptics-real, tutorial) but not for `numeric`/`perf`, which are also exported through the barrel.
- Recommended solution: add `numeric.ts` and `perf.ts` rows to the module map (noting `perf` is dev-only/no-op in release and that `trackSessionPersist`/`markGameFirstInteraction` are the call sites the host owns), extend the `timing.ts` row with `createMonotonicClock`, and update the catalog-size comment to 42. If the map is meant to be authoritative, prefer generating it from `sdk/index.ts` in the same deterministic style as the game registry.
- Implementation considerations: `perf.ts` is explicitly a no-op in production builds (`sdk/index.ts:88-89` comment), so the doc must state the dev-only boundary or it will invite production call sites. `docs/GAME_SDK.md:3` already asserts "used by all 42 catalog games", which matches the registry — keep that number and fix the test comment to match, not the reverse.
- Dependencies: none (documentation only); coordinate with whichever lane owns `docs/**`.
- Risks: none.
- Validation required: `grep -c '^| ' docs/GAME_SDK.md` sanity vs the barrel exports; review-only.
- Completion criteria: every module re-exported by `sdk/index.ts` appears in the module map; the catalog size stated in the test comment equals `registry.length`.

## Checked and found clean
- **Registry determinism and gating (check 6).** `node scripts/generate-game-registry.mjs --check` → `registry generator: generated registry is up to date`, exit 0. Output is id-sorted (`.sort()` at `scripts/generate-game-registry.mjs:130`), contains no timestamps and no absolute paths, and is emitted from a pure in-memory pipeline. `--check` is a real CI step in `.github/workflows/app-ci.yml:46-48`, `android-build-smoke.yml:79`, `ios-build-smoke.yml:53`, plus `validate-repo-state.mjs` in all four workflows. Registry/`game.json` staleness is independently guarded by `sdk/__tests__/catalog/registry-membership.test.ts:101-125` (deep-equality of embedded metadata against on-disk `game.json`).
- **Generator ↔ SDK contract parity.** The generator mirrors `defineGame`/`parseGameDefinitionJson` checks and has `--self-check` fixtures pinned by `governance/__tests__/registry-generator.test.ts`. The previously-recorded drift (`generatorVersion: ""` / missing `description`) is closed in `docs/hardening/post067/PASS_A_STATIC.md:13` — not re-reported.
- **Registry ordering/uniqueness/counts.** 42 entries, ids unique and ascending; category distribution matches `docs/PARITY_MATRIX.md` (Memory 7, Attention/Flexibility/Language/Logic/Math/Spatial/Speed 5 each).
- **Startup wiring and bootstrap classification (check 6/7 adjacent).** `registerGameDefinitions(registry)` is wired exactly once, in `runBootstrap`'s `catalog-registry` stage (`app/_layout.tsx:155-157`). `runBootstrap` (`bootstrap/run-bootstrap.ts:150-179`) fails fast on foundational stages (`database`, `catalog-registry`, `progression`) with a `recovery-required` outcome naming the stage, degrades `preferences` to safe defaults, never throws for stage failures, and is documented idempotent per stage.
- **RNG determinism and seed derivation (check 8).** `sdk/rng.ts` uses xmur3 → mulberry32 with `Math.imul`/`>>>` only (ECMA-262-specified integer math, so identical on Hermes/V8/JSC); `normalizeSeed` makes `42` ≡ `'42'`; `fork(salt)` derives `${canonical}::fork::${salt}` so sub-streams are stable and independent; `pick` throws on an empty array and `shuffle` never mutates its input. `canonicalSeedToNumber` documents its mapping as a permanent invariant and is the single shared implementation (`session.ts` re-exports it). No generator, reducer, scoring, or session file in any of the 42 games calls `Math.random` — the only hit is a comment (`games/flexibility-task-switch/generator.ts:21`). `Math.random` is used in `session-identity.ts` solely to draw the *session seed and id*, which the module doc correctly frames as "INPUT, never generator content".
- **Session identity uniqueness (check 3).** `createSessionId` combines `Date.now().toString(36)`, a process-wide incrementing counter, and a random suffix, so same-millisecond creations cannot collide; `resolveSessionSeed` passes injected fixed seeds through verbatim for tests/QA.
- **Error containment (check 7).** `<ErrorBoundary>` (`components/error-boundary.tsx`) wraps the lazy game subtree at `app/game/[id].tsx:144-163`, logs structured JSON with `gameId`/stack/componentStack, announces the failure to screen readers, and its Try Again remounts via an incrementing `resetKey` rather than re-rendering the crashed instance. Reducer throws surface during render (reducer runs in render) and effect throws surface to the same boundary, so both are contained to the game screen — the shell is not taken down. Persistence failures are separately contained in-band: `persistTapRushSession` catches, logs, and returns `{ ok: false, error }` → `persistence-failed` action, so the game never crashes on a db error. Event-handler throws are outside React-boundary scope by platform design — none found in the traced paths (`handleFieldTap` resolves the transition through the pure reducer before dispatch and reads only `stateRef`).
- **BackHandler and AppState symmetry (check 2).** One hardware-back subscription in `game-host.tsx:170-181`, keyed on `[interceptBack]` with `subscription.remove()` cleanup, reading `paused`/`onPause` through a ref so it is not re-subscribed per render; consumed in both states by design (audit B6 anti-abandonment). All 42 screens pass `interceptBack={inSession}`-style truthy values. One AppState subscription in `use-game-session.ts:159-168`, removed on unmount; no game screen adds its own (grep: `AppState` appears in screens only in comments).
- **Timer/animation symmetry (check 2).** `useGameInterval`, `useGameTimeout`, and `useGameDeadlineTimeout` (`components/game-host/timers.ts`) each return a cleanup that clears the timer and keep the callback in a ref so handler identity changes do not restart the interval; `useGameDeadlineTimeout` deliberately preserves remaining budget across a pause using the injected clock. The single `Animated.loop` in the app is in `components/ui/skeleton.tsx`; every `Animated.timing` pop used by games stops the animation in its effect cleanup (`games/speed-tap-rush/screen.tsx:99-101` and four sibling games).
- **Provenance drift gate is real and not a silent no-op (check 5).** `validate-provenance.mjs --check` runs in `app-ci.yml:57-72`, `android-build-smoke.yml:72-90`, `ios-build-smoke.yml:46-64` with the base resolved `github.event.before` → PR base sha → `HEAD^`, each `git rev-parse --verify`-checked, and the validator fails closed when the base is unresolvable. The `SCORING_VERSION` extraction reads `games/<id>/versions.ts` and the regex matches all 42 declarations (verified: 7 distinct literals, all plain single-quoted strings). Allowlist entries require a non-empty `reason` and a future `expires`; permanent/malformed entries are treated as absent. `--self-test` and `--check-allowlist` are wired into `repository-integrity.yml:70, 81`.
- **Version metadata persistence path.** `game_sessions` stores `game_version`/`generator_version`/`scoring_version` as `INTEGER NOT NULL` with row triggers enforcing integer type (`db/schema.ts:55-57, 445-447`); the full semantic strings also travel in the raw result and `DiagnosticMetadata` (`session.ts:100-152`), so the integer packing is not the only record. `catalog/registry-membership.test.ts:126-150` asserts every declared `gameVersion`/`scoringVersion` survives packing as a safe integer > 0.
- **Doc truth — PARITY_MATRIX catalog claims (check 9).** The per-category game counts in `docs/PARITY_MATRIX.md` ("7 games" Memory, 5 each elsewhere) match `registry.generated.ts` exactly, and the named games per category match the registry ids. `GAME_SDK.md`'s `SDK_VERSION = 0.1.0` and `RNG_ALGORITHM_VERSION = 'mulberry32-v1'` claims match `sdk/version.ts:11, 21`. Its statement that the SDK `XpRatingHook` remains a no-op seam with real rating in `src/rating/**` matches `sdk/types/results.ts` (`noopXpRatingHook`) and the finalization path.

## Not covered / could not verify
- **Runtime/device behaviour.** No emulator, APK install, or host input per the lane's absolute rules; all findings are static or unit-level.
- **The 41 non-representative game screens**, beyond the grep classes listed in "Scope covered" (`interceptBack`, `claimFinalize`, `AppState`, `BackHandler`, `Animated` cleanup, `Math.random`). Per-game lifecycle asymmetries outside those classes are not covered; a screen that is structurally unusual would need its own read.
- **`useGameDeadlineTimeout`'s remaining-budget arithmetic** (`timers.ts:81-120`) was read only in part; the pause-resume re-anchoring was verified in `speed-tap-rush`'s screen, not in the helper's own edge cases (zero-duration, `resetKey` reuse).
- **Cross-engine RNG equivalence** is asserted by the module doc and `sdk/__tests__/rng.test.ts` on the Node/Jest engine only; Hermes/JSC agreement is not executed here.
- **Whether `generate-game-registry.mjs --check` detects a hand-edited (rather than stale-generated) registry** — only the green state was exercised; the `--check` diff path itself was read, not fault-injected.
- **`sdk/types/qa.ts` `assertDevOnly()`/`isDevBuild()` effectiveness in a production bundle** (whether dev-only QA entry points are genuinely unreachable in release) — out of this lane's budget; `catalog-contracts.test.ts:308` covers it structurally.
- **Absence-of-write-tool caveat:** none; this lane's only output is this report file.

## Contradictions with existing documentation
1. `docs/GAME_SDK.md:53-69` module map omits `numeric.ts` and `perf.ts`, both exported by `apps/mobile/src/sdk/index.ts`, and omits `createMonotonicClock` from the `timing.ts` row. (L03-F06)
2. `apps/mobile/src/games/*/versions.ts` docstring says `versionToNumber` returns "the numeric major component" while it returns `major*10^6 + minor*10^3 + patch`; and it says `null` is "rejected" while `sdk/types/game-definition.ts:47-60` and `docs/GAME_SDK.md:34-36` both permit `generatorVersion: null`. (L03-F04)
3. `apps/mobile/src/sdk/__tests__/catalog-contracts.test.ts:180` comments "The catalog ships 36 games" while the registry, `PARITY_MATRIX.md`, and `docs/GAME_SDK.md:3` all state 42. (L03-F06)
4. `apps/mobile/src/sdk/__tests__/catalog-contracts.test.ts:231-234` claims to verify that every screen "drives SessionLifecycle, auto-pauses on background, abandons on quit", but by construction it verifies the shared host sources for all 42 delegating screens. (L03-F02)
5. `docs/GAME_SDK.md:3` says the concrete API is "used by all 42 catalog games" — true for the metadata contract, but the behavioral requirements in "Required concepts" are not enforced by any type or shared gate. (L03-F01)
