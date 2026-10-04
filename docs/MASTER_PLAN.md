# Master Implementation / Completion / Hardening Plan

**Plan version:** 2 (supersedes version 1, which described Campaigns 001–028 and is
retained only for its historical phase-gate narrative)
**Status:** canonical execution specification, derived from the 2026 repository-wide
audit. **IN EXECUTION — Phases 0–8 complete.** 069, 068, 070, 071, 072, 073, 074
and 075 are implemented with their regression suites. The required device-lane
confirmations are now closed: 068 (§7.5/§8.4) on 2026-10-03 and 070 §7.4 /
072 §7.3–§7.5 / 073 §6.3–§6.5 / 074 §7.4 on 2026-10-04
(`docs/redesign/evidence/change068-device/`,
`docs/redesign/evidence/change070-074-device/`), with 072 §7.3's Profile half
honestly PARTIAL (device) and 071's §6 coverage gaps remaining owner debt.
Phase 9 (optional hardening) and Phase 10 (final certification) remain. §6 is the
live task list.
**Authority:** subordinate to `docs/PROJECT_CONSTITUTION.md`; durable execution state
remains in `.agent/GOVERNANCE.json` and `.agent/STATE.md`
**Baseline audited:** `main` @ `2a765cc`; findings re-verified after rebase onto
`89fc8b4`'s base `2c9b4e1` (see §Appendix B)
**Execution baseline:** `main` @ `47fffee` (re-measured 2026-09-30 before Phase 1:
typecheck clean; 594 passed + 4 skipped suites / 6,939 passed + 5 skipped tests /
5 snapshots; `expo-doctor` **20/21 exit 1**; `validate-dependency-audit` **exit 1**;
`validate-repo-state` PASS)
**Audit working papers:** `docs/audits/2026-repo-audit/`

## 0. Change index and execution status

Campaigns 001–067 and the post-067 hardening phase are closed
(`CHANGE_0NN_COMPLETE` / `POST_067_HARDENING_COMPLETE`). The audit findings in §4
are being closed by the following OpenSpec changes, executed in the phase order of
§6. Each change is validated on its own evidence in
`.agent/VALIDATION.md`; the numbers in this plan are **findings and targets, not
results** — results live in the per-change records.

