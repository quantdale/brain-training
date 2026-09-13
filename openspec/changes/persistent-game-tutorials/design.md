## Context

SDK `TutorialStore` is **synchronous**. `TutorialRepository` is **async** (`Promise`). 42 `hooks.ts` files default to `createInMemoryTutorialStore()`. `app/game/[id].tsx` comments that `getDb().tutorials` exists and does not pass it. Tests in `tutorial-persistence.test.ts` exercise the repository in isolation, so they stay green while gameplay never writes the table. Data-portability already round-trips `tutorial_state`.

## Goals / Non-Goals

**Goals:** production first-play skip survives process death; replay/help still works; QA skip stays dev-only.

**Non-Goals:** making all 42 reducers async; bumping per-game tutorial content versions.

## Decisions

1. **Do not make `TutorialStore` async in this change** (would touch every game). Add `createWriteThroughTutorialStore({ initial, persist })` that is sync for `get`/`set` and fires `void persist(gameId, state)` on set, **awaited** at complete/skip before the intro dismisses if the screen can await — or hydrate fully before first paint.
2. **Preferred injection: game route, not 42 hook defaults.** `game/[id].tsx` loads `getDb().tutorials.getTutorialState(id)` (and optionally all rows) into the write-through store and passes `tutorialStore` into the lazy screen. Screens already accept `tutorialStore?: TutorialStore`.
3. **Hydrate-before-paint.** Until hydration resolves, keep the existing GameNotReady/Suspense path or a local loading flag so we never flash the tutorial then hide it.
4. **Write-through must not drop errors silently on complete.** If persist rejects, keep tutorial open or surface the same danger-toast pattern; do not mark local completed if the row did not land (otherwise restart shows tutorial anyway — confusing). Smallest correct: await upsert in `complete` via an async wrapper used only from the screen's `onComplete` path if the sync store cannot await. Practical approach: `TutorialLifecycle.complete` stays sync for tests; production screen `onComplete` calls `await db.tutorials.setTutorialState` **and** `lifecycle.complete`.
5. **Adapter for tests:** keep in-memory default in hooks for unit tests that do not pass a store.

## Risks / Trade-offs

- Race: complete in-memory then crash before SQL upsert → tutorial reappears (honest). Await SQL in the production complete handler.
- 42 screens each call `createXTutorialLifecycle(tutorialStore)` — route-level prop already exists; verify a catalog source test that production screens pass the prop through from props (they already do).

## Testing strategy

- Integration: migrated db → write-through store → complete → new `TutorialRepository` on a new adapter clone / reopen → `shouldShowTutorial` false.
- Screen test: pass a recording store; production-shaped helper that uses the repository.
- Negative: `__DEV__ === false` skip still throws.
- Portability: complete via store, export, wipe, import, shouldShow false.
