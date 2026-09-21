# Change 065 — Adversarial Convergence: Runtime, Data, Pixels

**Status:** IN_PROGRESS
**Predecessor:** `064-dependency-security-validation-gates` (VALIDATED)
**Program SHA:** `428d293`
**Theme:** 065–066 adversarial convergence (find what earlier changes missed).

## Problem / evidence

Change 064 closed with a green matrix but an adversarial premise: six
independent critic lanes (source/runtime, tests, data/persistence,
pixels/a11y, governance/artifact, reintro-guards/repeatability) attacked
the tree at `a9111c3`. They found real residual gaps that no existing
gate would catch. Each finding below was verified against the code at
HEAD (all lanes read-only; no claim taken on trust).

**Source/runtime:**
1. A validation-valid **replace import** whose profile carries the current
   `progressionSeedVersion` fingerprint while `questDefinitions` /
   `achievementDefinitions` are empty causes `ensureProgressionDefinitions`
   to skip seeding; `syncQuestProgress`/`syncAchievements` then insert
   child rows with no parent → `FOREIGN KEY constraint failed` in
   bootstrap → **permanent BootstrapRecovery loop** (only reinstall
   escapes). Verified chain: `progression/seeding.ts:69-88`,
   `data-portability/apply.ts` replace path, `db/quests.ts`,
   `db/schema.ts` FK, `bootstrap/run-bootstrap.ts`.
2. `initDatabase()` re-entry (Retry after a post-success bootstrap
   failure) opens a second native connection and overwrites the singleton
   without closing the first; each retry leaks a handle and creates a
   second write queue (`db/index.ts:187-198`; 059 closed only the
   failure path).
3. Wipe/Replace import never emits `emitWorkoutChanged()`, so Home keeps
   rendering the deleted workout (dead Reroll, standalone save) until
   remount (`app/data-management.tsx` vs `workout/use-workout.ts`,
   `workout/events.ts`).
4. PB badge can fire for a future-dated (imported) session because
   `atOrAbove <= 1` is true for 0 (`app/results.tsx:99-104`).

**Data/persistence:**
5. `PRAGMA foreign_keys = ON` is applied only to the main expo-sqlite
   connection; `db.transaction()` runs on a **new connection** via
   `withExclusiveTransactionAsync`, where the pragma is never set
   (SQLite default OFF). Transactional writes therefore have no FK
   enforcement on device; the Node test adapter sets the pragma on its
   single connection, so no test can catch it
   (`db/adapters/expo.ts:74-85`, `db/adapters/node.ts:14`).
6. `reconcile()` / `persistRepaired()` are blind read-modify-write (and a
   blind DELETE) that can clobber a concurrent `advanceForSession` CAS
   commit, replaying a completed leg or deleting the instance
   (`db/workout.ts` repair path; 056/059 CAS covered advance/reroll only).
7. `applyReroll` CAS omits `game_ids_json`, so a repair landing between
   its read and write is overwritten (`db/workout.ts:493-505`).
8. The streak-item purchase passes `Date.now()+random` as `operationId`,
   defeating retry idempotency after a commit-then-reject
   (`app/(tabs)/profile.tsx`; all other economy callers use stable keys).
9. `domain_ratings.updated_at` can move backwards for out-of-order
   completions, making a just-played domain look stale
   (`db/rating.ts:165-172`).

**Tests:**
10. The QA-gate production-safety suites are dead code: they register
    only `if (NON_MIGRATED.length > 0)` while the roster pin is 0
    (`sdk/__tests__/catalog/non-migrated-qa-gates.test.ts`), and no live
    test runs `assertDevOnly()` with `__DEV__ = false`.
11. The jest-skip allowlist matches `file + substring`, so any number of
    new skips can hide inside an allowlisted suite (`fullName.includes`).
12. The all-level console guard is bypassed by
    `jest.spyOn(console, 'error')` in 45+ test files, exactly where
    expected-noise tests live.
13. `validate-jest-signal` reports warning counters that are structurally
    always zero (fields absent from Jest JSON), and `certification/
    README.md` still says schema v2.
14. No minimum suite/test floor exists, so mass test loss passes green.

**Pixels/a11y:**
15. In-session results, persist failure, and workout-advance failure are
    never announced (all 42 games); route `/results` is covered, the
    in-session chrome is not.
16. `speed-color-match` answer buttons are fixed 100×60 with
    font-scale-2 labels; `language-sentence-builder` chips render 36 dp
    with no hit-slop; `PauseOverlay` action row cannot wrap.
17. The two speed games bypass `TutorialFrame` with uncapped cards.
18. `ResultRow` pins label/value as separate a11y nodes (weaker contract).

**Governance/evidence:**
19. `GOVERNANCE.json`/`CURRENT_CAMPAIGN.md`/`task-ownership.json` say no
    campaign is active while the 056→067 program is active and pushed;
    `validate-repo-state.mjs` endorses the stale view.
20. `productBaselineCommit` in 063/064 `change.json` names `34c9b2d`,
    not the source of the certified `20e28c64` artifact (`e627473`).
21. 064 probe baselines are untracked while durable state says they are
    tracked; campaign-055 evidence contains falsified closure rows
    (duplicate-Score under-claim) and an unreproducible decorative-art
    audit claim.

**Reintro-guard coverage (deliverable):** duplicate Score/stat rows,
tutorial clipping, and HUD clipping have no catalog-wide guard; a live
36 dp touch target exists in `language-sentence-builder`.

