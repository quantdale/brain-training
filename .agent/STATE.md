# Durable Project State

**State schema:** 1
**Last update:** 2026-08-22 (campaign 012 OPENED: broad convergence + release-candidate prep — GameHost 18/42→target 42/42 in similarity batches, Workout V2 completion, content debt removal, release polish, build/deps/iOS audits)
**Canonical branch:** `main`
**Active campaign:** `012-broad-convergence-release-prep` (ACTIVE; opened at `b8ca36f`)

## Current status

Campaign 011 COMPLETED. Validated and hardened the Campaign 010 wave end-to-end.

### 011 outcome (COMPLETED)

- **All gates from the open failure inventory green:** 12 failed suites / 32 failed
  tests → **5750 passing / 0 failing**; TypeScript 0 errors; lint 0 errors; registry
  42 games; provenance/ownership/offline/repo-state PASS; web export PASS;
  expo-doctor 21/21 via consciously pinned patch exclusions.
- **Critical fixes:** single-pass backup serializer checksum (exports now re-import);
  analytics JSON1 fast path dead SQL (COALESCE arity, bare JSON paths) — differential
  equivalence proven @1k/5k/20k; Android/Fabric a11y focus helper silently no-op'd —
  replaced with renderer-routed `sendAccessibilityEvent`.
- **High fixes:** quest claim burning incomplete markers; Workout V2 reroll dropping
  the fresh tail; new-game IllegalTransitionError races; prospective-cue response
  bleed-through; append-only trigger restoration fault path; rating-history double
  translation. All with regression protection.
- **Android catalog: 42/42 terminal PASS** through the full journey chain (base run
  `20260822-022415-autobot-all` 38 PASS + 6 clean exclusive re-runs ending PASS).
- **grid-nav class closed on device:** deep non-flattenable option-board nests inside
  accessibility buttons collapse the Fabric PauseOverlay subtree; decorative boards now
  unmount while paused (grid-nav, transform-match); Resume/Quit reachable on device.
- **Workout V2 full device journey PASS** (first ever): `/results?id=` mount crash found
  (array styles into `<Slot>` children) and fixed; default daily journey 4/4 with
  relaunch persistence and DB evidence (`current_index=4`, `status=completed`).
- **Operational hazards durably addressed:** lazy portability native requires (+ typed
  rebuild diagnostic + ops guidance in `scripts/qa/README.md`); CNG android config
  codified in committed config plugins (`apps/mobile/plugins/`), proven by real prebuild.
- **Performance re-measured:** loadProgressSnapshot 102.7ms @20k via fast path.
- Deferred/blocked remainder (short-template workout traversal → 012; SAF system consent
  sheets blocked for emulator automation; iOS build/runtime blocked — no macOS host):
  `.agent/_tasks/campaign011-validation-backlog.md` FINAL closure ledger.

Campaign 009 COMPLETED at `e0d92ce` (38 games, full gates green, Android autobot QA).
Campaign 010 was an owner-directed bulk construction campaign: maximize production-code
implementation throughput. Two waves of specialized workers under one parent
orchestrator with strict disjoint write ownership (packets in `.agent/_tasks/campaign010/`).

### 010 outcome

- **Catalog:** 38 → **42 games**. NEW: `attention-sustained-vigilance` "Signal Watch"
  (SART-like go/no-go vigilance), `speed-order-sweep`, `math-value-ordering`,
  `memory-prospective-cue` "Cue Keeper" (prospective memory). Math content tiers
  deepened across all four existing math games.
- **GameHost consolidation (D1):** shared session/lifecycle/pause/QA/tutorial/results
  host in `components/game-host`; 18 of 42 games migrated; contract scanner extended.
- **Workout V2 + Personalization V2:** templates/focus/lengths/history/rotation;
  explainable weighted-signal recommender (`src/personalization`); home surfacing.
- **Progress/Analytics V2 + query rewrite:** trend/volume/PB/window/comparison
  modules; SQL projection path + repository primitives targeting the measured
  101 ms @20k snapshot debt; schema v9 rating_history index.
- **Portability:** single-pass serialization; durable FileBackupTransport +
  share/picker seams (D2) — parent-implemented after W10 truncation.
- **Engagement V2:** achievement chains/tiers, quest refresh/history, reward inbox +
  idempotent claim-all, cosmetic collection progress, provenance feed.
- **UX/IA, accessibility, platform:** shell states/components, home workout UI;
  a11y primitive program (announcements/focus/reduced-motion/font-scale caps/touch
  targets/dialogs); 7 unused native dependencies removed; expo-audio permission
  overreach trimmed at plugin source (app.json source of truth); safe-area + keyboard
  platform seams; perf instrumentation (D4); sync-readiness seams (D3);
  entitlements/notification/assistant seams.

