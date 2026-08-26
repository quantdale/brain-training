# Campaign 013 — COMPLETED: v1 Release-Candidate Certification

**Date:** 2026-08-26
**Verdict:** **CERTIFIED V1 RELEASE CANDIDATE** (with recorded Medium debt
and standard external limitations — none Critical/High)
**Starting SHA:** `174ba4e` (campaign opened at 012 closure)
**Final SHA:** see `.agent/STATE.md` / `git log` (this commit)
**Certification run:** `qa-artifacts/20260826-012026-autobot-certify`
(SHA ba6dd84, emulator-5558 / braintraining-qa36, API 36, 62m36s,
**42/42 attempted · 42 PASS · certified=true**, preflight 7/7)

## Objective

AUDIT → COMPLETE → HARDEN → POLISH → VALIDATE → CERTIFY the locked v1
scope: bring the 42-game offline-first product to a defensible release
candidate and prove it with a deterministic, failure-diagnostic
certification pipeline.

## What shipped (by area)

### Database / persistence
- Fractional `duration_ms` persisted as REAL (High): `completeSession`
  coerces all INTEGER-declared columns; regression pins
  `typeof(duration_ms)=='integer'`.
- Schema v10 adversarial matrix (+18 tests, mutation-proven): idempotent
  column guard, 8 malformed metadata cell shapes, legacy backup envelopes,
  failure-injected atomicity, newer-schema rejection.

### Individual game correctness (4 real defects, all regression-tested)
- memory-prospective-cue: stale-closure scoring paid max speed bonus
  regardless of reaction time; pause/tutorial restart granted a fresh full
  response window (timing exploit).
- attention-odd-one-out: taps after the monotonic deadline were accepted
  (free time per round).
- speed-color-match: negative reaction readings could poison stats.
- language hybrids (context-fit/word-chain/word-match): generatorVersion
  null → persisted 0 (provenance gap); now 1.0.0, pinned by catalog test.

### Lifecycle / concurrency
- Pause/resume attack matrix on device across runs; workout back-nav stack
  depth fixed in the harness (BACK-until-Home + relaunch recovery); honest
  single-retry for stochastic races with both attempts recorded.

### UX / accessibility
- Celebration shadow* → boxShadow (RN 0.82): the deprecation warning docked
  a LogBox snackbar over bottom controls and intercepted taps.
- Shared shell audit found no 44pt/label/state gaps (evidence in worker
  report); tutorial overlay + short-viewport behavior verified.

### QA automation (the certification pipeline itself)
- `--mode certify`: 42/42 completeness (missing/duplicate/unexpected
  detection), atomic incremental run journal (IN_PROGRESS →
  COMPLETED/INCOMPLETE + certified flag), git/build provenance, 7-check
  environment preflight, failure taxonomy, lifecycle-aware late
  interaction attempt, persisted-row invariant validators, honest-retry,
  LogBox dismissal, nav-zone scroll guard, pause-aware force-win,
  QA_METRO_PORT bridge for co-tenant port wars. Self-test 28 → 49.
- Lock fail-closed (EPERM ≠ stale); permissions drift pinned by test.

### Security / dependencies
- 16 advisories, all build/dev-toolchain-only (image-size via Metro; uuid
  via Expo config toolchain); no runtime-reachable; no blind upgrades.
- 6 Expo SDK-57 sibling patch alignments (doctor 21/21 restored).
- Secrets scan: zero hits. Offline boundary: CLEAN (919 files).

### Documentation / OpenSpec
- README (plugin path), MASTER_PLAN (through 013), PARITY_MATRIX (919
  files, QA row), BACKLOG, KNOWN_ISSUES (debt triaged + contamination
  lessons), VALIDATION (full wave evidence), DEPENDENCY_AUDIT (current),
  QA README (certify mode). OpenSpec 006R emulator items superseded by
  Campaign 011/012/013 device evidence (recorded in tasks.md notes).

## Validation counts (final tree)

| Gate | Result |
| --- | --- |
| repo-state / registry --check / provenance / ownership | PASS |
| offline boundary | CLEAN (919 files) |
| autobot self-test | 49/49 |
| tsc --noEmit | CLEAN |
| eslint | 0 errors / 0 warnings (was 474) |
| Jest | 474 suites / 5821 tests PASS |
| expo export --platform web | PASS (20 routes) |
| expo-doctor | 21/21 |
| npm audit | 16 build-toolchain-only (prod view identical) |
| Android certify | 42/42 PASS, certified=true |
| Workout V2 | daily/short/focus/resume ALL PASS |
| Clean-checkout proof | npm ci → validators → tsc → eslint → doctor → Jest all PASS (worktree removed) |
| iOS build | NOT VALIDATED (no macOS/Xcode on host) |

## Remaining issues (honest)

**Critical:** none. **High:** none.

**Medium:**
- Pause/resume a11y/touch race on 2 deep-content games (deduction-table,
  sequence-memory): intermittent, environment-correlated, converts via the
  disclosed honest-retry; product pause/resume passed for 40/42 games and
  all 4 Workout journeys. Closure: root-cause the overlay touch/a11y
  collapse under load.

**Low / accepted:**
- npm audit 16 build-toolchain-only advisories (no upstream fix for
  image-size; uuid resolves with the next planned Expo SDK upgrade).
- Achievements sync scan cap (~78ms @5000, documented).

**External / manual (NOT VALIDATED by policy, not defects):**
- iOS build/runtime (Windows host, no Xcode).
- SAF share-sheet/document-picker system consent sheets (require human
  interaction; engine round-trips device-proven via pulled DBs).

## Environment incidents (recorded, all survived)

Cross-project emulator contamination (isolated AVD + foreground preflight
now guard), co-tenant port-8081 server (Metro bridged to 8083), host memory
churn (Metro 5×, emulator wedges 3×, transient ENOSPC), transient GitHub
connectivity. No evidence was faked through any of it; failed runs are
preserved with INCOMPLETE/failed journals.

## Post-campaign state

Campaign 013 closes COMPLETED. v1 is a certified release candidate. No
follow-up campaign is auto-started; the owner/planner selects the next
direction (hardening debt: pause a11y race; or deferred scope).
