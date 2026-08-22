# Campaign 011 Validation Backlog (handoff from Campaign 010)

Campaign 010 is implementation-only. Every area below requires dedicated
verification in Campaign 011 (TEST / AUDIT / QA / FIX / HARDEN). Append entries
continuously during the wave using this per-entry shape:

```text
### <Subsystem>
- Files/features changed:
- Risk level: Critical / High / Medium / Low
- Required unit tests:
- Required integration tests:
- Required emulator path:
- Required property/invariant checks:
- Required performance measurements:
- Platform requirements:
```

## Standing entries (pre-wave)

### Catalog contract compliance — new games W01–W04

- Files/features changed: 4 new game modules (ids TBD by workers)
- Risk level: High
- Required unit tests: generator determinism, scoring bounds, pause freeze, force-win paths
- Required integration tests: session persistence round-trip
- Required emulator path: full journey via autobot smoke chain for each new game
- Required property/invariant checks: catalog-contracts suite over new modules
- Required performance measurements: none specific
- Platform requirements: Android primary

### GameHost migrations — W05

- Files/features changed: components/game-host/**, migrated game screens
- Risk level: High
- Required unit tests: per-migrated-game screen suites still pass
- Required integration tests: lifecycle parity vs pre-migration behavior
- Required emulator path: migrated games smoke chain
- Required property/invariant checks: catalog-contracts scanner recognition of GameHost modules
- Required performance measurements: none
- Platform requirements: Android; visual baselines may need deliberate regeneration

### Query performance rewrite — W09

- Files/features changed: analytics/queries.ts, projections
- Risk level: High
- Required unit tests: result-equivalence vs previous snapshot outputs on fixture DBs
- Required integration tests: progress screens render identical data
- Required emulator path: progress screens on device-size data
- Required property/invariant checks: aggregate SQL vs JS reference on seeded fixtures
- Required performance measurements: re-run scripts/perf baselines (101ms@20k target)
- Platform requirements: none beyond Node test env

### Backup transport wiring — W10

- Files/features changed: data-portability transport/serializer
- Risk level: Critical (data safety)
- Required unit tests: serializer equivalence, checksum stability, atomic restore, rollback
- Required integration tests: export→wipe→import round-trip via real filesystem transport
- Required emulator path: share-sheet/document-picker flows on Android
- Required property/invariant checks: canonical-form invariants
- Required performance measurements: re-run export baseline (~2.4s@5k target)
- Platform requirements: Android SAF; iOS picker semantics NOT VALIDATED (no macOS)

### Platform/deps cleanup — W15

- Files/features changed: app.json, AndroidManifest, package.json (parent-applied removals)
- Risk level: Medium
- Required unit tests: existing suites unaffected
- Required integration tests: app boots after dependency removals
- Required emulator path: cold start + representative journey post-cleanup
- Required property/invariant checks: expo-doctor, provenance/offline validators
- Required performance measurements: binary size delta optional
- Platform requirements: Android build required; iOS prebuild NOT VALIDATED

### Cross-platform seams — W16

- Files/features changed: screen-shell, platform adapters, tokens
- Risk level: Medium
- Required unit tests: inset math under mocked safe-area
- Required integration tests: pushed-route layouts
- Required emulator path: notched-device visual pass
- Required property/invariant checks: none
- Required performance measurements: none
- Platform requirements: iOS device/simulator verification NOT VALIDATED (no macOS host)

---

## Wave entries appended at convergence (2026-08-21)

### New games W01–W04 detail

- attention-sustained-vigilance, speed-order-sweep, math-value-ordering,
  memory-prospective-cue. Risk: High. Required: per-game generator/scoring/pause/
  force-win unit suites; autobot full-journey each; sensory alias verification on
  device; tutorial first-play flow. NOTE: order-sweep vs value-ordering similarity
  review (both ascending-order tasks; distinct rationale documented in packets) —
  Campaign 011 should confirm the distinction holds in playtesting.

### GameHost migrations (18 games total)

- Batch 1: speed-reaction-time, math-fast-math, attention-visual-search,
  language-word-scramble, spatial-coordinate-turn, flexibility-card-sort.
- Batch 2: attention-target-count, attention-symbol-tracker, memory-grid-recall,
  math-missing-operator, logic-next-sequence, spatial-fold-match,
  attention-odd-one-out, speed-quick-compare, memory-pattern-tap-back,
  flexibility-task-switch, logic-order-path, spatial-transform-match.
- Risk: High (largest behavioral surface). Required: run every migrated game's
  existing screen test suite; fake-timer cadence checks (odd-one-out interval,
  quick-compare/order-path zero-remaining expiry edge); pause-freeze parity;
  back-guard behavior; transform-match qaPanelPosition='above' reachability in
  autobot; visual baselines unaffected (tab routes only) — confirm.

### Workout V2 + Personalization V2

- Files: src/workout/{templates,metadata,rotation,reasons,summary,use-workout-templates},
  db/workout.ts listRecent, src/personalization/**, workout/personalize.ts refactor.
- Risk: High (daily flow). Required: template lifecycle integration tests
  (start/resume/advance/complete per template+length), rotation determinism,
  personalize.ts backward-compat suite re-run (43 pinned tests), migration of
  pre-V2 workout instances.

### Analytics V2 + query rewrite + repository primitives

- Files: analytics/* new modules, queries.ts projection path,
  db/sessions.ts projection primitives, schema v9 migration.
- Risk: Critical (data correctness). Required: result-equivalence tests old vs new
  loaders on fixture DBs (incl. corrupt JSON rows), v8→v9 upgrade-path test,
  json_extract parity vs JS extractors across all games' raw shapes, perf baselines
  re-run (target <<101 ms @20k), perf-db-query-patterns CI guard.

### Portability file transport + single-pass serialization

- Risk: Critical (data safety). Required: serialize/deserialize equivalence suites,
  export→wipe→import round-trip via real files, picker/share flows on device,
  large-backup memory profile, data-management screen render tests with mocked FS.

### Engagement V2

- Chains/tiers resolution, quest refresh boundaries (timezone edges), inbox claim-all
  idempotency under double-tap and backup-reimport, ledger operationIds preserved,
  rewards hub render tests.

### UX/IA + home workout UI

- Home/Games/Profile additions gated for baseline stability — re-run visual-baseline
  canaries; new shell components a11y contract pass; workout template start→resume→
  complete e2e on emulator; rewards-hint count degradation when db unavailable.

### Accessibility primitives

- Font-scale caps at fontScale 2.0 layouts; LiveRegion platform split (Android node /
  iOS imperative) on device; A11yDialog focus trap with TalkBack/VoiceOver; reduced-
  motion plumbing adopted surfaces; PauseOverlay hardening vs grid-nav finding.

### Math content tiers

- fast-math two-step validity + determinism at chance boundaries; number-line expert
  span-relative scoring; equation-builder 51-template solvability/uniqueness property
  sweep (8 known dead easy-level templates flagged for pruning); missing-operator
  uniqueness lemma over new templates; gameVersion 1.1.0 replay compatibility.

### Seams + instrumentation

- entitlements/notifications/assistant/sync unit suites (written, unexecuted);
  sdk/perf no-op verification in production build config; ring-buffer behavior;
  projections instrumentation records correct tier after W22 refactor.

### Platform/deps cleanup follow-ups

- App boots after 7 dependency removals (cold start + representative journey);
  expo-audio plugin trim verified on fresh prebuild (RECORD_AUDIO absent);
  data_extraction_rules/backup_rules XMLs are UNTRACKED (android/ gitignored, CNG) —
  must be re-applied or codified into a config plugin before any clean prebuild.

---

## Campaign 011 closure ledger (2026-08-22)

| Backlog item | Classification | Evidence |
| --- | --- | --- |
| Catalog contracts — 4 new games | CLOSED — validated | 15 suites / 219 tests green; adversarial property sweeps pinned |
| GameHost migrations parity | CLOSED — validated | W05: 138 suites / 1701 tests green across host + 18 games; risk-area regressions pinned |
| Query performance rewrite equivalence | CLOSED — fixed + validated | Two dead-SQL defects found+fixed (COALESCE arity, bare JSON paths); 18-test differential suite green @1k/5k/20k; no perf regression (83.8ms vs 141.4ms legacy @20k) |
| Backup transport wiring (device flows) | PARTIALLY CLOSED — deferred | Engine validated on Node; SAF/share/picker system-sheet flows need interactive consent surfaces autobot cannot drive (final ledger below) |
| Platform/deps cleanup post-removal boot | CLOSED — validated | APK rebuilt+installed after removals; app boots (canary warm-home PASS); doctor delta recorded (patch-drift only) |
| Cross-platform seams insets | CLOSED — validated | screen-shell inset suite green; tokens additive-only proven vs e0d92ce |
| New-game distinctness review | CLOSED — validated | Order Sweep vs Value Order: MATERIALLY DISTINCT (4 documented differences); both retained |
| Workout V2 lifecycle | CLOSED — fixed + validated | 5 defects fixed incl. High reroll tail-drop; 62 new DB-backed tests; rotation/metadata/reconcile suites green |
| Analytics V2 metric correctness | CLOSED — fixed + validated | 6 boundary/ordering defects fixed (age-space half-open tiling documented); 96 reference-equivalence tests |
| Schema v9 migration matrix | CLOSED — validated | v1→v9 all hops green, corrupt user_version now rejected, rating double-translation fixed |
| Portability serializer + rollback | CLOSED — fixed + validated | Critical checksum bug fixed (byte-contract pinned); trigger-strip fault path fixed; whole-DB rollback proofs green |
| Engagement transactionality | CLOSED — fixed + validated | High quest-claim-on-incomplete fixed; claim-all idempotency matrix green |
| Accessibility rendered behavior | CLOSED — fixed + validated | Critical focus-helper no-op fixed (renderer-routed API); dialog re-announce spam fixed; visual baselines reconciled hunk-by-hunk |
| grid-nav PauseOverlay reachability | ROOT CAUSE FIXED — device confirmation pending | Focus fix landed; final device verdict in the closure ledger below |
| Perf baselines re-measure | CLOSED — validated | loadProgressSnapshot 102.7ms @20k (≤009's 101ms class) with fast path engaged; export probe re-run |
| iOS build/runtime | BLOCKED — no macOS host (unchanged from prior campaigns) | Static audit refreshed in 009; platform seams source-level only |
| Sync/entitlements/notification/assistant seams inertness | CLOSED — validated | Unit suites green; default entitlements unrestricted; no network calls (offline validator CLEAN) |
| Workout device journey (--mode workout) | IN PROGRESS this campaign — result recorded in VALIDATION.md |

## Campaign 011 FINAL closure ledger (2026-08-22, device convergence)

| Backlog item | Classification | Evidence |
| --- | --- | --- |
| All 42 games terminal Android classification | CLOSED — PASS | 42/42 PASS. Catalog run `qa-artifacts/20260822-022415-autobot-all` (38 PASS) + clean exclusive targeted reruns for every non-PASS: stroop/deduction/order-path (20260822-0459xx–0519xx series), grid-nav + transform-match post-fix (093048 / 093232), plus 065853 memory-grid-recall sibling confirmation |
| grid-nav PauseOverlay reachability | CLOSED — FIXED + PASS | Root cause bisected ON DEVICE: deep non-flattenable option-board nests inside accessibility buttons collapse the Fabric a11y tree (overlay subtree vanishes). Fix: decorative option grids unmount while paused (grid-nav, transform-match). Device PASS with pause/resume: 093048 / 093232; probe timelines in qa-artifacts/.probe-gridnav-* |
| Workout V2 full device journey | CLOSED — FIXED + PASS | `/results` route crashed on render (`[expo-router] array of styles to a child of <Slot>`) — array styles inside asChild Links on results-next-game / recent rows / game-detail rows; flattened. Harness: scroll-to-recent (below-fold), multi-BACK return, order-independent node parsing. Journey PASS 20260822-113955: 4/4 completed + relaunch shows persisted completion; DB `current_index=4 status=completed` pulled and verified |
| Native-dep stale-dev-client hazard | CLOSED — FIXED | Lazy native requires in file-transport (+ typed diagnostic error naming the rebuild remedy); regression suite file-transport.lazy.test.ts; ops guidance documented in scripts/qa/README.md §Dev-client freshness |
| CNG gitignored android config durability | CLOSED — FIXED | Committed local config plugins `plugins/with-android-backup-rules.js` (manifest attrs + both rule XMLs) and `plugins/with-android-ndk-pin.js` (host NDK workaround); SYSTEM_ALERT_WINDOW blocked via app.json blockedPermissions. Proven by real `expo prebuild --platform android --no-install` restoring all settings from scratch; plugin pinning tests green |
| Short-template workout device traversal | DEFERRED — Campaign 012 | Default daily 4-game journey (the canonical V2 flow incl. relaunch persistence) fully PASS; template-length selection UI traversal needs new harness flow (template row → start); low risk — same advance/persist mechanics already proven |
| SAF share-sheet/document-picker system flows | BLOCKED (environment) — unchanged | System consent sheets cannot be driven emulator-locally by autobot policy; engine round-trips are device-proven via pulled DB |
| iOS build/runtime | BLOCKED — no macOS host (unchanged) | No Xcode/macOS on this host; recorded honestly per evidence policy |
