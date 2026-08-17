# 006 — Persistent Tutorial Lifecycle and Game Entry Contract

**Priority:** P1/P2  
**Depends on:** 001  
**Primary surfaces:** Game SDK tutorial contract, app-level provider/bootstrap, profile/DB persistence, game tutorial hooks, registry metadata  
**Shared-file owner:** orchestrator

## Problem statement

The SDK tutorial lifecycle defaults to `createInMemoryTutorialStore()`. Game hooks commonly use that default when no store is injected, and the dynamic game route renders game screens without a persistent tutorial-store dependency. Tutorial completion therefore does not have a durable product-level owner and can be lost across remount/restart.

Campaign 006's tutorial-style consistency work must not be considered complete until lifecycle persistence is correct.

## Required behavior

For every game with `hasTutorial: true`:

1. First eligible play shows the short tutorial.
2. Completing it records durable completion.
3. App restart/remount does not show it again automatically.
4. Help/How-to-play can request replay at any time without erasing completion history.
5. After replay is dismissed/completed, normal first-play state remains completed.
6. QA may skip instantly only in dev/QA builds.
7. If a tutorial is materially changed in a future release, the product can intentionally show the new version again without deleting unrelated profile data.

## Design requirement: version tutorials

Add an explicit tutorial version to the game metadata or a deterministic default governed by the registry contract. Recommended:

```json
{
  "hasTutorial": true,
  "tutorialVersion": 1
}
```

Persistence key semantics must include `gameId + tutorialVersion` (or equivalent) so a future tutorial version can be independently completed.

Do not use `gameVersion` as the tutorial version unless an ADR explains why every game-code change should invalidate tutorial completion.

## Persistence architecture

The current `TutorialStore` is synchronous while SQLite APIs are asynchronous. Do not fake synchronous DB I/O.

Recommended architecture:

- app bootstrap loads persisted tutorial-completion state before interactive game entry;
- a shared app-level `TutorialStoreProvider` owns an in-memory synchronous mirror compatible with the SDK interface;
- `setTutorialState` updates the mirror immediately and persists through a serialized async persistence adapter;
- failed persistence is logged/surfaced as appropriate and retried safely; the next launch reflects only successfully persisted state;
- tests can inject the existing in-memory store directly.

Persistence can use either a dedicated SQLite table or a well-versioned profile-settings structure. A dedicated table is preferred if it materially simplifies migration/query correctness. If profile settings are used, update must merge safely with theme/streak/settings data rather than replacing unrelated keys.

If a dedicated table is chosen, suggested fields:

```text
game_id
tutorial_version
completed_at
replay_requested (only if replay state itself must survive restart)
updated_at
PRIMARY KEY(game_id, tutorial_version)
```

Replay-request persistence is optional; the core requirement is durable completion. Document the chosen behavior.

## Shared Game SDK contract

Refactor only as much as needed so games do not each create their own default transient store in production.

Preferred rule:

- tests/story fixtures may construct local in-memory tutorial lifecycle;
- production game screens obtain the shared tutorial lifecycle/store from the app platform layer;
- a missing provider in production should be a clear programming error or an explicitly documented safe fallback, not silently reset tutorials every mount.

Avoid importing SQLite directly into every game module.

## 20-game convergence

Audit all registered game hooks/screens for:

- tutorial lifecycle source;
- `shouldShowTutorial` first-play check;
- completion path;
- replay/help path;
- QA skip path;
- dev-only protection;
- stable testIDs;
- tutorial version metadata.

Use a shared helper/contract test where possible rather than 20 divergent implementations.

The visual `intro → demo → done` consistency packet may be reconciled after lifecycle persistence. Do not force every mechanic into an identical demo if a game requires a different interactive teaching step; the behavioral contract is more important than cosmetic uniformity.

## Required tests

### Store/provider tests

- hydrate completed state from persistence;
- first-play unseen -> show;
- complete -> mirror updated -> persistence updated;
- remount provider with persisted state -> do not show;
- request replay -> show despite completed;
- complete replay -> return to completed/no replay;
- unrelated game completion unaffected;
- tutorial version N completion does not automatically complete N+1;
- persistence update preserves unrelated profile/settings if that storage model is chosen.

### Game contract tests

For all registered tutorial games, programmatically verify tutorial metadata and production lifecycle integration.

At least three representative screen tests must prove:

- unseen tutorial opens;
- completion prevents second automatic opening after remount with hydrated store;
- Help forces replay;
- QA skip throws/is unavailable outside dev contract.

### Emulator test

On the dedicated AVD:

1. clear app data;
2. open one representative game -> tutorial appears;
3. complete tutorial;
4. force-stop app;
5. relaunch and reopen game -> tutorial does not auto-open;
6. tap How to play -> tutorial opens;
7. complete/dismiss -> normal play remains available.

Capture screenshots/hierarchy/logs as evidence.

## MUST acceptance criteria

- Production no longer depends on a per-mount in-memory tutorial store.
- Tutorial completion survives app restart.
- Replay remains available.
- Tutorial versioning exists.
- All registered tutorial games conform to the shared lifecycle contract.
- No direct SQLite dependency is duplicated into game modules unless strongly justified.
- Targeted tests, full suite, typecheck, and emulator restart evidence pass.

## Forbidden shortcuts

- Persisting only a single global `tutorialDone` boolean.
- Treating game component lifetime as durable state.
- Making `TutorialStore` methods async without updating every synchronous caller correctly.
- Swallowing persistence errors and claiming completion is durable.
- Replacing the whole profile settings JSON when updating tutorial state.