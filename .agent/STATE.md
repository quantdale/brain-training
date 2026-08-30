# Durable Project State

**State schema:** 1
**Last update:** 2026-08-30 (Campaign 016 terminal convergence began from exact
source head `f0d301bc1b80ed657c75af81c476ee87dbeea540`, which is also the latest
independently verified all-green CI source before this documentation-only
closure). Full Jest is PASS (489 suites / 6056 tests, 0 failures, 4 opt-in suite
skips and 5 opt-in test skips, all allowlisted); DB integrity/idempotency,
migrations, backup/rollback, and both opt-in performance probes are PASS.
Jest signal validation is PASS (0 unclassified skips, 0 unexpected warnings).
Android clean native generation/release build and iOS simulator compile are
PASS on that exact source head in GitHub Actions. Dedicated Android runtime,
hierarchy, and manual UX remain BLOCKED/NOT VALIDATED because no designated
project device is available and the documented emulator failure persists. No
Critical/High product regression or material data-loss/corruption defect is
currently known.
**Canonical branch:** `main`
**Active campaign:** none
**Last campaign:** 016-release-certification-hardening
**Last campaign status:** VALIDATED

## Current status

Campaign 016 — Release Certification & Hardening is **VALIDATED**. The
repository is in a terminal state with no active campaign; no Campaign 017 was
created. The final classification is **LOCALLY / AUTOMATED COMPLETE — EXTERNAL
DEVICE / MANUAL CERTIFICATION PENDING**. This closes repository-owned
implementation, automated certification, native build-smoke, and exact-SHA CI
work while preserving unavailable runtime/manual evidence as explicit
non-PASS classifications.

Current automated evidence includes repository/OpenSpec/ownership/registry/
provenance/offline validators, QA self-test 49/49, TypeScript, lint, full Jest,
Jest-signal validation, web export (20 static routes), Expo Doctor (21/21), DB
integrity/idempotency, migration matrix/robustness/v10 hardening,
backup/import/rollback, storage/database-lock boundaries, workout attribution
and lifecycle tests, the 6-suite/28-test production-boundary set, and both
performance probes. The local host required `npm ci --ignore-scripts` under
Node 22 because the ordinary install cannot compile `better-sqlite3` without
`make`; GitHub's clean runner completed its normal install and native builds.

The current device inventory found only the foreign `study-maker-api35` AVD
(`emulator-5554`); it was not used or adopted. The designated
`braintraining-qa36` AVD is unavailable on this host, and prior bounded
37.1.11/WHPX/qemu recovery remains the external blocker. Therefore dedicated
Android install/start, Rule Grid/Transform Match canaries, Workout V3
daily/focus/relaunch, 42/42 current-head autobot certification, Android
hierarchy, TalkBack, SAF/system sheets, and manual iOS UX remain
**BLOCKED / NOT VALIDATED**. iOS compile PASS is not runtime UX PASS. Signing,
store submission, cloud/auth, telemetry, monetization, and other deferred
product decisions remain out of scope.

## Authoritative campaign state

An executable repository has one ACTIVE campaign in `GOVERNANCE.activeCampaign`,
`STATE`, `CURRENT_CAMPAIGN`, `EXECUTION_PROMPT`, OpenSpec, and task ownership.
This repository is terminal instead: `GOVERNANCE.activeCampaign` is `null`,
`lastCampaign` is `016-release-certification-hardening`, and its OpenSpec status
is `VALIDATED`. The structured fields in the other documents identify that same
last campaign and terminal status. This is an explicit no-successor state, not
an omitted or contradictory active campaign.

Historical Campaign 015/016 transition prose below is retained for recovery
and is historical; it does not override the terminal fields above.

## Historical Campaign 015 transition record

### What landed in 015 at transition (predecessor 014 COMPLETED at `f66f65c`)

- **P0 red-main recovery already done at `d645bbb`/`6451bfb`:** precise first-leg-only slack + pre-creation guard in `advance.ts` + `db/workout.ts`, fixing 2 Jest suites red at `4ac4d45` (advance.test.ts historical 500 vs 1000, workout-v2.test.ts equal-timestamp 20_000); adversarial attribution matrix, full local green, App CI should now be green on the repair SHA; repo-state/ownership/OpenSpec green, `STATE` synced at `6451bfb`.
- **0 predecessor closure already done at `f66f65c`:** 014 COMPLETED with docs-final DONE (MASTER_PLAN 013→COMPLETED + new 014 section, PARITY_MATRIX V3/mastery/Spotlight), AVD `braintraining-qa36` restored at 6 AVDs and boots to `sys.boot_completed=1` in ~30s with `-memory 3072 -no-snapshot`, APK 80M `BUILD SUCCESSFUL` + `adb install` `Success` + `am start` success, prior dedicated-AVD green at `f4aa44c` considered exit evidence per honest NOT VALIDATED for the re-run (emulator segfault after ~60-120s, `workout-focus` `IN_PROGRESS` then `device offline`).
- **This transition atomically sets 015 ACTIVE:** `change.json` PROPOSED→ACTIVE, `GOVERNANCE.activeCampaign` 014→015, `CURRENT_CAMPAIGN.md` + `EXECUTION_PROMPT.md` replaced with 015 pointers (12-hour envelope), `STATE.md` synced to 015 ACTIVE, `task-ownership.json` replaced with the 015 packet map (real repo-root paths, overlap/intersection semantics, per-packet validation). No game #43, no hardening.
### Validation snapshot at 015 transition (historical baseline; 015 ACTIVE, predecessor 014 COMPLETED at `f66f65c` / `6451bfb` head)

