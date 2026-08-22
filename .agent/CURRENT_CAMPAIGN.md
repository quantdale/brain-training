# Campaign 011 — Full Validation, QA, Audit, Fix & Hardening

**Status:** CONVERGING (Day mode) — local gates green, CI green, device journeys executing
**Final-SHA line:** see `.agent/STATE.md` (updated at close)
**Campaign id:** `011-full-validation-hardening`
**Predecessor:** `010-mass-product-implementation` (COMPLETED at `2630a77`; 42 games, implementation-only)
**Execution entry:** owner-directed validation orchestrator brief — VERIFY → BREAK → DIAGNOSE → FIX → REGRESSION TEST → INTEGRATE → DEVICE VERIFY → HARDEN → PROVE

## Mission

Test everything Campaign 010 changed; find defects; fix root causes; harden the combined
product. Not a feature campaign. Known ground truth at open: full Jest = **12 failed
suites / 32 failed tests / 4 snapshots** (of 412/4665); GitHub App CI red on `2630a77`;
Android emulator available. Failure inventory routed in `.agent/_tasks/campaign011/W*.md`.

## Topology

16 worker packets in `.agent/_tasks/campaign011/` with disjoint ownership; workers never
branch/commit; parent owns Git, full-suite runs, device-journey coordination, durable
state. Only W16 touches the emulator. Workers run targeted Jest only.

## Exit criteria

- [x] All failing suites triaged and green (12→0; every fix root-caused)
- [x] Critical/High defects fixed with regression tests (see VALIDATION.md)
- [x] Differential equivalence proven: analytics V2 (96 tests), JSON1 projections
      (18 tests @1k/5k/20k), backup round-trip (byte-contract + rollback proofs)
- [x] Migration matrix v1→v9 green (14 tests; corrupt user_version hardened)
- [ ] Android catalog journey over 42 games — RUNNING (`qa-artifacts/20260822-022415-autobot-all`)
- [ ] Workout device journey — auto-chained after catalog
- [x] Performance re-measured: snapshot 102.7ms @20k via fast path (≤009 baseline class)
- [x] Cross-system integration pipeline test PASS (parent-owned §27 suite)
- [x] Local gates green; CI green from `6d04318` (Jest + doctor 21/21 via pinned patches)
- [x] campaign010 validation backlog fully classified (closure ledger appended)
- [ ] Durable state final sync (this file's status + STATE.md at close)

## Outcome summary

Two waves executed: wave 1 = W01–W16, wave 2 = W17–W24 (GameHost migration batch B,
repository primitive resolution, future-facing seams, perf instrumentation, math
content tiers, workout UI). All packets COMPLETED; three wave-2 workers were resumed
after API interruptions and finished. Parent convergence: cross-worker interface
fixes, FileBackupTransport implemented by parent (W10 truncation gap), game-name
collision resolved ("Cue Keeper" rename), catalog contract scanner extended for
GameHost modules (pre-authorized in W05 packet), registry regenerated twice (once
per wave), qaPanelPosition prop added.

Checks actually performed at convergence: `tsc --noEmit` PASS (0 errors),
catalog-contracts suite 16/16 PASS (42 games), registry generator --check PASS,
repo-state validation PASS. Full Jest / lint / builds / emulator QA / benchmarks:
intentionally NOT RUN (Campaign 011 owns them) — see
`.agent/_tasks/campaign011-validation-backlog.md`.

## Mission

Maximize correct production-code implementation throughput: implement as much of the remaining product architecture, functionality, UX, platform infrastructure, content, performance architecture, and future-facing seams as can safely be implemented in parallel by up to 16 specialized workers under one parent orchestrator.

Explicitly deferred to Campaign 011 (TEST/AUDIT/QA/FIX/HARDEN): large Jest expansion, property-test campaigns, full integration tests, emulator catalog traversal, manual QA, visual-regression review, performance benchmarking, CI debugging, flaky-test investigation, iOS validation, release qualification.

Anything not actually tested is recorded `NOT VALIDATED — Campaign 010 implementation-only wave`. New systems are `IMPLEMENTED — validation deferred to Campaign 011`, never HARDENED/PRODUCTION VERIFIED.

## Topology

- 16 worker packets in `.agent/_tasks/campaign010/` (README contract + W01–W16), strict disjoint write ownership.
- Workers never branch/commit/push; parent owns git, generated registry (`node scripts/generate-game-registry.mjs`, run once near convergence), package.json/lockfiles, navigation registries, durable state.
- Cross-worker needs go through `NEEDS_PARENT:` blocks in worker packets.
- Validation policy: no full Jest/lint/builds/emulators during the wave; parent may run one lightweight typecheck near convergence; mandatory handoff backlog at `.agent/_tasks/campaign011-validation-backlog.md`.

## Worker assignments

- W01 NEW game `attention-sustained-vigilance` (SART-like; top 009 follow-up candidate)
- W02 NEW Speed game (distinct mechanic, worker-selected after catalog study)
- W03 NEW Math game (distinct mechanic)
- W04 NEW Memory OR Logic game (clearest gap)
- W05 GameHost consolidation (debt D1) + representative migrations + back-handler seam (B6)
- W06 Workout V2 (templates/focus/lengths/history/metadata/rotation) + `db/workout.ts`
- W07 Personalization V2 (`personalization/**` + `workout/personalize.ts`, explainable weighted signals)
- W08 Progress/Analytics V2 (trends/volumes/windows/comparisons + progress screens/charts)
- W09 Query performance rewrite (`analytics/queries.ts` projections/pushdown; 101ms@20k debt)
- W10 Backup/storage V2 (single-pass serialization ~2.4s@5k debt + FileBackupTransport/share/picker wiring, D2)
- W11 DB/repository API maturation (projections/pagination/aggregates/bulk/transactions)
- W12 Engagement V2 (achievement tiers/stages, quest history, reward inbox/claim-all, streak milestones, provenance) + engagement db files
- W13 UX/navigation IA (home/games/profile/results/game-detail/data-management states+hierarchy+drill-downs)
- W14 Accessibility production primitives (announcements/focus/reduced-motion/font-scale caps B1/touch targets D5/dialogs)
- W15 Platform/deps cleanup (unused native deps evidence A1, manifest permission trim A4, allowBackup policy B7; package.json removals applied by parent)
- W16 Cross-platform seams (safe area B5, keyboard/platform adapters, audio-haptic branches, tokens additive)

## Exit criteria

- [x] All 24 packets completed (W01–W16 wave 1; W17–W24 wave 2), NEEDS_PARENT items resolved by parent
- [x] Parent integration: registry regenerated once per wave, cross-worker seams landed
- [x] Minimal catastrophic-breakage check: conflict-marker scan, `tsc --noEmit` PASS, catalog contracts 16/16
- [x] Coherent commits pushed to origin/main (no force push)
- [x] `.agent/_tasks/campaign011-validation-backlog.md` populated (mandatory handoff)
- [x] Durable state reconciled with IMPLEMENTED — NOT VALIDATED semantics
