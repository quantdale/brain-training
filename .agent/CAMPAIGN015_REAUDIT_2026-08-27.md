# Campaign 015 Re-audit — Current-HEAD Convergence & Workout Integrity

**Audited HEAD:** `366a098527876e2c4c7448526bcdebcb686a59c6`  
**Audit date:** 2026-08-27  
**Lifecycle:** planning evidence only; Campaign 014 remains ACTIVE and Campaign 015 remains PROPOSED.  
**Supersedes:** no historical evidence. Read this together with `.agent/CAMPAIGN015_AUDIT.md`; current code/CI outrank both when they differ.

## Audit scope and method

This re-audit was performed against the complete recursive tracked tree plus targeted source-level review of every first-class subsystem and the highest-risk implementation paths. The tracked corpus at the audited HEAD contains **1,767 files (~12.9 MB)**, including **1,047 `.ts`**, **373 `.tsx`**, **214 `.md`**, and **64 `.json`** files. The application source tree contains **1,461 files** and the catalog contains **42 game modules**.

The review covered repository governance/OpenSpec, GitHub Actions, package/configuration, navigation/shell, Game SDK/registry/provenance, all 42 game-module structures, persistence/migrations, session completion, rating/progression/economy, workouts/personalization/mastery/spotlight, quests/achievements/rewards, sync/data portability, accessibility/design primitives, offline boundary, QA/autobot, docs/state recovery, and current CI evidence. Test topology was cross-checked against source topology: the repository has **491 test files**, including **311 game tests**.

This is not a claim that a connector rendered all 1,767 files line-for-line in one response. The complete tree was enumerated, file/system coverage was mapped, high-risk and anomalous files were opened directly, current commits were diff-reviewed, and the exact failed GitHub Actions job log was inspected. Any implementation agent must still re-read touched files before editing.

## Executive verdict

`main` is **not currently green**. Repository Integrity is green on the audited HEAD, but App CI is red at Jest. The red build is caused by a newly introduced workout-routing heuristic that contradicts existing correctness tests. This is a P0 predecessor-closure defect and must be repaired before Campaign 014 can be declared complete or Campaign 015 can activate.

The previous Campaign 015 direction remains correct—governance truthfulness plus depth convergence—but the next executor must start from current reality, not the older `c8acad` planning snapshot.

## P0 — current HEAD is red

GitHub Actions run `33051125658` for App CI on `366a098` failed in `Unit tests (jest, CI mode)`. Typecheck and lint passed before the failure. Exact Jest summary:

- 2 failed suites, 481 passed, 4 skipped (483 of 487 executed/reported);
- 2 failed tests, 5,971 passed, 5 skipped (5,978 total);
- failing suites: `src/db/__tests__/workout-v2.test.ts` and `src/workout/__tests__/advance.test.ts`.

The failures are both caused by the 10-second timestamp tolerance introduced in `d332e508`:

- `WorkoutRepository.findActiveInstanceForGame()` accepts `completedAt > instance.updatedAt - 10_000`;
- `shouldAdvanceWorkout()` independently applies the same policy through `ADVANCE_TIMESTAMP_SLACK_MS = 10_000`.

That makes an equal timestamp eligible and also makes sufficiently recent historical results eligible. The existing tests correctly expose both regressions. Do **not** make the suite green by weakening those tests unless a new, stronger ownership invariant proves the behavior safe.

## P0 — workout ownership is inferred, not attributed

`GameSessionRecord` has no durable workout-instance identity. `useWorkoutResultAdvance()` therefore asks the repository to infer ownership from `(gameId, completedAt)` and chooses the most recently updated active workout whose current game matches. This is ambiguous when daily/template workouts overlap, when the same game appears in multiple active instances, when a historical result is opened soon after a workout starts, or when wall-clock ordering is imperfect.

The 10-second grace window treats a causal-identity problem as a clock-tolerance problem. Campaign work must establish a correctness-preserving attribution invariant. Preferred direction: carry an explicit workout instance key / leg identity through game launch → persisted session → results → idempotent advance. A different design is acceptable only if it proves equivalent safety without an arbitrary positive grace window and remains backward-compatible with legacy sessions.

Required adversarial cases include: historical result inside any former grace window, equal timestamps, clock skew, rapid first completion, two active instances with the same current game, repeated game IDs, relaunch/result re-view, duplicate completion delivery, stale hook state, catalog reconciliation, and standalone play.

## P0 — governance can still report green while the product build is red

`scripts/validate-repo-state.mjs` still validates an active OpenSpec package only when the matching directory happens to exist, with a one-off missing-directory failure for `006r-core-integrity-correction`. Campaign 014 has no matching OpenSpec directory, so Repository Integrity can pass without proving the active campaign package.

