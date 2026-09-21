# Campaign 065 — closure

**Change:** `065-adversarial-convergence-runtime-data-pixel`
**Status:** VALIDATED
**Verdict:** `CHANGE_065_COMPLETE`
**Predecessor:** `064-dependency-security-validation-gates` (VALIDATED)
**Program:** `056-067-overnight-autonomous-program` (NIGHT)

## What changed

Six independent read-only critic lanes attacked `a9111c3` and produced
the bounded fix list in `CRITIC_FINDINGS.md`. Highlights:

**Real defects repaired**
- Replace import with a matching progression fingerprint + empty
  catalogs could brick bootstrap in a permanent FK recovery loop — the
  replace path now strips the imported fingerprint and seeding verifies
  the persisted catalogs before trusting a match.
- The expo adapter's transactions ran on a second native connection with
  `foreign_keys` OFF — transactions now run on the pragma'd connection
  with the pragma re-asserted before `BEGIN`, with a contract test
  pinning the statement order and rollback propagation.
- `initDatabase` re-entry leaked connections / split the write queue —
  now idempotent, with an explicit `resetDatabaseForTests()` seam for
  suites that need fresh DBs.
- Workout repair/reconcile were blind read-modify-write/delete against
  the advance CAS — now `observeRepair` + `applyRepair` CAS on the raw
  row state; `applyReroll` pins `game_ids_json`.
- Wipe/replace never invalidated in-memory workout state — now emits
  workout-changed.
- Streak-purchase retries generated a fresh random `operationId`
  (double-charge) — stable per-intent key, cleared only on success.
- `domain_ratings.updated_at` could move backwards — `MAX(...)`.
- PB could fire for a future-dated session (count 0 or an earlier
  session standing in) — future-dated journeys are refused up front and
  exactly one eligible session is required.
- The console gate was bypassed by `jest.spyOn(console, …)` in 45+ test
  files — guarded methods are now locked and every spy site converted to
  `expectConsoleNoise` (58 sites, 50 suites).
- QA-gate production-safety suites were dead code — now unconditional.
- Skip allowlist could absorb renamed/additive skips — schema v4 pins
  the exact reviewed full name plus a count, with reviewed suite/test
  floors.
- In-session results/failures were silent to assistive tech; three
  sub-44 dp control families and a non-wrapping pause row existed — all
  fixed.

**Catalog-wide guards added**
duplicate score statement, pause wiring (real GameHost strip), touch
target floors (which surfaced and fixed 7 game components), tutorial
`TutorialFrame` adoption (both speed games migrated).

**Governance/evidence reconciled**
`GOVERNANCE.activeProgram` registered and cross-checked against the
ledger cursor by `validate-repo-state.mjs`; STATE.md/CURRENT_CAMPAIGN
banners updated; 063/064 record `certifiedArtifactCommit: e627473`;
campaign-055 overclaims carry dated corrections; `.gitignore` residue
removed; `dist/` purged (`qa-artifacts/` is emulator-held at close,
gitignored and disposable).

## Terminal validation

| Gate | Result |
|---|---|
| Full Jest matrix | **PASS** — 588 suites (584 passed + 4 skipped), 6,893 passed / 5 classified opt-in skips (6,898), 5 snapshots, exit 0 (214.4 s) |
| Jest signal | **PASS** — exact-name pinning, floors 575/6,840 met, 0 unclassified/ambiguous, 0 unexpected console output |
| Typecheck / lint | **PASS** (0 / 0) |
| Expo Doctor | **PASS** (21/21, 064 run on unchanged config) |
| OpenSpec `--all --strict` | **PASS** (48 changes + 065) |
| repo-state / task-ownership | **PASS** (active program printed and cross-checked) |
| Validators | offline 30/30 CLEAN; secrets PASS CLEAN; provenance 13/13 + freshness OK; affected 16/16 + sync OK; runtime-QA 16/16 PASS; dependency-audit 41/41; workflows 44/44 PASS |
| Probe runner | 5/5 (064 close; unchanged by 065) |
| Catalog repeatability | 7 bounded re-runs, identical counts, no flake/open handles |
| Device (bounded) | APK `3A3C4CC5…` (109,604,369 B): clean install, cold 5,455 ms + warm 4,378 ms Home, crafted fingerprint-injection recovered to Home with re-seeded catalogs, SQLite ok/v12/0-FK, 1,084 log lines 0 fatal/ANR — `DEVICE_065.md` |

## Adversarial closure

A closure verifier attacked every fix (transaction rewrite, init
idempotence, progression brick, workout CAS, console lock, allowlist
floors, catalog guards, governance validator, evidence honesty). It
confirmed the core fixes hold and found four residual items — all
repaired and re-verified:

1. PB still admitted a future-dated session when an earlier at-or-above
   session existed → future-dated refusal added + two tests.
2. Allowlist could absorb a renamed skip one-for-one → exact
   `testFullName` pinning + renamed-skip negative fixture.
3. `activeProgram` was not cross-checked against the ledger → ledger
   `**Current change:**` field enforced by `validate-repo-state.mjs`.
4. Evidence wording (baseline tense, guard scope) → corrected.

## Boundaries

The 063 artifact remains the last certified executable (065 changes
product source). Full six-way pixel/a11y certification, the remaining
41 games' gameplay captures, landscape/RTL, UI-driven import/wipe
probes, and final artifact certification belong to 067. Coverage
thresholds, v12 repair semantics, backup fsync, and snapshot review debt
are deferred with recorded rationale.
