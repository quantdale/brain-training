# Tasks — Campaign 042

## Discovery and isolation

- [x] Reproduce the SQLite startup NPE in a release/runtime-teardown path.
- [x] Inspect the local Expo SQLite implementation and classify the upstream
      cached-handle/runtime-teardown defect.
- [x] Reproduce the font-scale-2 Results CTA clipping and define the smallest
      local repair.

## Bounded implementation

- [x] Serialize Expo SQLite work by native handle and use a fresh app
      connection after runtime reloads.
- [x] Coalesce concurrent database initialization without changing the schema.
- [x] Apply and test the local large-text Results hero density repair.

## Runtime and persistence

- [x] Revalidate the three named game result lifecycles with real mechanic
      observations and explicit QA completion labeling.
- [x] Revalidate release route/theme, responsive, relaunch, favorite, theme,
      pause/resume, offline, and direct SQLite invariants.

## Closure

- [x] Run full local tests, builds, repository validators, and OpenSpec checks.
- [x] Recheck external CI without converting pre-step failures into green.
- [x] Perform and record the adversarial second pass and human/platform
      boundary.
- [x] Synchronize durable state and commit/push the terminal evidence packet.
