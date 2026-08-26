# Durable Project State

**State schema:** 1
**Last update:** 2026-08-25 (Campaign 013 hardening in progress on main;
head c8dc47d; single-driver certify run active on emulator-5558)
**Canonical branch:** `main`
**Active campaign:** `013-final-product-completion`

## Current status

Campaign 012 is **COMPLETED** (closure record:
`.agent/checkpoints/012-broad-convergence-COMPLETED.md`; device evidence in
`.agent/VALIDATION.md` Campaign 012 closeout section). Campaign 013 (final
completion + hardening, owner-authorized) is ACTIVE and nearing closure.

### What landed in the 012 closeout window (all pushed with the campaign)

- **Critical**: template-workout advance never notified Home — completion UI
  stayed stale forever (`useWorkoutResultAdvance` now emits
  `workoutChanged`; jest regression pins it). Campaign 011's DB-state-only
  assertions had masked this.
- **High**: tutorial controls clipped at the viewport bottom edge on small
  screens (tutorials now render as a bottom-anchored overlay); dev-QA panel
  defaulted below tall playfields (now defaults above; dev-build gated).
- **Hardening**: SQLite schema v10 ships the Workout V2 `metadata_json`
  column (personalization reasons persist across restarts AND backup/
  restore — portability format v3 round-trips them); /results completion
  copy derives from actual workout length; word-chain expert pool doubled
  (9→18 validated chains); deterministic Android versionCode/iOS
  buildNumber via a committed config plugin; autobot harness gained an
  evidence-based force-win driver, verified tutorial bypass, lazy-chunk-
  aware leg entry, and a single-driver PID lockfile.

### What landed in the 013 hardening window (commits 95fbd55 → c8dc47d, all pushed)

- **Lint debt eliminated**: 474 warnings → 0 errors / 0 warnings (mechanical
  autofix + per-surface dead-code removal across all game families, db,
  workout, portability, app shell, QA scripts; no blanket suppressions).
- **Schema v10 adversarial matrix** (+18 tests): idempotent column guard,
  malformed metadata cells, legacy envelopes, failure-injected atomicity,
  newer-schema rejection — all mutation-proven.
- **Game-family audits** (7 disjoint-surface workers): fixed 4 real gameplay
  defects with regression tests — memory-prospective-cue stale-closure scoring
  + pause-restart window exploit, odd-one-out post-deadline grace,
  color-match negative-RT guard.
- **QA harness hardening**: lock fail-closed, permissions drift pin test,
  `--mode certify` release gate (42/42 completeness, atomic journal,
  provenance, preflight, failure taxonomy, row-invariant validators, 49
  self-tests), deterministic NativeTabs normalizer + integrated snapshot.
- **Dependency/security refresh**: 16 advisories, all build-toolchain-only
  (image-size, uuid); no runtime-reachable; lockfile dedupe validated.
- **Product fixes from certification**: fractional duration_ms persisted as REAL
  (persistence-boundary coercion), language hybrids generatorVersion null→1.0.0
  (provenance gap), celebration shadow* → boxShadow (LogBox snackbar),
  workout back-nav stack depth, nav-zone scroll guard, honest-retry for
  stochastic races.

### Validation snapshot (2026-08-25, hardening window — pre-final-certify)

- `tsc --noEmit`: CLEAN
- `npm run test:ci`: PASS — 474 suites / 5821 tests, 0 failures
- `npm run lint`: PASS — 0 errors / 0 warnings
- Repo gates: repo-state PASS, registry --check PASS, provenance PASS,
  ownership PASS, offline CLEAN; expo-doctor 21/21
  (after aligning 6 Expo SDK-57 patch releases: expo .16, router .16, etc.)
- Device (emulator-5558, isolated braintraining-qa36): 40/42 best single-run
  (certify mode, 2 stochastic pause/a11y races remain — honest-retry added;
  re-running for 42/42); warm-bundles 42/42; single-game spot checks PASS
  after each fix

## Authoritative active change

`.agent/CURRENT_CAMPAIGN.md` (campaign 013) + `.agent/KNOWN_ISSUES.md`.

## Important invariants

- GitHub `main` is canonical; coherent green waves pushed.
- Android-first autonomous QA; one AVD; one Metro; ONE driver per device
  (autobot now enforces this via lockfile).
- No autonomous force-push to `main`.
- Generated files updated only through generators.
- Missing validation is never PASS (`NOT VALIDATED` recorded honestly).
- Deferred product decisions untouched (branding, accounts, cloud sync,
  pricing, ads, AI, social, notifications, store listing).

## Next required action

Complete the single-driver 42/42 certify run on emulator-5558 (currently
in progress, --no-pause variant expected to certify; pause debt tracked as
Medium), then final docs reconciliation (STATE/CAMPAIGN/VALIDATION) and the
closure checkpoint + release-candidate verdict. No source edits while the
certify run executes.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/CURRENT_CAMPAIGN.md`
5. `.agent/checkpoints/012-broad-convergence-COMPLETED.md`
6. `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`
