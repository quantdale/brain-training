# Campaign 014 — Closure Attempt 2026-08-27 — BLOCKED (ACTIVE, not COMPLETED)

**Date:** 2026-08-27
**Head at attempt:** `366a098` (plus uncommitted WSL AVD/harness + docs-final fixes this session; will be committed as new SHA)
**Verdict:** **ACTIVE — BLOCKED by genuine host emulator infra (37.1.11 + WHPX segfault), not product defect. 014 cannot be marked COMPLETED until a stable dedicated-AVD device journey is obtained. 015 remains PROPOSED per `openspec/changes/015-*/EXECUTION.md`.**
**Campaign id:** `014-experience-depth-replayability`
**Predecessor:** `013-final-product-completion` (COMPLETED 2026-08-26, SHA ba6dd84, 42/42 certify green)
**Mode:** day
**Authorization:** owner directive — Continue development using day mode (predecessor-close phase of `CAMPAIGN015_PROMPT.md` / `EXECUTION.md` Phase 0)

## Objective

AUDIT → MEASURE → PRIORITIZE → DEEPEN → POLISH → INTEGRATE → VALIDATE → PROVE.
Central question: *after the novelty of the first few sessions wears off, is this still an app someone would want to use repeatedly for weeks/months?* Depth over feature count; 42-game catalog frozen.

## What shipped (by commit, all pushed to `main` unless noted)

### W1 — Product-depth audit
- Evidence-driven rubric over all 42 games + major shared surfaces (mechanical depth, novelty, scaling, Expert quality, entropy, near-duplicates, degenerate strategies, timing fairness, feedback, mastery) — `.agent/CAMPAIGN014_AUDIT.md` with P0–P4 priorities (commit eb348dd).

### W2 — 13-game mechanical deepening (968554a, six parallel packets + orchestrator convergence)
- Route-path memory (pattern-tap-back adjacency-route generator 1.1.0), running-order palette 12 + Hamming≥2 guard, reaction-time Go/No-Go (generator 1.1.0, scoring 1.2.0), quick-compare plausible decoys + spreadPct proximity axis (generator 2.0.0), symbol-tracker respond-phase deadline w/ pause freeze, target-count within-session escalation ladder (game 1.2.0), equation-builder expert templates ≥25 + failure solution-reveal, deduction-table anti-giveaway minimal-proof selection under clueCount cap (generator 1.2.0), stroop window-normalized speed bonus (scoring 1.3.0), rule-flip uncued inference windows (generator 1.2.x), etc. Registry regenerated (14 game.json version bumps), tsc/lint/Jest 5947 PASS.

### W3–W6 — Shared depth systems (b36ac42)
- **Mastery ladder** (`MASTERY_VERSION=1`, one GROUP BY pushdown per load via `getMasteryInputs`, pure engine with next-milestone text): Game Detail card + Progress distribution/closest-milestones + Home strip.
- **Daily Spotlight** deterministic offline rotation (v1) with Home card + completion state, per-date determinism + rotation (`src/spotlight`).
- **Workout V3** signal-ranked ordering (base set stays pinned-deterministic, ordering re-ranked by weighted signals: weak/undertrained/stale domain, novelty, trend, PB-proximity, difficulty-fit, overexposure, recency avoidance) with truthful per-game reasons (metadata v2), reroll economics (1 free + 25-coin paid, ledger -25).
- Discovery shelves, Home/Progress surfaces. Jest 5972 PASS. Visual baselines 5/5 unchanged (data-gated).

### W7–W9 — Generator integrity + repeated-use proof + storage visibility (f4aa44c)
- Word-scramble distractor integrity (ranked by letter-overlap with answer, generator 1.1.0; kills length-sort shortcut, true anagrams never ship as wrong options), deterministic two-week repeated-use simulation over real file-backed sqlite (consecutive daily workouts ×5, paid reroll debit −25, missed day with proactive Freeze, close/reopen relaunch, mastery climbing developing→mastered via Expert clears, PB aggregates, Daily Spotlight per-date determinism + rotation, quest period-key rollover, export→wipe→replace-import byte-for-byte), storageBytes visibility. Jest 5973 PASS, 483 suites. All repo gates PASS at f4aa44c.

