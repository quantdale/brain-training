# Durable Project State

**State schema:** 1
**Last update:** 2026-08-26 (Campaign 014 opened: Experience Depth &
Replayability. W1 product-depth audit complete — all 42 games rubric-scored,
priority stack P0–P4 in `.agent/CAMPAIGN014_AUDIT.md`. Game-depth wave 1
landed: 13 games mechanically deepened via six parallel packets — adjacency-
route pattern-tap-back generator, running-order palette 6→12 + Hamming≥2,
reaction-time Go/No-Go, quick-compare real decoys + proximity spread,
symbol-tracker respond deadline, target-count escalation ladder, equation-
builder expert templates ×2.5 + failure solution-reveal, deduction-table
anti-giveaway minimal-proof selection, stroop window-normalized speed bonus,
rule-flip uncued inference windows, card-sort WCST discovery blocks, fold-match
speed-basis fix + hidden fold label, coordinate-turn shuffled options + timed
brief, transform-match hidden-source choice + per-cell a11y labels.
Full Jest 478 suites / 5947 tests PASS; tsc clean; lint 0/0; registry
regenerated (version bumps). Language-family depth (word-chain/context-fit/
scramble pools) and shared systems (mastery engine, Daily Spotlight, Workout
V3 wiring, Progress V3/Home/discovery surfaces) in progress.)
**Canonical branch:** `main`
**Active campaign:** 014-experience-depth-replayability

## Current status

Campaign 013's release gate is **GREEN**: the definitive single-driver
`--mode certify` run (20260826-012026, SHA ba6dd84, emulator-5558,
62m36s) reached **42/42 attempted / 42 PASS / certified=true** with
preflight 7/7 and zero missing/duplicates/unexpected. Workout V2 daily,
short, focus and resume journeys all PASS on the same build. Pause-probe
coverage is carried by Run A (42/42 with probes on, one disclosed retry);
the residual pause/resume a11y race is tracked as Medium debt (honest-
retry converts it; see KNOWN_ISSUES).

### What landed in the 013 hardening window (commits 95fbd55 → HEAD, pushed)

- Lint 474 → 0 errors / 0 warnings (no suppressions).
- Schema v10 adversarial matrix (+18 tests, mutation-proven).
- Game-family audits: 4 real gameplay defects fixed with regressions
  (prospective-cue stale closure + pause-restart exploit, odd-one-out
  post-deadline grace, color-match negative-RT guard).
- Certification-driven product fixes: fractional duration_ms REAL bug
  (persistence-boundary coercion), language hybrids generatorVersion
  provenance, celebration boxShadow (LogBox snackbar tap interception).
- QA harness: `--mode certify` release profile (completeness, atomic
  journal, provenance, 7-check preflight, failure taxonomy, row-invariant
  validators, nav-zone scroll guard, pause-aware force-win, honest-retry);
  self-test 28 → 49; lock fail-closed; permissions drift pin.
- NativeTabs deterministic normalizer + integrated navigation snapshot.
- Dependency refresh: 6 Expo SDK-57 patch alignments (doctor 21/21);
  16 advisories classified build-toolchain-only.
- Docs reconciled: README, MASTER_PLAN (through 013), PARITY_MATRIX,
  BACKLOG, KNOWN_ISSUES, VALIDATION, DEPENDENCY_AUDIT, QA README.

### Validation snapshot (2026-08-26, closure)

- Repo gates: repo-state PASS, registry --check PASS, provenance PASS,
  ownership PASS, offline CLEAN (919 files), self-test 49/49
- tsc CLEAN · eslint 0/0 · doctor 21/21
- Jest: 474 suites / 5821 tests PASS
- Web export: PASS (20 static routes)
- Android: **certify 42/42 certified=true** (20260826-012026) + Workout V2
  daily/short/focus/resume ALL PASS
- npm audit: 16 build-toolchain-only (unchanged)
- Clean-checkout proof (worktree at HEAD): npm ci → validators → tsc →
  eslint → doctor → Jest all PASS; worktree removed

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

Deliver the certification report and close Campaign 013 (checkpoint +
COMPLETED status). Post-campaign: no implementation campaign is selected
until the owner/planner chooses the next direction. Remaining tracked
debt: pause/resume a11y race (Medium, honest-retry converts), SAF sheets
(manual), iOS build (NOT VALIDATED on Windows), 16 build-toolchain-only
npm advisories (accepted).

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/CURRENT_CAMPAIGN.md`
5. `.agent/checkpoints/012-broad-convergence-COMPLETED.md`
6. `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`