| Change | Title | Master-plan phase | Status |
|---|---|---|---|
| `069-dependency-gate-restoration` | Dependency gate restoration + claim integrity | Phase 1 | **VALIDATED** — audit gate PASS (7 accepted, 0 unallowlisted); hermetic `scripts/validate-expo-alignment.mjs` added and self-tested (54/54, real tree 22/22 aligned); network `expo-doctor` moved off the push path to the weekly schedule as classified upstream drift; audit BLOCKED distinguished from audit FAIL in CI; OpenSpec CI re-pinned to `1.9.0` + `--strict`; durable claims corrected at `47fffee`; assistant-tooling trees ignored |
| `068-storage-adapter-runtime-parity` | Storage adapter re-entrancy guard, pragma convergence, engine parity contract | Phase 2 | **VALIDATED** — shared `SQLiteReentrantTransactionError` on both backends, checked BEFORE enqueueing (the ordering that closes the device freeze); connection invariants applied and read back with a startup throw; engine-parity contract; stale `PASS_B_RUNTIME` claim corrected and severity raised Low → High. **Gap closed post-review:** the guard covers `exec`/`transaction`/`run` (state-changing entry points) — a forgotten `txn` reaches the outer adapter through those, and they were the reachable half of the freeze. **Semantics refined in `7bceb90`/`1565c2b` (row corrected 2026-10-02):** `get`/`all` PARTICIPATE in the connection's open transaction instead of rejecting (refusing reads stranded a claim-all racing a single claim); both backends agree identically on the reject set (nested `transaction()`, connection-level `exec()`, root DML `run`) and on read participation, pinned by `transaction-reentrancy.test.ts` + `adapters/__tests__/expo.test.ts` + `claim-all-attacks.test.ts`. Device half of the parity contract **NOT VALIDATED** (no emulator run) |
| `070-backup-transport-atomicity` | Rotation-based backup replacement, bounded diagnostics, honest durability claims | Phase 3 | **VALIDATED** — rotation-based replacement (write temp → rotate `.prev` → rename → verify read-back → delete) with 22 step-level fault-injection tests plus a mutation proof that the old single-move sequence fails the same safety assertion; bounded diagnostics budget; forward-compatibility signal; stranded-artifact surface. **Gaps closed post-review:** an interrupted replacement is now repaired automatically on the next read/list/write (the orphan `.prev` is promoted back to the user's name instead of being left hidden behind a banner), and recovery restores the previous content whenever the name does not hold the expected bytes (the content-mismatch case the first pass missed). Device lane **closed 2026-10-04 — PASS** (§7.4: real-rotation replacement left no temp/`.prev`; the crafted orphan-`.prev` interrupted replacement was auto-repaired by the next listing read with sha256-identical content; `docs/redesign/evidence/change070-074-device/`) |
| `071-shared-ui-contract-integrity` | Shared UI kit single-definition contracts, dead code removal, `reanimated` dependency removal | Phase 4 | **VALIDATED** — `Tappable` owns its accessibility state (and the audit's stated symptom was measured to be the wrong direction, recorded); one canonical touch-target constant with 75 call sites migrated and both duplicates removed; unreachable kit surface deleted (two files kept — their exported helpers are live, deviation recorded per §9.3); `react-native-reanimated` removal **attempted, measured, reverted** (required `expo-router` peer); design-system doc corrected and made executable. §6 coverage gaps **NOT DONE** (owner debt); device lane **NOT VALIDATED** |
| `072-navigation-and-error-surfaces` | Honest loading/error/empty states, push→replace, a11y destination | Phase 5 | **PARTIAL — code complete, device lane owed.** §1–§6 done: the data seam reports a four-way status with retry and `hasData`; Data Management and Profile render honest loading/failure/empty/loaded states (a screen-local `catch { return [] }` was the actual root cause of a failed read rendering as no data); Progress's focus throttle is input-aware via the newest-session fingerprint; 16 top-level call sites converted from `router.push` to `router.replace` plus 2 found by the widened guard; Data Management gained a back affordance and game detail's announced destination now names where back actually goes. The regression guard now scans all of `src` (not just `games/`), is bypass-resistant, and strips comments. Device lane 7.3–7.5 **closed 2026-10-04**: 7.3 PASS on Data Management (genuinely-throwing read rendered the failure state + retry with no empty state and per-section isolation; Profile half honestly PARTIAL (device) — its read chain shares the db with the foundational bootstrap stage, failure rendering stays unit-pinned); 7.4 PASS (three Home→detail→Home cycles, system back leaves Home to the launcher, refocus lands on Home); 7.5 PASS (Progress rendered the new session on first focus). `docs/redesign/evidence/change070-074-device/` |
| `073-workout-lifecycle-durability` | Durable workout leg ownership, shared CAS, free skip, startup reconciliation | Phase 6 | **COMPLETE — device lane owed.** §1 one shared CAS for every position write (advance, reroll, skip/jump, boot reconciliation) with a closed SET-clause set and a structural guard. §2 ownership now derives from the PERSISTED session provenance (`findSessionOwningWorkoutProvenance`); the launch map is a write-time fast path and an assertion for advancement. §3 additive `skipped_indices_json` (schema v13), free skip with the `length − 1` allowance (the final leg must be played, keeping `workout-completions` achievements unfarmable), skipped legs award nothing and render as "Skipped". §4 honest launches: the current leg's tuple is true by construction; a later leg records an explicit jump first; a settled leg launches as a standalone practice; the game-host indicator reads the STORED position. §5 boot reconciliation walks forward over legs a session or skip proves settled, reward-free and idempotent. Device lane 6.3–6.5 **closed 2026-10-04 — PASS** (crafted mid-window reconciliation on the dedicated AVD: rewound position walked forward on relaunch, reward-free, leg not replayed, idempotent under repeated relaunch; real-UI complete→skip→finish with `status='completed'`/`skipped_indices_json=[1]` and no session/ledger row for the skipped leg; standalone sessions claimed nothing and repeated relaunches never phantom-advanced; `docs/redesign/evidence/change070-074-device/`) |
| `074-sdk-module-contract` | Registration-time SDK module validation, typed loader, per-game lifecycle gate | Phase 7 | **PARTIAL — §1–§6 done, device lane owed.** §1 validates the game module's RUNTIME surface (`default` must be a component), so a non-conforming module is never rendered; the contract was narrowed after measuring that nothing outside `games/` reads a module's `gameDefinition`. §2 types the loader boundary via `GameScreenProps`, removing the unchecked cast. §3 replaces a VACUOUS lifecycle contract (it satisfied itself from the host sources) with one that scans the 42 modules and can fail. §4 makes `useGameSession.begin()` refuse a duplicate start and exception-safe. §5 collapses 42 copies of the version-packing helper into one that accepts the absent version the SDK type permits. §6 makes the SDK module map executable. Device lane §7.4 **closed 2026-10-04 — PASS** (background/restore mid-session resumed auto-paused and completed; exactly one new session; 3 first-play tutorials rendered; 5 real completions persisted; campaign logcat 18,442 lines with 0 FATAL/ANR/SQLite/reentrancy/RedBox; `docs/redesign/evidence/change070-074-device/`) |
| `075-game-reducer-exhaustiveness` | Shared exhaustiveness helper across all 42 reducers | Phase 8 | **COMPLETE** — `assertExhaustive` in every reducer's `default`, so an action added to the union without a handler is a COMPILE error naming the member; the 27 misleading "Exhaustiveness guard" comments removed; the runtime fallback throws for out-of-union input instead of silently dropping transitions; catalog-wide test pins the shape and fails on a reintroduced silent fallback |

Phase 9 (optional hardening) and Phase 10 (final certification) follow. No new
features are in scope: the feature set is complete and the objective is
stabilization and claim integrity.

**Closure numbers are recorded-at-closure.** Every count in this plan (test
totals, suite totals, gate verdicts, file counts, package-version claims) is an
observation at the commit named in the same sentence, not a statement about the
present tree. `expo-doctor` is additionally *time-dependent*: its expectations
come from `api.expo.dev`, so a `21/21` recorded at one commit says nothing about
a later one. The push-path gate is now `scripts/validate-expo-alignment.mjs`;
see `.agent/GOVERNANCE.json` → `greenMain.enforcedGateSet` for the full enforced
set and `.agent/VALIDATION.md` for the current-state correction block.

---

## 1. Executive summary

### What the project is

An offline-first React Native + Expo SDK 57 brain-training app for Android and iOS, with
a mandatory shared Game SDK, SQLite as canonical local persistence, 42 cognitive games
across 8 domains, a four-game Daily Workout, progression/economy/rating systems, backup
import/export, and an autonomous Android QA harness. All work is planned through
OpenSpec changes; 67 campaigns and a post-067 hardening phase have run to completion.

### Overall maturity

**High, with two gate-level problems that are currently invisible to the governance
model.** The engineering quality is genuinely strong and unusually well-evidenced for
this class of product. The prior audit wave closed every Critical/High repository-owned
defect, and this audit independently confirms the product layer is largely clean.

The important correction to the inherited picture is that the closure claim is **not
reproducible on the current tree**. Two CI gates are red right now, and the durable
state asserts both are green:

| Gate | Recorded | Actual at `2a765cc` |
|---|---|---|
| `expo-doctor` | `PASS 21/21` (11+ places) | **exit 1 — 20/21**, six Expo packages behind |
| `validate-dependency-audit.mjs` | clean | **exit 1** — 3 unallowlisted `brace-expansion` advisories (2 high) |

Neither is a product defect. The first is a *time-dependent* gate: `expo-doctor`
resolves expectations from `api.expo.dev`, so it turns red with zero repository
changes. The second is a toolchain-only advisory that the repository's own allowlist
policy is designed to disposition. Both are fixable without touching product code.

### Major strengths (verified this audit, not assumed)

- **Typecheck, lint, and the full test matrix are green and reproducible**: 598 suites,
  6,933 passing tests, 5 classified opt-in skips, 0 failures; `tsc --noEmit` clean; all
  nine repository validators pass; the jest signal gate is genuinely fail-closed.
- **Data integrity is well designed.** `completeSession` is a single atomic,
  idempotent write path; the currency ledger is append-only with DB triggers; the
  rating service applies deltas inside the same transaction; duplicates are handled by
  a pre-check plus `INSERT OR IGNORE` plus a post-insert race re-check.
- **Determinism holds.** RNG is xmur3→mulberry32 with integer-only math and **zero**
  `Math.random` across all 42 generators, reducers, scoring, and session files; the
  registry generator is deterministic and gated by `--check` in CI.
- **Game lifecycle discipline is real.** 42/42 game screens own the full module matrix
  (`game.json`, generator, reducer, scoring, session, versions); 42/42 intercept back
  during a session; every game-local timer I inspected has correct cleanup.
- **Documentation and governance culture is unusually strong** — and is the main
  reason this plan is about restoration rather than rescue.

### Major weaknesses

1. **Two red CI gates presented as green** (finding `F-01`, `F-42`).
2. **A latent permanent-hang hazard in the storage adapter** that the test harness
   structurally cannot detect (`F-02`, `F-03`).
3. **Durable state is not reconciled against executable reality** — governance prose,
   the master plan, and gate claims all disagree with the tree (`F-45`, `F-46`).
4. **Shared-UI contract defects propagate to every screen** (`F-08` accessibility state,
   `F-11` duplicate `MinTouchTarget` exports).
5. **Screens lie when reads fail** — a failed read renders as "you have nothing"
   (`F-06`, `F-22`).
6. **Workout leg completion is not durable across process death** (`F-14`).

### Primary remaining objective

**Stabilization and claim integrity, not completion.** The feature set is complete. The
work is: restore a genuinely green and honestly-labeled state, close the two P1s, and
harden the boundaries where a defect is currently undetectable. No new features.

### Recommended end state

`main` green on every gate it declares, with every recorded claim attributable to a
commit; storage and UI contracts that fail loudly rather than silently; screens that
distinguish loading, empty, and failed; and a roadmap whose remaining P3s are explicitly
optional.

---

## 2. Repository / system overview

### Shape

```
apps/mobile/                     React Native + Expo 57 app (the only application)
  src/
    app/            39 files    expo-router routes/screens (tabs, game, results, …)
    games/          42 modules  187k lines — the product's bulk; one dir per game
    components/     137 files   shared UI kit, a11y primitives, game host, shell
    db/             42 files    schema, migrations, adapters, repositories
    data-portability/ 31 files  backup export/import/validation/transport
    workout/        37 files    Daily Workout engine
    sdk/            33 files    the mandatory Game SDK contract
    + rating, rewards, quests, achievements, streaks, cosmetics, entitlements,
      progression, analytics, notifications, personalization, routing, …
openspec/changes/    59 valid changes   the planning surface (spec-driven)
scripts/             validators, generators, CI/certification/perf/QA tooling
.github/workflows/   4 workflows
.agent/              durable control plane (GOVERNANCE.json, STATE, campaign ledger)
docs/                constitution, architecture, ADRs, evidence trees
```

### Architecture boundaries

- **Game SDK → game module.** Every game is a self-contained module (generator, pure
  reducer, scoring, session, screen, versions) plugging into a shared host. This is the
  most successful boundary in the repository.
- **Host owns lifecycle; games own rules.** Timers, `AppState`, back interception, and
  session identity belong to the shared host. Games own pure state transitions.
- **Persistence is a single write path.** All game completions funnel through
  `completeSession`, which is why the economy can be made atomic and idempotent.
- **Adapters are the seam.** `SQLiteAdapter` is implemented twice: the Expo backend
  (device) and a better-sqlite3 backend (tests). This seam is where the audit found the
  most serious latent defect.

### Primary execution flows

1. **Startup:** `_layout` → bootstrap stages (schema/migrations, catalog registry) →
   root stack → first route. Failures swap in `bootstrap-recovery` or
   `storage-unavailable`.
2. **Gameplay:** route → lazy screen → `useGameSession` (id, seed, lifecycle, auto-pause)
   → pure reducer + seeded RNG → finalize → `buildRawResult` → normalize → XP hook →
   `completeSession` → results view (which is authoritative and shows persist failure).
3. **Workout:** creation → launch with `workoutKey`/`workoutIndex` → per-leg completion
   → advance via CAS → summary. Provenance rides in the session's persisted raw result.
4. **Backup:** export = collect → serialize → checksum → tokenize → write → share; import
   = pick → parse → canonicalize → validate → transactional apply → reconcile.
5. **Progression:** session completion → rating → ledger → streak/quest/achievement
   projections → UI, with a focus-aware refresh gate.

### Persistence model

SQLite, schema v12, `PRAGMA user_version`-driven migrations applied one version per
transaction with contiguity enforced; append-only triggers plus CHECK constraints
re-created idempotently at boot; injectable clock throughout; rating deltas applied in
the same transaction as the session row.

### Build / test / release

- `npm run typecheck` (tsc), `npm run lint` (expo lint), `npm test` (jest-expo).
- Validators: repo-state, provenance, offline, secrets, workflows, affected,
  dependency-audit, task-ownership, jest-signal.
- Four workflows: `app-ci` (hermetic), `repository-integrity` (push + weekly cron),
  `android-build-smoke`, `ios-build-smoke`.
- Release: Gradle release build, Hermes + new architecture enabled, debug-signed
  locally; artifact identity is certified per campaign.

### Platform assumptions

Android is the primary and autonomous-QA target. iOS is source-compatible but
unvalidated (no macOS environment). One dedicated AVD; emulator-local input only; no
host mouse/keyboard automation.

---

## 3. Current-state assessment

### Complete and healthy

- Atomic, idempotent session completion and the append-only currency ledger.
- Deterministic generators and RNG; versioned generator/scoring metadata.
- Game SDK lifecycle discipline: back interception, auto-pause, timer cleanup, error
  containment, persistence-failure surfacing.
- The validator suite: all nine gates fail closed, are self-tested, and pass.
- The jest signal gate: real floors, per-advisory skip classification with expiry.
- Registry generation determinism, gated by `--check` in all app workflows.
- Deep-link route envelope: length-before-form, ASCII-safe regexes, enum and registry
  membership validation, no state change on mount from a link.
- Backup import validation: bounds, prototype-pollution safety, FK and enum checking.

### Implemented but requiring hardening

- **Storage adapter concurrency** — correct for current call sites, but re-entrancy is
  an unbounded hang rather than an error, and the test harness cannot see it.
- **Connection-level pragmas** — only `foreign_keys` is asserted; the device runs with a
  0 ms busy timeout and the default rollback journal while tests get 5 s.
- **Backup transport durability** — the ordering guarantee is documented but false.
- **Shared UI kit** — memoization is effectively absent, the theme and sensory-settings
  contexts are coupled (a single SFX toggle re-renders every themed component), and
  `react-native-reanimated` is a declared runtime dependency with zero imports.
- **Routing/screen states** — loading and failure states are missing on data screens.
- **Workout state machine** — no durable reconciliation, no skip transition.

### Partial

- Import diagnostics are bounded per entry but not in aggregate.
- Forward compatibility for imported backups is silent.
- SDK module contract is documented but unchecked.
- Per-game lifecycle contract test is satisfied by host sources, so it is vacuous.

### Missing

- Coverage thresholds (deliberately deferred; recorded as owner debt).
- A device-parity contract for storage engine behavior.
- Free/explicit workout abandon.
- A loading+error state contract for data screens.

### Problematic / defective

See §4. Every P0/P1/P2 with evidence, plus ~28 P3s.

### Uncertain

- Runtime confirmation of the workout kill-window and of the backup replacement crash
  window (both need a device lane, not a unit test).
- Whether the recorded artifact identity still matches the tree after the dependency
  work in `069`.
- Long-string, landscape, and RTL behavior (accepted debt).

---

## 4. Findings register (summary)

Full register with evidence: `docs/audits/2026-repo-audit/FINDINGS.md`.
Per-lane evidence: `docs/audits/2026-repo-audit/L01`–`L10` reports.

**Headline findings (P0/P1):**

| ID | Finding | Evidence | Why it matters |
|---|---|---|---|
| `F-01` | `expo-doctor` gate red; 11+ records claim `21/21` | `npx expo-doctor` → exit 1, 20/21; `app-ci.yml:159` has no `continue-on-error`; expectations from `api.expo.dev` | `main` is red on a declared gate while recorded as green; the gate is time-dependent, so it will flap again with no repo change |
| `F-42` | Dependency-audit gate red; 3 unallowlisted `brace-expansion` advisories (2 high) | `node scripts/validate-dependency-audit.mjs` → exit 1; every path is `jest`/`glob`/`minimatch` via `@testing-library/react-native` / `@expo/fingerprint` — no first-party runtime import | A second declared gate is red and recorded clean; correct disposition is an evidence-backed allowlist entry, not a version bump |
| `F-02` | Re-entering the adapter from inside a transaction body **hangs the app forever**; recorded "fails loudly at `BEGIN`" is false | `adapters/expo.ts` queue + `transaction()` runs the body inside the held queue slot; `repository-correctness.test.ts:227-243` pins the Node symptom; all 31 product `transaction(` sites thread `txn` (latent) | A forgotten `txn` becomes a permanent, error-free app freeze with no recovery; the test harness actively hides it |
| `F-03` | The test storage backend is a divergent model that hides `F-02`'s class | better-sqlite3 (SQLite 3.53.4, 5 s busy timeout, DEFENSIVE on) vs expo-sqlite (3.50.3, 0 ms, DEFENSIVE off); node passes the root adapter into the body | Green CI cannot detect device-only persistence defects |
| `F-46` | `docs/MASTER_PLAN.md` is ~40 changes and 17 days stale | Banner says "Campaigns 001–028 closed … no campaign is active"; index stops at Campaign 016 | The next implementing agent starts from a false picture of the repository |

---

## 5. Target architecture / desired end state

- **Every gate is hermetic or explicitly scheduled.** Push-path gates depend only on the
  repository; network-dependent gates are scheduled and classified; a "could not run"
  outcome is distinguishable from "failed".
- **Every claim is attributable.** Durable records state commit + date; the enforced gate
  set is declared so an undeclared red gate is detectable; governance status is
  internally consistent.
- **The storage seam fails loudly.** Re-entrancy is a typed error on both backends;
  required connection invariants are asserted at startup; engine behavior is pinned by an
  executable contract with a documented residual boundary.
- **The UI kit has single-definition contracts.** One touch-target name and shape; a
  component's own accessibility state cannot be erased by a caller; the documented kit
  surface equals the reachable one.
- **Screens tell the truth.** Loading, empty, and failed are distinct and visible; no
  zeroed fallback is presented as data.
- **Workout state is durable and player-controlled.** Completion and position converge
  across process death; ownership derives from persisted state; a free skip exists.

---

## 6. Implementation roadmap

Phases are ordered by dependency and by whether they unblock a declared gate.

### Phase 0 — Baseline and safety (prerequisite)

Establish a clean, verified starting point. Confirm the full matrix, typecheck, lint, all
validators, and the OpenSpec strict totals at the baseline commit; record the exact
numbers in the ledger so later phases can prove non-regression. This is the safety gate
for everything that follows.

### Phase 1 — Restore green `main` and claim integrity (Change 069)

**This is first and is blocking.** Nothing else should be pushed while two declared gates
are red and recorded green.

Scope: disposition the `brace-expansion` advisories with reachability evidence; add a
hermetic Expo alignment check and move the network doctor run to the weekly job;
distinguish audit BLOCKED from FAIL; align OpenSpec validation with the recorded
evidence; reconcile governance prose; refresh the master plan; ignore local tooling.

Parallelizable: the advisory disposition, the hermetic validator, the documentation
reconciliation, and the `.gitignore` work are independent. The workflow edits touch two
files and should be one writer.

### Phase 2 — Storage correctness and runtime parity (Change 068)

Scope: explicit re-entrancy guard on both backends; pragma convergence + startup
assertion; engine-fact parity contract; correct the stale nesting test and the stale
post-067 classification.

Depends on Phase 1 for push hygiene only; the code work is independent.
Parallelizable: guard, pragmas, and parity contract are separable, but all touch
`src/db`, so one writer with sequenced commits.

### Phase 3 — Backup durability and import robustness (Change 070)

Scope: rotation-based replacement (no delete-before-rename window); bounded diagnostics;
name validation aligned with the listing rule; lossy-import signal; stranded-artifact
surfacing; correct the durability claims.

Parallelizable: diagnostics bound and name validation are independent of the rotation
work.

### Phase 4 — Shared UI contract integrity (Change 071)

Scope: fix the `Tappable` accessibility merge; collapse duplicate `MinTouchTarget`
exports; delete unreachable kit components and their orphaned tests; remove the unused
`reanimated` dependency; correct `DESIGN_SYSTEM.md`; close primitive coverage gaps.

Sequencing inside the phase matters: fix the merge before touching memoization or
touch-target consumers; delete components after the accessibility fix lands so the
device check is meaningful.

### Phase 5 — Navigation and screen-state honesty (Change 072)

Scope: `useDbData` reports failure; honest loading/error/empty states; push→replace for
top-level destinations; Data Management back affordance; game-detail announced
destination; widened regression guard; Progress input-aware refresh.

### Phase 6 — Workout durability and player control (Change 073)

Scope: shared compare-and-set for advance and reroll; durable leg ownership; free skip;
honest "Up next"; startup reconciliation.

### Phase 7 — SDK module contract and session safety (Change 074)

Scope: registration-time module validation; typed loader boundary; per-game lifecycle
gate; duplicate-start guard; version-helper correction; SDK doc update.

### Phase 8 — State-machine exhaustiveness (Change 075)

Scope: shared helper; convert 42 reducers; remove misleading comments; catalog test.

### Phase 9 — Optional hardening (not required for a green baseline)

Memoize the shared kit; split the theme and sensory-settings contexts; split the eight
oversized route
files; coverage thresholds; snapshot-review mechanism; per-module coverage floors.

### Phase 10 — Final certification

Re-run the full matrix, all validators, the opt-in probes, the OpenSpec strict totals,
and a device pass over the changed journeys; produce one terminal ledger with every
finding's disposition.

---

## 7. Parallel workstreams

| Lane | Changes | Notes |
|---|---|---|
| Gate/claims | 069 | **Sequential first** — it owns CI workflow files and durable state |
| Persistence | 068, 070 | Same subsystem; sequence to avoid `src/db` write contention |
| UI/UX | 071, 072 | Overlap in `src/components` and `src/app`; sequence 071→072 |
| Product logic | 073, 074, 075 | 073 touches `db/workout`; 074 touches SDK+host; 075 touches all 42 reducers — keep 075 last |
| Docs | folded into 069 | Do not let a second writer touch `.agent/*.md` |

**Shared hotspots to keep single-writer:** `.github/workflows/**`, `apps/mobile/package.json`
+ lockfile, `src/db/**`, `src/hooks/use-db-data.ts`, `.agent/STATE.md` /
`CURRENT_CAMPAIGN.md` / `GOVERNANCE.json`, `openspec/changes/**` (one owner per change).

---

## 8. Definition of done

A change is done when its acceptance criteria hold **and** these are true:

1. `npm run typecheck` → 0 errors; `npm run lint` → 0 errors, 0 warnings.
2. Full Jest matrix green, no new skips, jest signal validator passing with floors met.
3. All nine repository validators pass; `node scripts/validate-repo-state.mjs` green.
4. `openspec validate --changes --strict` → 0 failures.
5. Every behavioral change has a regression test that fails without the fix.
6. Every gate the change touches is re-run and its exact result recorded.
7. No claim in `.agent/*.md` or `docs/**` asserts a gate as green unless it is green at
   the recorded commit, with that commit and date stated.
8. No dead code, no orphaned test, no misleading comment introduced.
9. Device-verified for any change touching navigation, persistence-atomicity, or
   accessibility semantics.
10. `main` pushed, clean, and green at the end of the phase.

Project-level: every P0/P1/P2 finding in §4 closed or explicitly re-deferred with an
owner and a date; P3s either fixed or listed as accepted debt with a reason.

---

## 9. Instructions for the implementing agent

1. Read this plan and `docs/audits/2026-repo-audit/FINDINGS.md` before changing code.
2. Verify the current tree first: `git status`, the full matrix, and all validators. The
   repository may have changed since the audit baseline (`2a765cc`).
3. Do not trust the plan over the code. If reality differs, reconcile and record the
   difference rather than forcing the plan.
4. Start with Phase 0, then Phase 1. Do not push new product work while a declared gate
   is red and recorded green.
5. Execute in phase order; honor the single-writer hotspots in §7.
6. Preserve working behavior unless a change explicitly calls for it.
7. Add a regression test with every fix; a fix without coverage is not complete.
8. Never fake green. An unrun check is `NOT VALIDATED`; a tool failure is `BLOCKED`.
9. Keep the repository clean: no stray files, no assistant-tooling noise, no
   hand-edited generated output.
10. Update `.agent/STATE.md`, `.agent/VALIDATION.md`, and the current-campaign record at
    each meaningful checkpoint, with commit and date.
11. Surface newly found high-impact defects rather than deferring them silently.
12. When a change's acceptance criteria are met, mark it validated; do not mark work
    complete that has not been verified.
13. After the roadmap, run a final repository-wide certification pass before declaring
    the project complete.

---

## Appendix A — Audit coverage and limitations

**Deep lane coverage:** persistence, data portability, SDK/registry, workout, routing,
components/theme, economy (partial), tooling/CI, tests (partial), docs/governance.

**Orchestrator-verified evidence (not taken on trust):** the storage-adapter deadlock
claim, the `Tappable` accessibility claim, the `MinTouchTarget` dual-export claim, the
expo-doctor red gate and its network source, the dependency-audit red gate and
toolchain-only reachability, the backup delete-then-rename behavior, the 42/42 reducer
shape, and the 42-game module matrix.

**Not fully covered — known limitations of this audit:**

- **Per-game line-by-line review of all 42 boards** (187k lines) was not performed;
  games were covered structurally (module matrix, lifecycle, determinism, reducer shape)
  and by contract analysis, not by full review.
- **The economy lane (rating, streaks, quests, achievements) timed out** and is the
  largest under-covered subsystem. Its findings here are partial; a dedicated pass is
  warranted before Phase 6.
- **The test-quality lane timed out**; coverage-gap analysis is incomplete, though the
  full matrix and signal gate were measured directly.
- **No device lane was run** (host-interaction policy + no emulator in this
  environment). Findings marked "requires runtime validation" need a device pass.
- **pi-lens Markdown analysis was unavailable** in this environment (no Markdown
  language server), so the OpenSpec artifacts were validated with the repository's own
  `openspec validate --strict`, which is the authoritative gate here.

**Coverage boundaries** (the delta scanner is the orchestrator): `node_modules/**`,
generated `registry.generated.ts` (verified by `--check`), `.git`, `qa-artifacts/**`,
binary assets, and the 42 game screens' line-level content.

---

## Appendix B — Post-rebase re-verification

Four upstream commits (`2c9b4e1`, post-067 terminal re-certification) landed while this
audit was running and touched files inside the audited surface. Per §9.3 the findings
were re-verified against the rebased tree rather than assumed:

| Finding | Re-verified result on the new base |
|---|---|
| `F-04` backup overwrite not atomic | **Holds** — `file-transport.ts:156` still `move(file, { overwrite: true })`; no rotation, no `.prev` |
| `F-02` adapter re-entrancy | **Holds** — no in-transaction guard in `db/adapters/expo.ts` |
| `F-20`/`F-21` reducer exhaustiveness | **Holds** — 27 reducers still carry the false `// Exhaustiveness guard` comment; 0 use a `never` assertion |
| `F-01` `expo-doctor` red | **Holds** — exit 1, 20/21, 6 packages out of date |
| `F-42` dependency audit red | **Holds** — exit 1, the same 3 `brace-expansion` advisories |

The upstream work is complementary rather than conflicting: it de-duplicated a
per-game `clamp01` in favor of the SDK's canonical helper, hardened data-portability
and the game host, and recorded new durable state. No change in this plan is obsoleted
by it, and no upstream change addresses any P0/P1/P2 in §4.

**Not re-verified after the rebase:** the full Jest matrix, the perf probes, and the
per-game screens. The implementing agent should re-establish the Phase 0 baseline on
whatever commit it starts from rather than inheriting the numbers in §1.
