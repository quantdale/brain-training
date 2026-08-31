# Durable Project State

**State schema:** 1
**Last update:** 2026-08-30 Campaign 018 activation after Campaign 017 closure. The owner-authorized sequence has validated the persistence/portability/sync/temporal repair set; 018 now owns engagement input, calendar, reward-claim, and progression reconciliation hardening. Android runtime and manual evidence remain BLOCKED/NOT VALIDATED under the previously recorded bounded emulator matrix.
**Canonical branch:** `main`
**Active campaign:** 018-engagement-temporal-integrity
**Last campaign:** 017-persistence-boundary-hardening
**Last campaign status:** VALIDATED

## Current status

Campaign 018 — Engagement Temporal Integrity is **ACTIVE** under the
owner-authorized successor sequence 017–020. Campaign 017 is validated with
safe-integer storage, rating/session identity, backup/restore rollback,
deterministic sync, canonical profile export, and user-facing as-of reads.
Campaign 018 owns strict quest/streak inputs, canonical covered dates,
time-safe reward claims, and progression reconciliation. SQLite remains
canonical and no new game or deferred external system is in scope.

Current evidence is the validated 017 baseline plus the newly activated 018
scope: repository validators, TypeScript, lint, QA self-test 51/51,
projection/session/rating/migration, portability, reward, streak, and
achievement suites pass; full Node 22 Jest passed 489 suites / 6087 tests with
4 suites / 5 tests skipped by the explicit measurement allowlist. Android
runtime and manual platform evidence remain BLOCKED/NOT VALIDATED; 018's
focused engagement gate is the next executable work.

The device inventory at 2026-08-30 now includes dedicated `braintraining-qa36` (ATD x86_64 API 35, pixel_7, `image.sysdir.1=system-images/android-35/aosp_atd/x86_64`) and `braintraining-qa35` (google_apis, same API) alongside the foreign `study-maker-api35`; both dedicated AVDs were created via `avdmanager` from committed inputs and booted headless with TCG (`-accel off -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect|off -no-metrics -feature -Wifi -no-snapshot-load -no-snapshot-save`). A bounded matrix of 4 configs (ATD 3072/6c, ATD 2048/4c wipe-data, google_apis 3072/6c gpu off, ATD 1536/2c) all reproduced the same external failure: `adb device` after ~65–80 s (`bootanim=stopped`) but never `sys.boot_completed=1`/`pm` readiness before qemu exit (`Netsim Wifi … gone due to CANCELLED` / `cannnot unmap ptr` / `TCG avx`); `/dev/kvm` missing (`accel=8`, `modprobe` unavailable) and only emulator 37.1.11 is available via `sdkmanager`, so no stable TCG configuration exists on this container host. Therefore dedicated Android install/start, Rule Grid/Transform Match canaries, Workout V3 daily/focus/relaunch, 42/42 `autobot --mode certify`, Android hierarchy, TalkBack, SAF/system sheets, and manual iOS UX remain **BLOCKED / NOT VALIDATED**. iOS compile PASS is not runtime UX PASS. Signing, store submission, cloud/auth, telemetry, monetization, and other deferred product decisions remain out of scope.

## Authoritative campaign state

An executable repository has one ACTIVE campaign in `GOVERNANCE.activeCampaign`,
`STATE`, `CURRENT_CAMPAIGN`, `EXECUTION_PROMPT`, OpenSpec, and task ownership.
Those fields now agree on `018-engagement-temporal-integrity`; the recorded
last validated predecessor is `017-persistence-boundary-hardening`. The owner
directive explicitly authorizes the successor sequence, so this is executable
work rather than a terminal state.

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
campaign. That authorization is now explicit and 018 is the sole active
campaign; its device/manual limitations remain separate from the local
engagement work.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`
