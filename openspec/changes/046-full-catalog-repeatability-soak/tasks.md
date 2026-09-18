# Tasks — Campaign 046

- [x] Freeze the generated 42-game roster and define lifecycle evidence classes.
      See `docs/redesign/evidence/campaign046/CATALOG_LIFECYCLE_MATRIX.md`.
- [x] Build/install the current validation artifact and verify the dedicated
      `emulator-5554` / ARTEMIS lane.
- [x] Collect current detail/start/first-interactive evidence for all 42 games.
      The lifecycle matrix records the catalog-runner/manual follow-up result.
- [x] Collect legitimate result, persistence, and return-navigation evidence
      for all games using supported deterministic QA assistance where needed.
- [x] Repeat complete lifecycles with real mechanic interaction across all
      eight domains/mechanic families and distinguish the evidence classes.
- [x] Inspect SQLite integrity, duplicate session/rating/currency operations,
      stale metadata, and filtered runtime logs.
- [x] Write the Campaign 046 evidence packet, update durable state, commit,
      and push a coherent checkpoint.

Validation summary: the final pull contained 44 sessions across all 42 game
IDs, 44 ledger rows, and 87 rating-history rows; SQLite integrity was `ok`,
foreign-key violations were zero, duplicate identity/operation checks were
empty, and the focused persistence/portability run passed 312 tests in 28
suites with one skipped test.