- Repo gates: repo-state PASS (now 015 ACTIVE, 5 delta specs), registry --check PASS, provenance PASS, ownership PASS (now 015 map with real repo-root paths, not 006R `src/**`), offline CLEAN (919 files), `npx @fission-ai/openspec validate --all` 2/2 PASS (015 ACTIVE now, not PROPOSED)
- tsc CLEAN · eslint 0/0 (last at 013 closure, no new lint-relevant code beyond `advance.ts`/`workout.ts` precise slack which is lint-clean) · Jest: 483 suites / 5973 tests PASS (now precise at `d645bbb`, was 2 failed at `4ac4d45` with blanket 10s window, now App CI should be green) · `node scripts/qa/autobot.mjs --self-test` 49/49 PASS (after WSL fixes)
- Android: prior dedicated-AVD green at `f4aa44c` (canaries 8/8 + daily 4/4 + focus 4/4 on `braintraining-qa36` / `emulator-5554`) considered the 014 exit evidence per honest NOT VALIDATED for the re-run with the precise slack at `d645bbb` (AVD at 6 AVDs, boots to `sys.boot_completed=1` in ~30s with `-memory 3072 -no-snapshot`, 80M APK `BUILD SUCCESSFUL` in 3m28s + `adb install` `Success` + `am start` success + `adb reverse` + `Metro` 8081 ready, but `qemu` dies after ~60-120s, `workout-focus` `IN_PROGRESS` then `device offline`; `run.json` 437 bytes). No foreign emulator adopted. Perf: opt-in probes NOT VALIDATED (statement-count green, wall-clock not re-run, honest).
- npm audit: 16 build-toolchain-only (unchanged, image-size via Metro, uuid via Expo config toolchain)

### Working state 2026-08-27 (015 ACTIVE at this transition: 014 COMPLETED at `f66f65c` / `6451bfb`, P0 + 0 already done, governance binding now ACTIVE)

- Transition atomically sets 015 ACTIVE (this commit): `change.json` PROPOSED→ACTIVE, `GOVERNANCE` 014→015, `CURRENT_CAMPAIGN` + `EXECUTION_PROMPT` to 015 (12-hour envelope), `STATE` to 015, `task-ownership` to 015 map (real repo-root paths, overlap/intersection, per-packet validation). No code change beyond governance/state/OpenSpec/ownership in this transition; game/content/runtime work is next.
- Prior 014 exit evidence remains `f4aa44c` prior green + `d645bbb` precise slack (unit-test-green) + `BUILD SUCCESSFUL` 80M APK + `adb install` `Success` + honest NOT VALIDATED for the re-run due to 37.1.x WHPX segfault (considered green for 014 per evidence policy). `validate-repo-state` PASS, `tsc` PASS, `self-test` 49/49, `avd.sh status` fast for `braintraining-qa36` (6 AVDs, `sys.boot_completed=1` in ~30s with `-memory 3072 -no-snapshot`).
- Docs-final DONE at `f66f65c` (MASTER_PLAN 013→COMPLETED + new 014 section, PARITY_MATRIX V3/mastery/Spotlight, README V3, `STATE`/`CURRENT_CAMPAIGN`/`KNOWN_ISSUES`/`VALIDATION` synced, contradictory 013 text resolved). `GOVERNANCE`/`STATE`/`CURRENT_CAMPAIGN`/`EXECUTION_PROMPT`/`task-ownership`/`change.json` now all agree on 015 ACTIVE with exactly one active campaign.
### Historical 015 authoritative-field design

This section records the 2026-08-29 015 activation snapshot only. It is
superseded by the terminal 016 fields at the top of this file.

### Authoritative machine-readable campaign fields (3.1)

At that historical point each durable recovery document carried one structured
field declaring the active campaign — surrounding human prose was NOT
authoritative:

| Source | Field | Example |
|---|---|---|
| `.agent/GOVERNANCE.json` | `activeCampaign` (JSON) | `"015-governance-depth-convergence"` |
| `.agent/STATE.md` | `**Active campaign:** <id>` | `**Active campaign:** 015-governance-depth-convergence` |
| `.agent/CURRENT_CAMPAIGN.md` | `**Campaign id:** `<id>`` + `**Status:** ACTIVE` | `**Campaign id:** `015-governance-depth-convergence`` |
| `.agent/EXECUTION_PROMPT.md` | `**Change:** `<id>`` + `**Status:** ACTIVE` | `**Change:** `015-governance-depth-convergence`` |
| `openspec/changes/<id>/change.json` | `id` + `status` | `"id": "015-governance-depth-convergence", "status": "ACTIVE"` |
| `.agent/task-ownership.json` | `change` | `"change": "015-governance-depth-convergence"` |

`scripts/validate-repo-state.mjs` parsed these structured fields (not substring
presence). The current validator additionally supports the explicit terminal
case recorded above; historical prose mentioning old campaign IDs does not
satisfy or override either state.


- GitHub `main` is canonical; coherent green waves pushed.
- Android-first autonomous QA; one AVD; one Metro; ONE driver per device
  (autobot now enforces this via lockfile).
- No autonomous force-push to `main`.
- Generated files updated only through generators.
- Missing validation is never PASS (`NOT VALIDATED` recorded honestly).
- Deferred product decisions untouched (branding, accounts, cloud sync,
  pricing, ads, AI, social, notifications, store listing).

## Next action

No executable campaign is active. Campaign 016 is terminal `VALIDATED`; a
future campaign requires explicit owner authorization and genuinely new scope.
If a designated project device or manual platform session becomes available,
record the pending Android/manual evidence under this validated campaign or a
future owner-authorized campaign. Do not create Campaign 017 merely to hold
manual/device work, add game #43, or broaden product scope.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/checkpoints/016-release-certification-hardening-VALIDATED-20260830.md`
6. `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`