**Repeatability:** six bounded catalog re-runs (contracts ×3 across
worker modes, sweep ×2, full `src/games` ×1, projections with
`--detectOpenHandles`) all passed with identical counts and zero console
violations — no flake or order-dependence found. Recorded, not fixed.

## Desired invariant / outcome

- A replace import can never brick bootstrap: definition seeding cannot
  trust a fingerprint over empty persisted catalogs.
- Device transactions enforce the same FK guarantees as the main
  connection.
- Database initialization is idempotent; retries never leak connections.
- Workout repair paths are compare-and-swap like advance/reroll; portability
  operations invalidate in-memory workout state.
- Economy retries are idempotent from the UI; rating recency never moves
  backwards; PB requires an eligible universe.
- Test signal cannot be silenced by spies, conditional registration, or
  substring allowlists; suite/test floors are pinned; counters are honest.
- Catalog-wide deterministic guards exist for duplicate score rows,
  tutorial frame adoption, HUD wiring, and touch-target floors.
- In-session results/failures are announced; oversized-label and small-target
  controls are fixed.
- Governance state names the active program; artifact provenance is
  recorded against the real certified commit; probe baselines are durable;
  falsified evidence sentences are corrected.

## Non-goals

- No new product features, redesign, or scope creep into 066/067.
- No coverage-threshold infrastructure (deferred to post-067 hardening
  with rationale; the console/skip/floor gates are the 065 investment).
- No change to backup checksum semantics, v12 repair semantics, or
  backup fsync behavior (architectural/product decisions, recorded).
- No RTL/landscape implementation, no snapshot regeneration, no
  gameplay font-scale-2 device captures (067 six-way matrix).
- No device deep-link probe for the games' bare `router.back()` path
  (needs the 067 runtime lane; recorded as a probe there).

## Affected areas

`apps/mobile/src/progression`, `db/adapters`, `db/index.ts`,
`db/workout.ts`, `db/rating.ts`, `workout/*`, `data-portability/*`,
`app/(tabs)/profile.tsx`, `app/data-management.tsx`, `app/results.tsx`,
`components/game-host/*`, `components/game-ui/*`, `components/a11y*`,
`games/speed-color-match`, `games/speed-reaction-time`,
`games/language-sentence-builder`, test harness (`test-utils`,
jest setup, certification validator + allowlist), `.agent/` governance
state, campaign evidence docs.

## Protected contracts

Scoring/economy semantics, schema v12, routing, all 056–064 behaviors,
the empty console baseline (spies are replaced by scoped expectations,
never muted), offline-first, and the 063 certified artifact identity.

## Implementation plan

1. Fix progression fingerprint trust + replace-import strip; regression
   test proving bootstrap survives the crafted backup.
2. Fix expo transaction FK enforcement + adapter contract test.
3. Make `initDatabase` idempotent; test success→success retry.
4. CAS the workout repair/reroll paths; tests for concurrent
   repair-vs-advance.
5. Emit workout-changed after import/wipe; tests.
6. Stable streak-purchase operation key; rating `MAX(updated_at)`; PB
   `=== 1`; tests.
7. Test-signal integrity: live QA-gate tests; allowlist exact-match
   pinning with schema bump; console-spy detection + convert 45+ spy
   sites to `expectConsoleNoise`; honest warning counters + README fix;
   min suite/test floors.
8. Catalog guards: duplicate-score, tutorial adoption, HUD wiring,
   touch-target scan; migrate the two tutorials; fix the 36 dp chips,
   fixed color buttons, and pause-overlay wrap.
9. In-session announcements + ResultRow semantics; tests.
10. Governance/evidence reconciliation: active program registration,
    artifact provenance fields, probe baselines committed, falsified
    evidence sentences corrected.
11. Full validation, adversarial closure review, durable state,
    commit/push.

## Test plan

- New/updated focused suites for every fix (listed per task).
- Full Jest matrix with zero unexpected console output and the
  certified skip allowlist; jest-signal summary validation.
- All repository validators incl. the new floors and `.spec` guard.
- Typecheck, lint, Expo Doctor, OpenSpec strict, repo-state,
  task-ownership, affected map, provenance, offline, secrets, workflows.

## Runtime/native evidence plan

065 changes device-relevant code (FK pragma, init idempotence, workout
repair, portability emissions, UI sizing/announcements). A release APK
is rebuilt from the 065 SHA and receives a bounded adversarial device
pass on the dedicated `emulator-5554`: crafted replace-import backup
(empty definitions + matching fingerprint) must not brick bootstrap;
wipe → Home shows the empty state; pause overlay at compact/font-scale
captures; EventSource/perf logcat check. Full six-way pixel/a11y
certification stays with 067 on its final artifact; 065 records what it
did and did not prove.

## Rollback / risk notes

- FK enforcement inside transactions could surface latent child-first
  writes: the matrix plus the crafted-import device test is the gate; a
  surfaced violation is a real defect and gets fixed, not waived.
- Console-spy conversion touches 45+ test files; the all-level gate and
  the full matrix are the safety net.
- Allowlist schema bump (exact pinning) must keep the five opt-in probes
  green; the runner re-run verifies.
- Workout CAS repairs must not deadlock; the queue serializes
  per-connection writes, and tests cover interleaving.

## Completion criteria

Standard terminal bar: all fixes implemented and tested, full matrix
green with 0 unexpected console output, all validators + OpenSpec strict
green, bounded device evidence recorded, adversarial closure review
closed, governance/evidence reconciled, committed and pushed with
`HEAD == origin/main`, and the 065 evidence record written.
