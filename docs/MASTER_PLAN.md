# Master Implementation Plan

**Plan version:** 1  
**Status:** accepted bootstrap plan  
**Authority:** subordinate to `docs/PROJECT_CONSTITUTION.md`

The project uses large campaigns rather than one-feature-at-a-time micro-sprints. Individual campaign plans may evolve as the agent learns, but the phase gates below must remain satisfied.

## Phase 0 — Repository bootstrap (current bootstrap commit)

Deliverables:

- locked constitution committed
- vendor-neutral `AGENTS.md`
- durable `.agent/` control plane
- risk/impact map seed
- Kimi project-local continuation/hardening Skills
- repository-integrity CI
- initial ADRs
- active Phase 1 campaign ready

Exit: repository can be cloned by a fresh agent and its next action can be recovered solely from committed state.

## Phase 1 — Autonomous Foundation

Primary objective: prove the development system before scaling feature count.

### Workstream A — Application scaffold

- research current official Expo/React Native compatibility at execution time
- scaffold TypeScript Expo application using the then-current stable supported stack
- establish root scripts, lockfile, formatting/lint/typecheck baseline
- implement four-tab navigation skeleton: Home, Games, Progress, Profile/More
- add coherent design token foundation
- establish app identity using a provisional internal identifier without locking branding

### Workstream B — Local persistence

- establish SQLite data layer
- schema version + migration mechanism
- persistent one-user local profile
- atomic completed-session persistence
- transaction-ledger foundation for normal currency
- deterministic repository/test fixtures

### Workstream C — Game SDK skeleton

Define versioned contracts for:

- game metadata/category/domain mapping
- named difficulty -> internal difficulty
- seeded RNG
- session lifecycle
- monotonic timing abstraction
- pause/background behavior
- result/scoring normalization
- XP/rating hooks
- audio/haptics interface
- tutorial lifecycle
- diagnostic metadata
- QA fixture/state hooks

Avoid a central shared file that every future game must hand-edit when a deterministic generated registry can be used instead.

### Workstream D — Android autonomous runtime

- dedicated documented AVD bootstrap
- CLI/ADB install + launch + clear/reset workflow
- emulator-local input automation
- UI hierarchy/semantic ID strategy
- screenshots and structured log collection
- background/headless-friendly execution
- explicit proof that host mouse/keyboard are never required
- one-emulator orchestration policy

Evaluate current official-supported automation options at execution time (e.g. Maestro and Expo tooling) before locking exact versions.

### Workstream E — First representative playable game

Implement one production-quality-but-moderately-polished Memory game to prove the SDK end-to-end. It should exercise deterministic generation, named/adaptive difficulty integration, pause obscuring, result normalization, XP, persistence, tutorial, semantic IDs, and force-state QA hooks.

This is not disposable prototype code.

### Workstream F — Autonomous evidence/CI

- repository-state validator remains green
- affected-area validation entrypoint
- structured QA artifact layout
- GitHub Actions runs build/typecheck/unit/static/integrity checks available at that stage
- day/night local resource profiles documented and executable
- fresh-session recovery drill: new agent reads repo and continues without chat memory
- swarm packet/convergence drill using safely disjoint implementation work

### Phase 1 exit criteria

All of the following:

- Expo/React Native app builds
- dedicated Android emulator documented and autonomously controlled
- install/launch/reset/input/screenshot/log flow works without host mouse/keyboard
- SQLite persistence works
- semantic IDs and deterministic test state exist
- Game SDK skeleton exists
- first representative game is playable end-to-end
- QA can force representative states
- CI is operational
- fresh-session `/goal` recovery is demonstrated
- day/night modes are usable
- coherent progress is committed/pushed to main
- no unresolved Critical/High defect

