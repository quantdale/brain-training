## 1. Adapter

- [x] 1.1 Add a write-through/hydrating store over `TutorialRepository` (sync get after hydrate; durable set).
- [x] 1.2 Await the SQL upsert on production complete/skip so a crash before write does not claim success.

## 2. Injection

- [x] 2.1 Hydrate in `app/game/[id].tsx` (or GameHost) and pass `tutorialStore` into the lazy screen; do not flash tutorial before hydrate.
- [x] 2.2 Keep in-memory default for unit tests that omit the prop.

## 3. Tests

- [x] 3.1 Repository-backed lifecycle: complete → new connection → `shouldShowTutorial` false.
- [x] 3.2 Replay request survives restart; QA skip still `assertDevOnly`.
- [x] 3.3 Export → wipe → import after a gameplay complete skips first-play.
- [x] 3.4 Catalog or route test that production path no longer uses a fresh in-memory store as the only store.

## 4. Verification

- [x] 4.1 `tsc --noEmit` and targeted tutorial/game-route Jest PASS.
- [x] 4.2 Update `docs/GAME_SDK.md` sentence that currently says in-memory is the production default.
