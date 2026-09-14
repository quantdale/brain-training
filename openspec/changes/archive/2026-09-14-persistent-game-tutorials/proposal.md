# Proposal — Persistent game tutorials

## Why

Constitution §12 and 006r require first-play tutorials to stay completed across app restart and remain replayable from help. Production screens default to `createInMemoryTutorialStore()`. `TutorialRepository` exists and is exported/imported with backups, but the game route never injects it. Completing "How to play" does not skip after process death. 006r task 5.3 is marked done; the living code does not match.

## What Changes

- Production game construction MUST use a store that reads/writes `tutorial_state` (via `getDb().tutorials`) so completion survives kill/relaunch.
- Help/replay MUST still force-show; QA skip remains `assertDevOnly`.
- SDK `TutorialStore` may stay synchronous if a hydrating/write-through adapter is used; do not leave the async repository unwired.
- Tests MUST prove: complete → new db/session → `shouldShowTutorial` is false; import/export still round-trips rows that gameplay actually writes.

## Capabilities

### New Capabilities

- `persistent-tutorial-store`: production tutorial lifecycle is backed by SQLite `tutorial_state`, not a process-local map.

### Modified Capabilities

- (none in main `openspec/specs/`; implements 006r `tutorial-lifecycle`)

## Impact

- `apps/mobile/src/sdk/tutorial.ts` (optional async or adapter)
- `apps/mobile/src/db/tutorial.ts` (`TutorialRepository` is async vs sync store)
- `apps/mobile/src/app/game/[id].tsx` (comment already names the unused seam)
- 42 `games/*/hooks.ts` default store injection — prefer **one** route-level injection over editing 42 defaults if the route can pass the store
- `apps/mobile/src/__tests__/tutorial-persistence.test.ts` (today talks to the repository, not the screen)
- Data-portability already serializes `tutorial_state`

## Out of scope

- Rewriting tutorial content or bumping per-game tutorial versions (versioned re-show MAY be a follow-up)
- Changing first-play copy

## Evidence

- Every sampled `hooks.ts` defaults `store: TutorialStore = createInMemoryTutorialStore()`.
- `game/[id].tsx` header: "Tutorial persistence is available via getDb().tutorials (see task 5.1)" — not passed into screens.
- `TutorialRepository.getTutorialState` returns `Promise<…>`; SDK `TutorialStore` is synchronous; no `implements TutorialStore` adapter exists.
- `docs/GAME_SDK.md` still describes the in-memory store as the current default.

## Dependencies

None. Data-portability already understands the table.

## Intended outcome

A player who finishes a game's tutorial, kills the app, and relaunches that game does not see the first-play tutorial again unless they request replay from help.