**Phase 1 status: COMPLETED on 2026-08-16** (Campaign 001; evidence in
`.agent/checkpoints/001-autonomous-foundation-complete.md` and
`.agent/VALIDATION.md`). One High regression was found and fixed during
emulator QA (game route trapped in the NativeTabs navigator → `(tabs)` group +
root Stack). The next campaign is Campaign 002 (this plan's Phase 2).

## Phase 2 — Eight Representative Games

Expand to exactly one strong representative per top-level category before mass catalog expansion:

1. Memory — deterministic sequence/working-memory mechanics
2. Attention — rapid visual selection/distractor mechanics
3. Speed — precision reaction timing
4. Math — validated procedural arithmetic
5. Language — curated/versioned content-pack path
6. Logic & Problem Solving — procedural puzzle with solver/validation
7. Flexibility — rule-switching state machine
8. Spatial — richer visual/spatial rendering, using Skia only if justified

Parallelize independent game modules through swarm packets. The orchestrator owns shared SDK/schema/generated-registry changes.

Also implement enough shared platform to make these games real product surfaces:

- normalized scoring
- persistent domain ratings and overall score
- XP/player level
- currency ledger
- results screens
- game detail screens/tutorials
- favorites/search/filter basics
- basic Progress analytics

Exit: all eight games function and provide representative canary coverage for the Game SDK.

## Phase 3 — Platform Integration + Expansion Gate

Implement/finish:

- Today's Workout (normally four games)
- personalization inputs and reroll behavior
- quests/achievements foundations
- streaks + freeze/recovery data model
- stronger Progress dashboard
- themes/cosmetic architecture seams
- content-pack versioning/storage management seam
- offline/network boundary tests even before cloud sync exists
- visual-regression seed baselines for key screens
- performance/timing checks
- first iOS compatibility/build campaign

Run the Autonomy + Platform Gate from the constitution. Do not enter Phase 4 until every gate is satisfied or explicitly waived by the owner.

## Phase 4 — Parallel Catalog Expansion

Use campaign-sized swarm waves to expand mechanics/features toward the parity matrix.

Principles:

- partition by self-contained game modules or subsystem boundaries
- avoid shared-file contention
- moderate per-wave integration validation
- no full hardening unless owner requests it
- periodically retire/redesign weak or redundant games
- keep procedural/curated content versioned and reproducible

## Later phases (intentionally not scheduled yet)

- periodic iOS compatibility
- optional account/auth
- Supabase cloud sync
- downloadable content delivery
- AI assistant/RAG
- AI credit system
- monetization/ads
- notifications/widgets
- accessibility hardening
- store release work
- production hardening

These later systems require future decision reviews at the point they become necessary.

## Campaign 010 — Mass Product Implementation (2026-08-21)

Owner-directed bulk construction campaign (`010-mass-product-implementation`): BUILD NOW /
VERIFY LATER. Two worker waves (16 + 8 specialized agents) under one parent orchestrator
with strict disjoint write ownership; validation explicitly deferred to Campaign 011.

Delivered (all `IMPLEMENTED — NOT VALIDATED` unless noted):

- Catalog 38 → **42 games**: attention-sustained-vigilance "Signal Watch" (SART-like),
  speed-order-sweep, math-value-ordering, memory-prospective-cue "Cue Keeper".
- GameHost consolidation (debt D1): shared session/lifecycle/pause/QA/tutorial/results
  host; 18 of 42 games migrated across two waves; catalog contract scanner extended to
  recognize host-delegating modules.
- Workout V2 (templates/focus/lengths/history/metadata/rotation) + home surfacing;
  Personalization V2 (explainable weighted signals, `src/personalization`).
- Progress/Analytics V2 (trends, volumes, PB history, rolling windows, category
  comparison, workout analytics) + query performance rewrite (SQL projections,
  repository primitives, bounded reads) targeting the measured 101 ms @20k debt.
- Portability: single-pass serialization + durable FileBackupTransport with share/
  picker seams (debt D2). Repository API maturation: projection DTOs, keyset
  pagination, aggregates, batch helpers, schema v9 index.
- Engagement V2: achievement chains/tiers, quest refresh/history, reward inbox with
  idempotent claim-all, cosmetic collection progress, provenance feed.
- UX/IA depth, accessibility primitives program (announcements, focus, reduced motion,
  font-scale caps, touch targets, dialogs), platform cleanup (7 unused native deps
  removed; expo-audio permission overreach trimmed at plugin source), cross-platform
  seams (safe-area B5, keyboard/platform adapters), perf instrumentation (D4),
  sync-readiness seams (D3), entitlements/notification/assistant seams.

Campaign 011 (COMPLETED 2026-08-22): TEST / AUDIT / QA / FIX / HARDEN. All 42 games
terminally classified on Android through the full journey chain; Workout V2 full
device journey PASS (4/4 + relaunch persistence); grid-nav a11y defect root-caused
on-device and fixed; /results Slot array-style crash fixed (had made the workout
journey impossible); native-dep stale-dev-client hazard durably mitigated (lazy
requires) and CNG Android config codified into committed local config plugins.
Final gates: Jest 5750 passed, tsc/lint 0 errors, doctor 21/21, all validators PASS.

## Campaign 012 — Broad Convergence Release Prep (COMPLETED 2026-08-23)

Owner-directed convergence campaign (`012-broad-convergence-release-prep`), 16 packets:

- GameHost migration **completed** — all 42 games on the shared host; equation-builder
  dead templates resolved; dependency audit report.
- Workout V2 engine/UX depth; harness modes for short/focus/resume journeys;
  resumeIfPaused adopted across 42 screens; perf baselines (evidence-negative).
- Deterministic Android versionCode / iOS buildNumber via a committed config plugin;
  RECORD_AUDIO/SYSTEM_ALERT_WINDOW blocked at plugin source (device-proven).
- Device-QA defect cluster fixed: tutorial overlay clipped at viewport bottom
  (bottom-anchored overlay), dev-QA panel defaulted below tall playfields (now above),
  template-workout advance never notified Home (stale completion UI).
- Catalog content integrity sweep; word-chain expert pool 9→18 validated chains;
  SQLite schema v10 (`workout_instances.metadata_json`) with backup round-trip
  (portability format v3) and idempotent column-existence migration guard.
- Dependency pins lifted per W15 audit (expo/linking/router/constants/audio within SDK 57).

Closeout evidence: canaries 8/8 PASS, Workout V2 short/focus/resume/daily ALL PASS,
17 additional games terminally classified, Jest ~5800 green, tsc clean, lint 0 errors
(~430 warnings tracked as 013 debt), doctor 21/21, all repo validators PASS.

## Campaign 013 — Final Product Completion (COMPLETED 2026-08-26 — CERTIFIED V1 RELEASE CANDIDATE)

Owner-invoked full-app completion + hardening campaign
(`013-final-product-completion`). Final SHA `ba6dd84` (see
`.agent/checkpoints/013-final-product-completion-COMPLETED.md`):

- **Lint debt eliminated**: 474 warnings → **0 errors / 0 warnings** (autofix of
  import-order/duplicate/array-type/stale-directive classes, eslint globals for the
  jest setup + node scripts, then per-surface unused-import/dead-local removal across
  every game family, db, app shell and QA scripts). No blanket suppressions; the only
  inline disables that remain are per-site, each with a written invariant rationale.
- **Schema v10 adversarial matrix** (+18 tests): v9→v10 with pre-existing
  `metadata_json` (idempotency edge, mutation-proven), repeated initialization,
  column shape pinning, 8 malformed metadata cell shapes (raw bytes preserved,
  reads degrade, never brick), legacy backup envelopes onto current schema,
  failure-injected atomicity (crash-after-ALTER rolls column+version back together;
  append-only triggers restored; retry safe), newer-schema loud rejection.
- **Game-family audits** (7 parallel workers over disjoint surfaces) found and fixed
  4 real gameplay defects, each with mutation-verified regression tests:
  memory-prospective-cue stale-closure scoring (max speed bonus paid regardless of
  reaction) + pause/tutorial restart granting a fresh full response window;
  attention-odd-one-out post-deadline tap grace; speed-color-match negative-RT guard.
- **QA harness hardening**: exclusive-driver lock made fail-closed on ambiguous PID
  liveness (EPERM no longer treated as stale); permissions drift pinned by test;
  **`--mode certify` release gate** — machine-verifiable 42/42 completeness
  (missing/duplicate/unexpected detection), atomic incremental run journal
  (IN_PROGRESS → COMPLETED/INCOMPLETE, `certified` flag; a killed run can never
  masquerade as certified), git/build provenance, environment preflight (device,
  package, Metro, adb reverse, sqlite3, artifacts dir, our-app-foreground guard),
  coarse failure taxonomy, lifecycle-aware late interaction attempt, persisted-row
  invariant validators; harness self-test extended 28 → 49 checks.
- **NativeTabs snapshot instability resolved**: deterministic router-tree normalizer
  (test-only seam mapping volatile route keys to positional placeholders) plus an
  integrated navigation snapshot proving all four tab triggers, selection wiring and
  screen content inside the real host tree.
- **Dependency/security refresh**: 16 remaining advisories classified build/dev-
  toolchain-only (image-size via Metro; uuid via Expo config toolchain); no runtime-
  reachable findings; lockfile dedupe validated (doctor 21/21, web export, full suite).

**Exit: CERTIFIED** — definitive single-driver 42/42 `certify` run
`20260826-012026` (SHA ba6dd84, braintraining-qa36 / emulator-5558, 62m36s,
42/42 PASS, certified=true, preflight 7/7) + Workout V2 daily/short/focus/resume
ALL PASS. Evidence in `.agent/VALIDATION.md` and the checkpoint above. Deferred:
pause/resume a11y race (Medium, honest-retry), SAF sheets (manual), iOS (NOT
VALIDATED on Windows).

## Campaign 014 — Experience Depth & Replayability (historical snapshot; COMPLETED at `6451bfb`)

Owner-authorized product-expansion campaign (not a hardening campaign; 013
certification remains the v1 baseline). Central question: *after the novelty of
the first few sessions wears off, would someone still want to use this
repeatedly for weeks?* Depth over feature count; 42-game catalog is frozen.

**What landed (commits 6e3fb9d → 366a098, all pushed to `main`):**

- **W1 product-depth audit**: evidence-driven rubric over all 42 games + major
  shared surfaces (mechanical depth, novelty, scaling, Expert quality, entropy,
  near-duplicates, degenerate strategies, timing fairness, feedback quality,
  mastery potential) — `.agent/CAMPAIGN014_AUDIT.md` with P0–P4 priorities.
- **W2 13-game mechanical deepening** (six parallel packets + orchestrator
  convergence, 968554a): route-path memory (generator 1.1.0), running-order
  palette 12 + Hamming≥2 guard, reaction-time Go/No-Go (generator 1.1.0,
  scoring 1.2.0), quick-compare plausible decoys + spreadPct proximity axis
  (generator 2.0.0), symbol-tracker respond-phase deadline w/ pause freeze,
  target-count within-session escalation ladder (game 1.2.0), equation-builder
  expert templates ≥25 + failure solution-reveal, deduction-table anti-giveaway
  minimal-proof selection under clueCount cap (generator 1.2.0), stroop
  window-normalized speed bonus (scoring 1.3.0), rule-flip uncued inference
  windows (generator 1.2.x), etc.; registry regenerated (14 game.json version
  bumps), tsc/lint/Jest 5947 PASS.
- **W3–W6 shared depth systems** (b36ac42): mastery ladder
  (`MASTERY_VERSION=1`, one GROUP BY pushdown per load, Game Detail card +
  Progress distribution/closest-milestones + Home strip), Daily Spotlight
  deterministic rotation (v1) with Home card + completion state, Workout V3
  signal-ranked ordering (base set stays pinned-deterministic; ordering
  re-ranked by weighted signals: weak/undertrained/stale domain, novelty,
  trend, PB-proximity, difficulty-fit, overexposure) with truthful per-game
  reasons (metadata v2), discovery shelves, Home/Progress surfaces; Jest
  5972 PASS.
- **W7–W9 generator integrity + repeated-use proof + storage visibility**
  (f4aa44c): word-scramble distractor integrity (ranked by letter-overlap,
  generator 1.1.0; kills length-sort shortcut), deterministic two-week
  repeated-use simulation over real file-backed sqlite (consecutive daily
  workouts ×5, paid reroll debit −25, missed day with proactive Freeze,
  close/reopen relaunch, mastery climbing developing→mastered via Expert
  clears, PB aggregates, Daily-Spotlight per-date determinism + rotation,
  quest period-key rollover, export→wipe→replace-import byte-for-byte),
  storageBytes visibility; Jest 5973 PASS, 483 suites.
- **Closure hardening (575c4f7 → 366a098):** docs reconciliation (README
  Workout V2→V3), harness resilience (RedBox/LogBox dismissal, scrolled-Home
  via any `home-*`, shade collapse, 90s recovery, completion-card
  swipe-to-top, live-panel no-toggle guard), app fix for template-instance
  first-advance race (`completedAt > updatedAt` blocked fresh-start focus
  workouts, fixed with 10s slack in `advance.ts` + `db/workout.ts`; daily
  instance always passed), and WSL-aware SDK/AVD harness fixes for
  `braintraining-qa36` (SDK path + CRLF + directory fast-path).

**Validation snapshot at closure head 366a098 (pre-device-journey):**

- Repo gates: repo-state PASS, registry --check PASS, provenance PASS,
  ownership PASS (014's OpenSpec is PROPOSED per 015 audit), offline CLEAN
  (919 files), tsc CLEAN, eslint 0/0, Jest 483/5973 PASS, harness self-test
  49/49 PASS (web export/doctor last at 013 closure, no dep changes).
- Android: canaries **8/8 PASS** (20260826-114825, braintraining-qa36 /
  emulator-5554, forced-win + persistence + nav), daily-workout 4/4 legs +
  relaunch PASS, focus 4/4 legs PASS (completion-card probe now retried with
  swipe-to-top), but **Workout V3 E2E re-run with the template-advance fix
  and representative 014-changed-game canaries is NOT VALIDATED this
  session** — dedicated AVD `braintraining-qa36` was restored (now at
  `C:\Users\palac\.android\avd\braintraining-qa36.avd`) and booted to
  `sys.boot_completed=1` (emulator-5554) in ~30s, but the emulator
  (37.1.11 + WHPX) segfaults shortly after boot (qemu headless dies,
  `adb devices` goes empty; prior session saw the same after 5 headless
  attempts with cold+wipe-data, 12 GB free). Foreign `Nitro_API_36` not
  adopted per policy. Honest perf: opt-in timing probes NOT VALIDATED
  (statement-count guards green; wall-clock probes not re-run).

The closing paragraph above is a historical pre-transition snapshot. Campaign
014 was subsequently completed at `6451bfb` under its documented evidence
policy, then 015 and 016 were activated and validated in order. Its later
37.1.11/WHPX device limitation is retained as historical platform evidence,
not as the current campaign state.

## Campaign 016 — Release Certification & Hardening (VALIDATED 2026-08-30)

Campaign 016 is terminally validated with no active successor. The exact source
head `f0d301bc1b80ed657c75af81c476ee87dbeea540` passed App CI `33293614545`,
Repository Integrity `33293614543`, Android Build Smoke `33293614561`, and iOS
Build Smoke `33293614540`. The Android job completed clean native generation,
release APK compilation, release-boundary checks, and artifact upload; the iOS
job completed clean prebuild, CocoaPods, and unsigned simulator compilation.

Local automated certification also passed: 489 Jest suites / 6,055 tests with
only the four-suite/five-test explicit opt-in allowlist, Jest signal validation,
database integrity and migrations, backup/rollback, performance probes,
TypeScript, lint, web export, Expo Doctor, registry/provenance/offline/
ownership/repository validators, and QA self-test 49/49. Dedicated Android
runtime/hierarchy and manual TalkBack, SAF/system-sheet, physical-device, and
iOS runtime UX evidence remain `BLOCKED`/`NOT VALIDATED` because the designated
device/manual environments are unavailable. The older Android CI timeout is
retained in `.agent/VALIDATION.md` as historical evidence only. See the
terminal checkpoint and `.agent/CURRENT_CAMPAIGN.md` for the complete matrix.