### Closure fixes (575c4f7 → 366a098, all pushed)
- **Docs reconciliation (partial):** README Workout V2→V3 (575c4f7), `STATE.md` header + Current status + Authoritative active change synced to 014 ACTIVE at f4aa44c.
- **Harness resilience (575c4f7/d332e50/366a098):** RedBox/LogBox dismissal before dump-error filter, scrolled-Home via any `home-*` (not just workout-list), shade collapse on launch, 90s recovery budget + extended completion-card scroll, live-panel no-toggle guard + 62s re-select poll for `home-workout-selected-done`; `looksLikeHomeRoute` + `flowWorkoutTemplate` wait for templates after relaunch; self-test 49/49 PASS.
- **App fix (d332e50/366a098):** template-instance first-advance race (`completedAt > updatedAt` blocked fresh-start focus workouts, cascading to 0/N "In progress" forever) — fixed with 10s slack in `advance.ts:shouldAdvanceWorkout` and `db/workout.ts:findActiveInstanceForGame`, still rejects historical views. Daily instance always passed, so daily-workout E2E was green; focus's first advance was the one blocked.
- **This session (2026-08-27, uncommitted until this checkpoint):** WSL-aware `scripts/android/common.sh` SDK path (`/mnt/c/Users/palac/AppData/Local/Android/Sdk` + `/mnt/d/Android/Sdk`) and `scripts/android/avd.sh` WSL fixes (CRLF `tr -d '\r'`, directory fast-path, `cmd_boot` skip for existing AVD, `bt_run_cmdline_tool` WSL path conversion for `avdmanager.bat`), plus `docs/MASTER_PLAN.md` 013→COMPLETED + new 014 section and `docs/PARITY_MATRIX.md` V3/mastery/Spotlight updates, `STATE.md`/`CURRENT_CAMPAIGN.md`/`KNOWN_ISSUES.md`/`VALIDATION.md` sync. No game #43, no cloud/social, no broad hardening.

## Validation snapshot at this attempt (HEAD 366a098 + working tree after docs-final + WSL fixes)

- **Repo gates:** `node scripts/validate-repo-state.mjs` PASS · `node scripts/validate-task-ownership.cjs` PASS (006R map, still PROPOSED per 015 audit — expected, not a product gate) · `npx @fission-ai/openspec validate --all` 2/2 PASS (006R + 015 PROPOSED) · `tsc --noEmit` PASS · `eslint` not re-run this session (last 0/0 at 013 closure; no new lint-relevant code beyond harness/docs) · harness self-test `node scripts/qa/autobot.mjs --self-test` 49/49 PASS (after WSL fixes).
- **AVD restore:** dedicated `braintraining-qa36` was missing (`avdmanager list avd` showed 5 AVDs: atd35, braintraining35, change7api35, change7diag35, superhabits); recreated via `cmd.exe /c "C:\Users\palac\AppData\Local\Android\Sdk\cmdline-tools\latest\bin\avdmanager.bat" create avd -n braintraining-qa36 -k system-images;android-35;aosp_atd;x86_64 -d pixel_7 --force` (echo no | avdmanager) → now 6 AVDs, `braintraining-qa36` at `C:\Users\palac\.android\avd\braintraining-qa36.avd`, `aosp_atd` x86_64, pixel_7. Verified via `avdmanager list avd` and `bash scripts/android/avd.sh status` (`STOPPED avd=braintraining-qa36` after fix, fast).
- **Boot:** `cmd.exe /c start "" "C:\Users\palac\AppData\Local\Android\Sdk\emulator\emulator.exe" -avd braintraining-qa36 -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -no-metrics -feature -Wifi` → `emulator-5554` appeared in `adb devices` within ~10s, `adb -s emulator-5554 shell getprop sys.boot_completed` became `1` after ~30s (poll every 10s, 3 attempts, `tr -d '\r'`). **Then segfault:** `adb devices` went empty (only header), `ps aux | grep emulator` showed no `emulator.exe`/`qemu-system-x86_64-headless.exe` (only ZCode plugin remained), `tasklist` confirmed no emulator. Same host previously failed 5 headless attempts with cold+wipe-data, 12 GB free, "did not register with adb within 60s" → segfault, 37.1.x WHPX, `netsimd` WiFi `CANCELLED` → segfault, `qemu-system-x86_64-headless.exe` dies. `braintraining35` also affected; foreign `Nitro_API_36` not adopted per policy. No APK built this session (honest).
- **Workout V3 E2E + canaries:** **NOT VALIDATED (genuine infra blocker, not product)** — emulator segfaults shortly after boot, so `QA_DEVICE=emulator-5554 node scripts/qa/autobot.mjs --mode workout` / `--mode workout-focus` / `--mode canaries` / `--mode certify` could not be run. Prior green remains canaries 8/8 (20260826-114825, braintraining-qa36 / emulator-5554, forced-win + persistence + nav) and daily-workout 4/4 + relaunch + focus 4/4 legs (pre-template-fix; focus completion-card probe now retried with swipe-to-top, but not re-proven on device). The template-advance fix (10s slack) is committed at 366a098 but not device-proven. No foreign emulator adopted.
- **Perf / game-feel:** **NOT VALIDATED honestly** — opt-in timing probes (`PERF_PROBE=1`, `sdk/perf` mark/measure) not re-run this session; wall-clock / interaction-latency not measured. Statement-count guards remain green (mastery reads one GROUP BY pushdown per load, workout creation one aggregate pushdown + one indexed `listSummaries limit 20`), but statement-count is explicitly not presented as wall-clock evidence (per 015 spec). Targeted input→feedback observability for changed timed games (symbol-tracker deadline, reaction Go/No-Go, etc.) was shipped inside W2 packets but not re-measured on device.
- **Docs-final reconciliation:** **DONE this session** — `README.md` already V3 (575c4f7), `docs/MASTER_PLAN.md` updated 013→COMPLETED (SHA ba6dd84, 42/42 certify) + new 014 section (W1–W9 + closure fixes + honest validation snapshot with NOT VALIDATED), `docs/PARITY_MATRIX.md` updated for Workout V3 (signal-ranked) / mastery ladder / Daily Spotlight, `BACKLOG.md` already V3, `.agent/STATE.md` header + Current status + Working state + Next required action synced to 366a098 + WSL fixes + docs-final, `.agent/CURRENT_CAMPAIGN.md` Status + Exit criteria synced, `.agent/KNOWN_ISSUES.md` blocker + open debt synced, `.agent/VALIDATION.md` new 2026-08-27 section appended.
- **Contradictory state:** resolved — `GOVERNANCE.json` activeCampaign `014-experience-depth-replayability`, `STATE.md` Last update + Current status + Authoritative active change all say 014 ACTIVE at 366a098, `CURRENT_CAMPAIGN.md` says Campaign 014 ACTIVE, no remaining 013-active prose. The audit's P0.3 is now fixed.
- **Builds not re-run this session:** `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` NOT VALIDATED (no build; last at 013 closure), `npx expo export --platform web` not re-run (no dep/routing changes; last 20 routes at 013 closure), `npx expo-doctor` not re-run (last 21/21 at 013 closure), `npm audit` not re-run (last 16 build-toolchain-only). Full Jest 5973 not re-run this session (last at f4aa44c was 483/5973 PASS; working tree tsc + self-test + repo-state are green, statement-count guards green).

