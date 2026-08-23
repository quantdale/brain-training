# Durable Project State

**State schema:** 1
**Last update:** 2026-08-23 (Campaign 012 waves 1-3 landed: GameHost 42/42, Workout V2 complete, content debt resolved, RC polish, perf evidence-negative, build determinism proven, dependency pins lifted; device journeys pending parent run)
**Canonical branch:** `main`
**Active campaign:** `012-broad-convergence-release-prep`

## Current status

Campaign 012 is materially complete on implementation. All 16 packets (W01-W16)
are COMPLETED with committed evidence. Remaining campaign work is the
parent-owned runtime QA pass (emulator journeys through migrated-game canaries
and new workout template flows), final gate confirmation (web export,
OpenSpec), and closeout.

### Wave summary (all pushed to `origin/main`)

1. **Wave 1 (`0669f8e`) - GameHost migration COMPLETE.** All 24 remaining
   legacy games migrated onto `<GameHost>` + `useGameSession` +
   `<GameResults>` (42/42). Thin pause-overlay adapters deleted.
   `EXPECTED_NON_MIGRATED_COUNT` pin -> 0 with empty-roster-safe suite
   structure. Equation-builder dead easy templates resolved by W09 (9 dead
   entries proven unreachable at every regime; machine-verified replacements;
   permanent reachability tripwire; generatorVersion 1.3.0). W15 audit report
   delivered. Full Jest at integration: 460 suites / 5714 tests PASS.
2. **Wave 2 (`acd709c`) - consolidation + product depth.** W05 host
   `resumeIfPaused()` guard; W06 workout engine depth (lengths/focus/resume/
   history/reasons persistence w/ alignment gate; synthetic-60 registry tests);
   W07 workout UX (picker/details/resume/completed/history/focus explanation/
   summary + full testID inventory); W11/W12 release polish (loading/error/
   empty hierarchies, recovery CTAs, two-tap destructive confirms, honest
   data-management copy); W13 performance EVIDENCE-NEGATIVE (baselines in
   `scripts/perf/baselines/`, slower refactor reverted); W16 iOS static fixes.
   CI-profile Jest green at integration.
3. **Wave 3 (`d2a304a`) - harness + audits + adoption.** W08 autobot modes
   `workout-short` / `workout-focus` / `workout-resume` (+ `--list-flows`,
   offline validation, 28/28 self-test); W10 global content sweep across all
   37 non-math games x 4 difficulties x 8 seeds - catalog CLEAN, tripwire
   committed; W14 Android determinism PROVEN (two clean prebuilds into temp
   dirs, 0 differing files, hashes recorded; RECORD_AUDIO blockedPermissions;
   NDK plugin refactored+tested); `resumeIfPaused()` adopted across all 42
   screens (grep-verified).
4. **Dependency wave (`4c9b4a8`) - pins lifted per W15.** expo ~57.0.15,
   expo-linking ~57.0.7, expo-router ~57.0.15, constants floor ~57.0.13,
   audio floor ~57.0.4; `expo.install.exclude` removed; npm version aligned
   to app.json 0.1.0. expo-doctor 21/21 verified post-lift.

### Validation snapshot (2026-08-23)

- `tsc --noEmit`: CLEAN
- `npm run test:ci` (jest --ci --maxWorkers=2): **469 suites / 5781 tests PASS,
  0 failures** (5 skips = PERF_PROBE-gated probes)
- `expo lint`: 0 errors (~190 pre-existing warning class)
- Repo gates: repo-state PASS, registry --check PASS, provenance PASS,
  ownership PASS, offline CLEAN; expo-doctor 21/21
- Web export + OpenSpec: re-run pending at closeout (see VALIDATION.md)

### Known load-sensitivity (documented, not hidden)

Unbounded-worker full-suite runs on this workstation can time out 3-4 heavy
full-router UI suites (app-shell, progress-detail, results-workout-cta,
celebration). Each passes in isolation AND under the sanctioned `test:ci`
profile; explicit 30s timeouts pinned on the two heaviest render tests. This
is RNTL v14 + React 19 renderRouter timing under CPU contention, not a product
defect.

## Authoritative active change

`.agent/CURRENT_CAMPAIGN.md` + `.agent/_tasks/campaign012/` (all 16 packets
carry completion summaries).

## Important invariants

- GitHub `main` is canonical; coherent green waves pushed.
- Android-first autonomous QA; one AVD; one Metro; emulator-local input only.
- Up to 7 coder agents with disjoint ownership; workers never commit.
- No autonomous force-push to `main`.
- Generated files updated only through generators.
- Missing validation is never PASS (`NOT VALIDATED` recorded honestly).
- Deferred product decisions untouched (branding, accounts, cloud sync,
  pricing, ads, AI, social, notifications, store listing).

## Next required action

Parent-owned closeout sequence:

1. Regenerate local android/ via prebuild (stale pre-011 tree) and rebuild dev
   client (dependency wave bumped native modules-core) before device QA.
2. Run workout journeys (`workout-short`, `workout-focus`, `workout-resume`)
   + migrated-game canary journeys on the AVD.
3. Strong-preference full 42-game catalog run if environment stable.
4. Final full gates incl. web export + OpenSpec; campaign close state.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `.agent/_tasks/campaign012/W01.md` ... `W16.md`
7. `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`
8. Git history for wave SHAs: `0669f8e`, `acd709c`, `d2a304a`, `4c9b4a8`
