# Durable Project State

**State schema:** 1
**Last update:** 2026-08-21 (campaign 010 opened: mass product implementation wave, 16 worker packets in `.agent/_tasks/campaign010/`; BUILD NOW / VERIFY LATER — validation deferred to campaign 011)
**Canonical branch:** `main`
**Active campaign:** `010-mass-product-implementation`

## Current status

Campaign 009 COMPLETED at `e0d92ce` (38 games, full gates green, Android autobot QA).
Campaign 010 is an owner-directed bulk construction campaign: maximize production-code
implementation throughput across up to 16 specialized workers with strict disjoint
write ownership. Testing/hardening is explicitly deferred to Campaign 011; anything
unverified is recorded `NOT VALIDATED — Campaign 010 implementation-only wave` and
queued in `.agent/_tasks/campaign011-validation-backlog.md`.

### 010 scope (in flight)

4 new games (attention-sustained-vigilance + Speed/Math/Memory-or-Logic additions),
GameHost consolidation (D1), Workout V2, Personalization V2, Progress/Analytics V2,
query performance rewrite (101ms@20k debt), backup single-pass serialization +
transport wiring (D2, deps added by parent), DB repository maturation, Engagement V2,
UX/IA depth, accessibility primitives (B1/D5), platform/deps cleanup (A1/A4/B7),
cross-platform seams (B5). See `.agent/CURRENT_CAMPAIGN.md`.

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