## Exit criteria progress (owner directive §21, at 366a098 + this attempt)

- [x] Durable audit covering all 42 games + shared surfaces (`.agent/CAMPAIGN014_AUDIT.md`)
- [x] Weakest/highest-leverage games received meaningful depth improvements (13 games)
- [x] Replayability materially stronger (mastery, Spotlight, richer procedural spaces, Workout V3 loops)
- [x] Workout V3 materially improves selection and explains truthfully (signal-ranked, metadata v2)
- [x] Progress V3 interpretation layer without unsupported claims
- [x] Home & Games discovery better support returning users without cluttering first viewport
- [x] Generator repetition/predictability improved in highest-risk games (Hamming≥2, anti-giveaway, overlap-ranked decoys)
- [ ] Game-feel improvements measurable/observable — targeted fixes shipped but no dedicated latency measurement pass (honest NOT VALIDATED)
- [x] Runtime performance baselines: statement-count guards green; opt-in probes not re-run (honest)
- [x] Repeated-use / simulated multi-day journeys PASS (`repeated-use-simulation.test.ts`)
- [x] No new unresolved Critical/High defects (harness/docs fixes are not product regressions)
- [x] Repo validators, typecheck, lint, full Jest, offline boundary, registry/provenance checks green at f4aa44c (working tree after 366a098 + WSL fixes: repo-state PASS, tsc PASS, self-test 49/49; full Jest 5973 last green at f4aa44c)
- [x] Changed persistent formats/calculation semantics properly versioned (workout metadata v2, generator/scoring bumps, MASTERY_VERSION=1)
- [x] Deferred product decisions untouched
- [ ] **Required Android journeys (Workout V3 E2E + canaries): NOT VALIDATED (genuine infra blocker)** — see above.
- [x] Docs-final reconciliation sweep (README/PARITY/BACKLOG/MASTER_PLAN/STATE) — **DONE** this session.
- [ ] Terminal checkpoint — **this file is the closure-attempt checkpoint, but it is BLOCKED, not COMPLETED; the COMPLETED checkpoint requires the device journeys.**

## Next required action

014 remains **ACTIVE**. Docs-final is DONE. The only remaining gate to COMPLETED is **dedicated-AVD device evidence**: `braintraining-qa36` Workout V3 E2E (daily + focus) + representative canaries PASS on the dedicated AVD, with honest perf/game-feel re-probe where the harness can measure. The AVD was restored and boots to `sys.boot_completed=1` but segfaults shortly after (37.1.11 + WHPX). Until a stable boot + journey run is obtained (or the host/emulator is fixed/updated), 014 cannot be marked COMPLETED and **015 must remain PROPOSED** per `EXECUTION.md`. Next step when the host allows: re-run `QA_DEVICE=emulator-5554 node scripts/qa/autobot.mjs --mode workout-focus` / `--mode workout` / `--mode canaries` on `braintraining-qa36` only (or full `--mode certify` if shared-lifecycle risk warrants), record PASS/FAIL/NOT VALIDATED with artifacts, rerun targeted perf probes (`PERF_PROBE=1`), then write the terminal COMPLETED checkpoint (`.agent/checkpoints/014-*.md`), mark `GOVERNANCE.json`/`STATE.md`/`CURRENT_CAMPAIGN.md`/`EXECUTION_PROMPT.md` as COMPLETED, and atomically activate 015 per its `EXECUTION.md`. Remaining debt: pause/resume a11y race (Medium, honest-retry), SAF sheets (manual), iOS build (NOT VALIDATED on Windows), 16 build-toolchain-only npm advisories (accepted).

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/checkpoints/012-broad-convergence-COMPLETED.md`
6. `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`
