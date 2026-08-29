# Durable Project State

**State schema:** 1
**Last update:** 2026-08-29 (Campaign 016 terminal blocked checkpoint committed
at local `fdbf145`, based on source head `87f43c2`. GitHub push remains blocked
by the token's missing `workflow` scope. Static validators,
typecheck/lint, web export (20 routes), Expo Doctor (21/21), bounded failure
path (5 suites/20 tests), accessibility (6/6 and 2/2), and dependency
classification (0 critical; 16 toolchain-only findings) pass. Android inventory
found emulator 37.1.11/ADB 37.0.1 but no Java, no connected device, no running
emulator, and only foreign AVD `study-maker-api35`; prior designated AVD
software/headless/recreation attempts reproduced WHPX/qemu failure. The bounded
DB integrity/idempotency probe reproduced host Node SIGSEGV exit 139 before
Jest output; Android runtime/canary/Workout V3/42-game certification,
persistence/recovery matrices, performance probes, and full Jest remain NOT
VALIDATED. iOS native/manual evidence remains BLOCKED/NOT VALIDATED.)
**Canonical branch:** `main`
**Active campaign:** 016-release-certification-hardening

## Current status

Campaign 016 — Release Certification & Hardening is **ACTIVE**. Campaign 015
is VALIDATED on exact green SHA `fc9899e`; its implementation, governance, and
causal workout-attribution work are complete. 016 now owns clean-checkout
reproducibility, native/platform evidence, bounded Android recovery, CI signal
integrity, runtime resilience/security, performance/accessibility evidence, and
final certification. Android/iOS/manual-sheet limitations remain explicitly
classified and must not be relabeled without evidence.
`(instanceKey, legIndex, gameId)` provenance tuple carried from workout route
through the shared game host into persisted session JSON, then advances the
matching active row with a conditional transaction. Focused attribution tests
are green; exact-SHA App CI and Repository Integrity passed for `60fdadc`.
Full-suite resource contention and dedicated Android emulator stability remain
recorded validation limits. Campaign 013's release gate remains GREEN as the
v1 baseline (42/42 certify, SHA `ba6dd84`).
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
## Authoritative active change

`.agent/CURRENT_CAMPAIGN.md` (campaign 015 **ACTIVE at this transition**, `change.json` ACTIVE, `GOVERNANCE` 015) + `.agent/KNOWN_ISSUES.md` + `.agent/CAMPAIGN015_AUDIT.md` (now active, not PROPOSED) + `openspec/changes/015-governance-depth-convergence/` (5 delta specs, `EXECUTION.md` Phase 1).

### Authoritative machine-readable campaign fields (3.1)

Each durable recovery document carries exactly one structured field that declares the active campaign — surrounding human prose is NOT authoritative:

| Source | Field | Example |
|---|---|---|
| `.agent/GOVERNANCE.json` | `activeCampaign` (JSON) | `"015-governance-depth-convergence"` |
| `.agent/STATE.md` | `**Active campaign:** <id>` | `**Active campaign:** 015-governance-depth-convergence` |
| `.agent/CURRENT_CAMPAIGN.md` | `**Campaign id:** `<id>`` + `**Status:** ACTIVE` | `**Campaign id:** `015-governance-depth-convergence`` |
| `.agent/EXECUTION_PROMPT.md` | `**Change:** `<id>`` + `**Status:** ACTIVE` | `**Change:** `015-governance-depth-convergence`` |
| `openspec/changes/<id>/change.json` | `id` + `status` | `"id": "015-governance-depth-convergence", "status": "ACTIVE"` |
| `.agent/task-ownership.json` | `change` | `"change": "015-governance-depth-convergence"` |

`scripts/validate-repo-state.mjs` parses these structured fields (not substring presence). All six must agree on exactly one ACTIVE campaign; any contradiction is a validation failure. Historical prose mentioning old campaign IDs does not satisfy or override the structured field. See `openspec/changes/015-governance-depth-convergence/design.md` §1 and `scripts/validate-repo-state.mjs` header for the full invariant.


- GitHub `main` is canonical; coherent green waves pushed.
- Android-first autonomous QA; one AVD; one Metro; ONE driver per device
  (autobot now enforces this via lockfile).
- No autonomous force-push to `main`.
- Generated files updated only through generators.
- Missing validation is never PASS (`NOT VALIDATED` recorded honestly).
- Deferred product decisions untouched (branding, accounts, cloud sync,
  pricing, ads, AI, social, notifications, store listing).

## Next required action

016 is **ACTIVE** after 015 was validated on exact green SHA `fc9899e`.
Execute the 016 release-certification and hardening phases in order: clean
checkout, native build evidence, bounded dedicated-Android recovery, CI signal
integrity, runtime resilience/security, performance/accessibility evidence, and
final exact-SHA certification. Preserve Android/iOS/manual-sheet
`BLOCKED`/`NOT VALIDATED` classifications until fresh evidence exists. Do not
add game #43 or broaden the product scope.
## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/checkpoints/014-experience-depth-replayability-COMPLETED.md`
6. `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`