`.agent/task-ownership.json` still names `006r-core-integrity-correction` and uses historical `src/**` write paths instead of the current `apps/mobile/src/**` topology. `scripts/validate-task-ownership.cjs` checks overlap/dependency existence but does not bind the map to the active governance/OpenSpec campaign. App CI therefore reports this stale ownership gate as green.

## P1 — durable recovery state is stale against pushed history

`.agent/STATE.md` still describes Campaign 014 around `f4aa44c` and labels the August 27 workout/harness repair as a `working state` / `unpushed`, even though those edits were committed in `d332e508` and followed by `366a098`. A recovery document that says pushed code is unpushed can send a fresh autonomous agent down the wrong branch of work.

Campaign 015 must make recovery state mechanically bind to active campaign/status and, where practical, a recorded observed/head SHA or freshness marker. Historical prose may remain, but it must not masquerade as current machine state.

## P1 — tracked root residue remains

The complete tree still contains two zero-byte root artifacts identified by the previous audit: `'` and `i.startsWith('home')`. They remain a direct repository-hygiene defect and prove the cleanup task has not landed.

## P1 — test topology is broad but integration seams deserve targeted pressure

All 42 game modules have dedicated tests, and the game area has 311 test files. Aggregate volume is not the issue. Lower test/source ratios cluster in `speed-order-sweep`, `math-value-ordering`, `language-context-fit`, and several memory/language modules. More importantly, the five `app/(tabs)` source screens total roughly 120 KB of application/UI orchestration with no co-located direct tests. Do not add shallow snapshots for coverage percentage; add integration tests only for high-risk routing/state semantics that unit modules cannot prove.

Current App CI also reports 4 skipped suites / 5 skipped tests and emits React overlapping-`act()` warnings in at least one component accessibility suite. Inventory and classify these; intentional environment-gated skips may remain documented, but accidental skip/warning noise must not become invisible debt.

## P1 — existing depth findings remain high-value

The earlier 015 audit remains applicable unless current code proves otherwise:

- Logic Rule Grid remains a high-priority redesign target: higher difficulty must require solver-proven dependent inference rather than magnitude-only scaling.
- Language Word Chain remains content-starved and needs at least 90 curated/validated chains with balanced tier coverage.
- Language Context Fit needs at least 60 validated items per tier (>=180 total) plus ambiguity/grammar-leak defenses.
- Spatial Transform Match needs one final invariant boundary, exact option counts, deterministic feasible fallbacks, and unambiguous hidden-source semantics.

These are depth/convergence tasks. Do not add game #43.

## P2 — harness waits must not substitute for product readiness

`scripts/qa/autobot.mjs` has accumulated long recovery/poll budgets, including the latest 30-second wait for workout templates after relaunch and extended polling for completion state. Resilience is useful, but a harness must not turn a product-side stale-read/readiness problem into a delayed green. Record readiness timing and distinguish: app state not ready, UI tree transport failure, Metro/emulator infrastructure failure, and true assertion failure. Prefer event/state observability to arbitrary sleeps.

## P2 — typed-route and warning debt

The Home tab contains route casts such as `href={"/progress" as any}` / `href={"/rewards" as any}`. These weaken typed-route guarantees. Inventory these escapes and remove only where the current Expo Router type surface supports a clean typed route; do not churn routing merely for aesthetics.

## Strong surfaces — do not rewrite without evidence

The audit found strong structural coverage around SQLite migrations/invariants, transactional session completion, rating/economy ledgers, data-portability rollback/roundtrip paths, deterministic workout selection/repeated-use simulation, registry/provenance/offline validators, the 42-game module contract, and CI typecheck/lint/test/export/doctor sequencing. Preserve these boundaries; repair precise invariants instead of launching speculative architecture rewrites.

## Priority order for the next executor

1. Restore green `main` by fixing workout attribution/routing correctness; rerun the exact failing suites, full Jest, and CI.
2. Close Campaign 014 honestly: dedicated project AVD Workout V3 journeys, canaries, perf/game-feel evidence, docs/state reconciliation, terminal checkpoint.
3. Only then atomically activate Campaign 015.
4. Execute governance/OpenSpec/ownership/affected-area truthfulness work.
5. Execute workout-attribution hardening plus Rule Grid / Word Chain / Context Fit / Transform Match convergence.
6. Run targeted accessibility/performance evidence, test-warning/skip inventory, and high-value integration seams.
7. Converge all local gates and require App CI + Repository Integrity green on the exact final pushed SHA.

## 12-hour execution intent

The handoff is designed for one autonomous **12-hour execution envelope**. It is not permission to waste time to hit a clock. Continue through the dependency graph for the full available session while useful in-scope work remains. If a device/infrastructure gate blocks Campaign 014, record it honestly and execute only predecessor-safe diagnostic/documentation work; do not activate 015. Before termination, leave a durable checkpoint, exact validation state, clean commits, and push all coherent work.
