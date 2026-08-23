# Durable Project State

**State schema:** 1
**Last update:** 2026-08-23 (Campaign 012 COMPLETED after parent closeout QA;
Campaign 013 final-product-completion opened; schema v10; device defect
cluster fixed with regression coverage)
**Canonical branch:** `main`
**Active campaign:** `013-final-product-completion`

## Current status

Campaign 012 is **COMPLETED** (closure record:
`.agent/checkpoints/012-broad-convergence-COMPLETED.md`; device evidence in
`.agent/VALIDATION.md` Campaign 012 closeout section). Campaign 013 (final
completion + hardening, owner-authorized) is active.

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

### Validation snapshot (2026-08-23, closeout)

- `tsc --noEmit`: CLEAN
- `npm run test:ci`: PASS — 473 suites / ~5800 tests, 0 failures
- `npm run lint`: PASS — 0 errors (~430 warnings; reduction tracked as 013
  work, never suppressed)
- Repo gates: repo-state PASS, registry --check PASS, provenance PASS,
  ownership PASS, offline CLEAN; expo-doctor 21/21
- Device: canaries 8/8; Workout V2 short/focus/resume/daily ALL PASS;
  17 additional games terminally classified PASS (see VALIDATION.md)

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

Continue campaign 013: finish the single-session 42/42 catalog run under
the exclusive-driver lock, then warning-inventory reduction, documentation
reconciliation, and the certification report.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/CURRENT_CAMPAIGN.md`
5. `.agent/checkpoints/012-broad-convergence-COMPLETED.md`
6. `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`
