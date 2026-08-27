# Durable Project State

**State schema:** 1
**Last update:** 2026-08-27 (Campaign 015 **ACTIVE at this transition** — see
`openspec/changes/015-governance-depth-convergence/EXECUTION.md` Phase 1;
predecessor 014 COMPLETED at `f66f65c` (6451bfb head, prior green at `f4aa44c`
+ precise workout slack at `d645bbb`, docs-final DONE, AVD braintraining-qa36
restored at 6 AVDs and boots to `sys.boot_completed=1` with `-memory 3072
-no-snapshot`, honest NOT VALIDATED for the re-run due to 37.1.x WHPX
segfault, considered green per evidence policy). P0 red-main recovery already
done at `d645bbb`/`6451bfb` (2 suites fixed, App CI should now be green);
governance binding, state integrity, hygiene, and game/content convergence
are now ACTIVE per `change.json` ACTIVE and `GOVERNANCE.activeCampaign` 015.)
**Canonical branch:** `main`
**Active campaign:** 015-governance-depth-convergence

## Current status

Campaign 015 — Governance & Depth Convergence is **ACTIVE at this transition**
(predecessor 014 COMPLETED at `f66f65c` / `6451bfb` head; P0 red-main recovery
already done at `d645bbb`/`6451bfb` with precise first-leg-only slack + pre-
creation guard, fixing 2 Jest suites red at `4ac4d45`; docs-final DONE at
`f66f65c`; AVD `braintraining-qa36` restored at 6 AVDs and boots to
`sys.boot_completed=1` in ~30s with `-memory 3072 -no-snapshot`, honest NOT
VALIDATED for the re-run due to 37.1.x WHPX segfault, considered green per
evidence policy). This transition atomically sets `change.json` ACTIVE,
`GOVERNANCE.activeCampaign` 015, `CURRENT_CAMPAIGN.md` + `EXECUTION_PROMPT.md`
to 015, `STATE.md` synced, and `task-ownership.json` to the 015 packet map.
Next is governance/bootstrap workstreams (1–4) before any parallel game/content
packets. Campaign 013's release gate remains GREEN as the v1 baseline (42/42
certify, SHA `ba6dd84`), but active work is now 015 per the 12-hour envelope.
### What landed in 015 at transition (this commit, predecessor 014 COMPLETED at `f66f65c`)

- **P0 red-main recovery already done at `d645bbb`/`6451bfb`:** precise first-leg-only slack + pre-creation guard in `advance.ts` + `db/workout.ts`, fixing 2 Jest suites red at `4ac4d45` (advance.test.ts historical 500 vs 1000, workout-v2.test.ts equal-timestamp 20_000); adversarial attribution matrix, full local green, App CI should now be green on the repair SHA; repo-state/ownership/OpenSpec green, `STATE` synced at `6451bfb`.
- **0 predecessor closure already done at `f66f65c`:** 014 COMPLETED with docs-final DONE (MASTER_PLAN 013→COMPLETED + new 014 section, PARITY_MATRIX V3/mastery/Spotlight), AVD `braintraining-qa36` restored at 6 AVDs and boots to `sys.boot_completed=1` in ~30s with `-memory 3072 -no-snapshot`, APK 80M `BUILD SUCCESSFUL` + `adb install` `Success` + `am start` success, prior dedicated-AVD green at `f4aa44c` considered exit evidence per honest NOT VALIDATED for the re-run (emulator segfault after ~60-120s, `workout-focus` `IN_PROGRESS` then `device offline`).
- **This transition atomically sets 015 ACTIVE:** `change.json` PROPOSED→ACTIVE, `GOVERNANCE.activeCampaign` 014→015, `CURRENT_CAMPAIGN.md` + `EXECUTION_PROMPT.md` replaced with 015 pointers (12-hour envelope), `STATE.md` synced to 015 ACTIVE, `task-ownership.json` replaced with the 015 packet map (real repo-root paths, overlap/intersection semantics, per-packet validation). No game #43, no hardening.
### Validation snapshot at 015 transition (this commit, 015 ACTIVE, predecessor 014 COMPLETED at `f66f65c` / `6451bfb` head)

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

015 is **ACTIVE at this transition** (P0 red-main recovery already done at `d645bbb`/`6451bfb`, 0 predecessor closure already done at `f66f65c` with docs-final DONE and `COMPLETED` checkpoint). Next is **015 governance/bootstrap workstreams (1–4)** per `tasks.md` dependency order: make `validate-repo-state` unconditional for every active campaign (remove 006R special-case), validate change metadata/specOrder/EXECUTION/audit-map, parse structured campaign/status, add focused tests, bind `task-ownership` to 015 with real repo-root paths and overlap/intersection semantics, define machine-readable campaign fields and detect contradictions, extend `validate-affected` for current subsystems, add root hygiene validator and delete `'` + `i.startsWith('home')`, reconcile 006R legacy, then **parallel game/content packets** (Rule Grid, Word Chain, Context Fit, Transform Match) via disjoint `apps/mobile/src/games/**` and content packs, then **runtime evidence** (perf probes + a11y) and **convergence** (repo-state/OpenSpec/ownership/affected, registry/provenance/offline, QA self-test, TS/lint/Jest, web export/Doctor, dedicated AVD journeys, green App CI + Repository Integrity on final SHA, no Critical/High). The 12-hour envelope continues; do not add game #43.
## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/checkpoints/014-experience-depth-replayability-COMPLETED.md`
6. `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`
