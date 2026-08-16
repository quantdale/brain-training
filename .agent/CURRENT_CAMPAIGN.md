# Campaign 001 — Autonomous Foundation

**Status:** ACTIVE  
**Campaign type:** implementation foundation  
**Hardening:** NO — light/risk-based validation only  
**Primary mode:** user-selected Day or Night  
**Parent plan:** `docs/MASTER_PLAN.md` Phase 1

## Objective

Prove that this repository can be developed autonomously and non-interferingly before large feature expansion. Establish the real Expo/React Native application, local persistence, Game SDK skeleton, Android emulator control, QA diagnostics, CI, and one representative production-quality Memory game.

## Preconditions

Before changes:

1. Follow the startup protocol in `AGENTS.md`.
2. Reconfirm current official Expo/React Native and chosen Android automation-tool support at execution time; record any consequential stack/version choice as an ADR.
3. Inspect host toolchain and document missing prerequisites.
4. Partition work so parallel agents do not concurrently edit shared package/config/schema/SDK hotspots.

## Work packages

The orchestrator may split/refine these into `.agent/tasks/` packets before swarm execution.

### WP-A — App scaffold and navigation

Own the initial Expo/React Native TypeScript scaffold, app entry, root project scripts, basic design tokens, and four-tab shell: Home, Games, Progress, Profile/More.

### WP-B — SQLite and persistent local profile

Establish versioned schema/migration infrastructure, one persistent local profile, session-history foundations, and transaction-ledger foundation. Keep gameplay writes local-first.

### WP-C — Game SDK skeleton

Establish versioned interfaces/services for metadata, categories/domains, difficulty, seeded RNG, monotonic timing, lifecycle, pause, results/normalization, XP/rating hooks, tutorials, audio/haptics, QA semantics, and diagnostics.

### WP-D — Android autonomous runtime harness

Document/create dedicated AVD workflow; implement CLI/ADB install/launch/reset/input/screenshot/log pathways; integrate the chosen UI automation layer; prove no host mouse/keyboard is needed.

### WP-E — First representative Memory game

Build one real Memory game exercising deterministic generation, named/adaptive difficulty plumbing, pause obscuring, result normalization, persistence, tutorial, semantic IDs, and force-state QA hooks.

### WP-F — Validation/CI/recovery proof

Expand repository integrity CI into the available build/typecheck/unit/static checks. Create risk-based affected-area validation entrypoint and structured failure artifacts. Demonstrate fresh-session recovery and one safely partitioned swarm/convergence exercise.

## Shared-file ownership rule

The orchestrator owns shared package manifests/lockfiles, root configuration, navigation registries, database schema coordination, shared SDK contract integration, and generated registry/index convergence. Parallel coders must not race on these files.

## Light validation required during campaign

As infrastructure becomes available:

- repository-state validator
- dependency install integrity
- typecheck
- relevant lint/static checks
- unit/contract tests for changed foundations
- app build/start smoke
- one-emulator launch/navigation/game smoke
- screenshot/log capture on runtime failures
- no host-input interaction proof

Do not run a full whole-app hardening campaign.

## Critical/High blocker examples

- app cannot build/start after a coherent wave
- SQLite migration/persistence corrupts state
- completed game result cannot persist atomically
- host mouse/keyboard is required for routine QA
- autonomous runtime cannot produce diagnostics for a failure
- shared SDK design demonstrably prevents independent game modules

Fix these before continuing or durably record a genuine external blocker.

## Exit criteria

Campaign completes only when all are true:

- Expo/React Native app exists and builds on the documented development host
- four-tab shell exists
- dedicated Android emulator workflow is documented and autonomously controllable
- install/launch/reset/emulator-local input/screenshot/log workflow works without host mouse/keyboard
- SQLite versioning/migrations and persistent local profile exist
- Game SDK skeleton exists with deterministic/timing/QA contracts
- one representative Memory game is playable end-to-end
- QA can deterministically force or reproduce important game states
- completed session persistence works
- repository light validation and GitHub Actions are operational
- day/night execution guidance is usable
- fresh-session repository-only recovery has been demonstrated/documented
- at least one parallel swarm packet/convergence exercise has been demonstrated safely
- no unresolved Critical/High defect
- durable state/validation docs are updated
- `main` is clean, committed, and pushed to the configured GitHub remote

## On completion

Update `.agent/STATE.md`, `.agent/VALIDATION.md`, and `docs/MASTER_PLAN.md` evidence; archive campaign completion checkpoint; set the next active campaign for Phase 2 rather than starting mass catalog expansion prematurely.
