# Audit map — persistent-game-tutorials

| Item | Evidence |
|---|---|
| In-memory default | `games/memory/hooks.ts` (and 41 siblings) `createInMemoryTutorialStore()` |
| Route comment, no inject | `app/game/[id].tsx` "getDb().tutorials (see task 5.1)" |
| Async vs sync | `db/tutorial.ts` Promise vs `sdk/tutorial.ts` sync `TutorialStore` |
| 006r 5.3 marked done | `openspec/changes/006r-core-integrity-correction/tasks.md` |
| Isolated tests | `src/__tests__/tutorial-persistence.test.ts` talks to repository, not screens |
