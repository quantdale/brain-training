# Durable Project State

**Last update:** 2026-09-05 (whole-codebase review wave at `6df0a97`): full local matrix green at head; four parallel deep audits dispositioned; the inert CI provenance-drift gate root-caused, fixed fail-closed in all three checking workflows, and CI-confirmed green (App CI `33942716376` logged its first real provenance base `e8e975a`; Repository Integrity `33942716408`, Android `33942716338`, iOS `33942716325` green). Evidence: `.agent/VALIDATION.md` "Whole-codebase review wave". Prior milestone: Campaign 021 validated on final SHA `05c16bc` — the release-gate contradiction closed with executable evidence (Android Build Smoke root-cause fix, workflow-hygiene guard, schema-guard self-heal, full local matrix + clean-checkout certification, dedicated-AVD runtime re-verification).
**Canonical branch:** `main`
**Active campaign:** none
**Last campaign:** 021-release-gate-reconvergence
**Last campaign status:** VALIDATED

## Current status

Campaign 021 — Release-Gate Re-convergence is **VALIDATED** and the repository
is terminal with no active campaign. Its full evidence chain (SHA/run
attributed) is in `.agent/VALIDATION.md` under "Campaign 021":

- Red Android release gate root-caused (producer-side SIGPIPE from the
  redundant `yes | sdkmanager --licenses` under the runner's default
  `bash -eo pipefail`; latent since the step's introduction, exposed when
  `c491c2b` removed the masking `|| true`) and fixed fail-closed at `1a946a9`
  with an installed-packages postcondition — no `|| true`, no weakened gate.
- The failure class is statically guarded by `scripts/validate-workflows.mjs`
  (16-assertion self-test) wired into Repository Integrity.
- Whole-codebase audit: F1 schema-guard crash window fixed (`4734fa0`:
  `CANONICAL_TRIGGER_DDL` derived from the schema + `ensureSchemaGuards()` on
  startup, proven self-healing on the live device DB); F2 write-path integer
  canonicalization audited — already fail-closed.
- Full local matrix on `4734fa0`: Jest 6100/6105 (only the 5 allowlisted
  skips, validated by `validate-jest-signal.mjs`), all validators, TypeScript,
  lint, QA self-test, web export, Expo Doctor 21/21, and clean-checkout
  certification PASS.
- All four workflows green at final SHA `05c16bc` (App CI `33936913057`,
  Repository Integrity `33936913032`, Android Build Smoke `33936913090` with
  APK/permission/SHA-256 artifact boundaries, iOS Build Smoke `33936913050`).
- Android runtime non-regression on the dedicated `braintraining-qa36` AVD:
  on-device guard self-heal (live DB trigger drop → restart → restored) plus
  `math-fast-math`, `speed-tap-rush`, `attention-odd-one-out` canaries PASS on
  the patched build with real SQLite persistence and row invariants.

Manual platform evidence (TalkBack, SAF system sheets, physical-device lab,
iOS runtime UX) remains DEFERRED per constitution §33; the accepted 16
build-toolchain npm advisories remain documented in
`.agent/DEPENDENCY_AUDIT.md`.

## Authoritative campaign state

`GOVERNANCE.activeCampaign` is `null`, `lastCampaign` is
`021-release-gate-reconvergence` (VALIDATED), and `STATE`,
`CURRENT_CAMPAIGN`, `EXECUTION_PROMPT`, OpenSpec, and task ownership agree on
that terminal form. Historical campaign prose below is retained for recovery
and does not override these structured fields.

## Campaign 017 closure and Campaign 018 activation — 2026-08-30

Campaign 017 closed with all tasks checked after the full current-head
convergence. Node 22 Jest passed 489/493 suites and 6087/6092 tests (4 suites
and 5 tests skipped by the existing explicit measurement allowlist); the
repository-state, ownership, OpenSpec, registry, provenance, offline,
TypeScript, lint, and QA self-test 51/51 gates passed. Focused real-DB
persistence, migration, projection, portability, reward, streak, and sync
suites passed. Android runtime, manual accessibility/system-sheet,
physical-device, and manual iOS UX evidence remain BLOCKED/NOT VALIDATED, and
the accepted 16 build-toolchain npm advisories remain documented. The owner
directive then atomically activated 018 with no feature expansion.

## Campaign 018 closure and Campaign 019 activation — 2026-08-31

Campaign 018 closed after strict quest definition/progress/claim validation,
real calendar-date filtering, deterministic covered-date serialization,
time-safe reward claim coverage, and engagement/progression reconciliation.
Focused engagement suites passed 12 suites / 127 tests; lifecycle/workout
convergence suites passed 8 suites / 68 tests; the full Node 22 Jest run passed
489/493 suites and 6094/6099 tests with 4 suites / 5 tests skipped by the
explicit measurement allowlist. TypeScript, lint, repository validators,
registry, provenance, offline boundary, and QA self-test 51/51 passed. The
owner directive then atomically activated 019 with no feature expansion.

## Campaign 019 closure and Campaign 020 activation — 2026-08-31

Campaign 019 closed after the shared lifecycle audit repaired unsafe Workout V3
provenance indices and non-finite catalog resume state, and after a source-level
tripwire covered all 42 game screens. Focused lifecycle/workout suites passed
8 suites / 68 tests; the full Node 22 Jest run passed 490/494 suites and
6096/6101 tests with 4 suites / 5 tests skipped by the explicit measurement
allowlist. TypeScript, lint, repository-state, ownership, OpenSpec, registry,
provenance, offline-boundary, and QA self-test 51/51 gates passed. Android
runtime, manual platform, physical-device, and manual iOS UX evidence remain
BLOCKED / NOT VALIDATED under the documented external constraints.

The owner-authorized sequence then activated Campaign 020 with no feature
expansion. Campaign 020 adds a fail-closed, non-leaking high-confidence secret
scanner over Git-tracked text files, with positive/negative self-tests and a
Repository Integrity workflow gate. Its remaining work is final certification
signal review, dependency classification, and the requested second
whole-codebase hardening report.

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

## Historical Campaign 016 next action

The preceding terminal Campaign 016 record required a future owner-authorized
campaign; that authorization produced 017–020. The 2026-09-05 owner directive
activated 021 (release-gate re-convergence) as the sole ACTIVE campaign; its
device/manual limitations remain separate from the local gate work.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`