**Validation status (historical, at 010 close):** `IMPLEMENTED — NOT VALIDATED` unless
previously evidenced. Convergence checks run: tsc PASS (0 errors), catalog contracts
16/16, registry --check PASS, repo-state PASS. Full Jest / lint / web export / emulator
QA / benchmarks / iOS: NOT RUN by design. Superseded: Campaign 011 validated all of it
(see `### 011 outcome` above and `.agent/VALIDATION.md`).

### 009 summary (completed)

Campaign 008 (Wave 02 recovery, 36 games) COMPLETED at `d1b371f`. Campaign 009 then ran
as ONE parent-controlled session with up to 16 specialized worker agents under strict
disjoint write ownership (packets in `.agent/_tasks/campaign009/`). Workers never
branch/commit; the parent owns integration, generated files, git, and durable state.

### 009 summary

- **Catalog:** 36 → **38 games**. NEW: `memory-pair-recall` (associative pair recall
  with deterministic re-pairing interference) and `math-number-line-estimation`
  (magnitude interpolation on a seeded number line). Registry regenerated exactly once.
- **Critical/High repairs:** logic-deduction-table unsound uniqueness prover shipped
  ambiguous rounds (now exhaustive + property-proven); db v8 migration could brick
  startup on legacy ledger data (collision-safe atomic backfill); foreign-profile-id
  backups created invisible profiles on restore (normalized); attention-target-count
  pause exploit inflated scores; speed-color-match wall-clock timing + pause window;
  stroop unanswerable neutral trials / session-ending timeout / fabricated RTs /
  capped perfect score; task-switch identical stimuli every round; rule-flip constant
  block lengths; fold-match degenerate distractors; silent SFX failure for context-fit
  + cue-shift (missing aliases); reroll allowed on completed workouts; paidReroll
  in-transaction balance check; profile double-tap purchase guard.
- **Depth additions:** workout end-to-end lifecycle suite + staleness personalization;
  rating NaN/invariant hardening (24 tests); economy claim idempotency via ledger
  operationIds; progress insights (training balance, personal bests, recent-vs-lifetime,
  explainability); portability adversarial hardening (typed early rejection, DoS gate,
  exact wipe counts); a11y shell program (44pt targets, live regions, 43 contract
  tests); perf guards + measured baselines; catalog-wide source contract tests;
  test-utils fixture infrastructure; CI OpenSpec gate added; QA harness derives the
  catalog from game.json (scales with growth) + richer smoke chain + machine-readable
  failure artifacts; iOS static-compat + architecture-debt audit reports
  (`docs/audits/`).
- **Rejected (quality bar):** sustained-vigilance Attention game (top follow-up
  candidate), Speed addition (no clearly distinct mechanic), Flexibility/Spatial
  additions (declined by W04 as insufficiently distinct).

**Validation (final tree):**

- `node scripts/validate-repo-state.mjs`: PASS
- `npx tsc --noEmit` (apps/mobile): PASS (0 errors)
- `npx jest --ci --maxWorkers=2`: PASS — 391 suites / 4530 tests / 4 snapshots
  (+1 opt-in perf probe skipped by design)
- `npm run lint`: PASS — 0 errors (208 warnings, non-blocking)
- `node scripts/generate-game-registry.mjs --check`: PASS (38 games)
- `node scripts/validate-provenance.mjs --check`: PASS
- `node scripts/validate-task-ownership.cjs`: PASS
- `node scripts/validate-offline.mjs --check`: PASS (CLEAN)
- `npx expo export --platform web`: PASS
- `npx expo-doctor`: 20/21 (pre-existing patch-version drift; dependencies
  byte-identical to origin/main — no dependency change this campaign)
- `npx --no-install openspec validate --changes`: PASS
- Emulator QA: see VALIDATION.md "Campaign 009" (autobot, emulator-local)

## Authoritative active change

`openspec/changes/006r-core-integrity-correction/` remains the last validated
openspec change; campaign 009 was an owner-directed single-session development
executed outside openspec.

Fresh-agent entry: `.agent/CURRENT_CAMPAIGN.md` + `AGENTS.md` + `docs/PROJECT_CONSTITUTION.md`

## Important invariants

- GitHub `main` is canonical; no autonomous force-push to `main`
- Android-first autonomous QA; one dedicated AVD by default
- No host physical mouse/keyboard automation
- Worker swarms only with explicit disjoint ownership; shared/generated files are
  parent-only (`AGENTS.md`, `.agent/_tasks/campaign009/README.md`)
- Generated files are updated through generators only
- Missing validation is never PASS

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`, relevant ADRs and Git history
