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

Campaign 011 (next): TEST / AUDIT / QA / FIX / HARDEN — see
`.agent/_tasks/campaign011-validation-backlog.md`.
