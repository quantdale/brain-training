# Tasks — Campaign 016 Release Certification & Hardening

## 0. Predecessor truth closure — P1
- [x] 0.1 Confirm exact-head App CI + Repository Integrity success — App CI `33226167744` and Repository Integrity `33226167736` both PASS on `fc9899e`.
- [x] 0.2 Diff 015 checkpoint claims against actual 015 code/tests/tasks — 015 tasks/checkpoint and exact CI archive reconciled; no unresolved Critical/High product regression is known.
- [x] 0.3 Update 015 task checkboxes only where evidence exists; classify unavailable runtime items explicitly — 015 tasks 4A.5 and 11.10–11.17 carry PASS, BLOCKED, or NOT VALIDATED evidence; Android/iOS/manual-sheet gaps remain explicit.
- [x] 0.4 Reconcile 015 change lifecycle and all machine-readable active-campaign fields — 015 `VALIDATED`; 016 is the sole `ACTIVE` change; GOVERNANCE, STATE, CURRENT_CAMPAIGN, EXECUTION_PROMPT, ownership, and OpenSpec agree.
- [x] 0.5 Reconcile STATE/CURRENT_CAMPAIGN/EXECUTION_PROMPT/KNOWN_ISSUES/VALIDATION — synchronized in the 2026-08-29 transition.
- [x] 0.6 Push 015 closure SHA and require both workflows green on that exact SHA — corrective closure SHA `fc9899e` pushed; exact workflow runs `33226167744` and `33226167736` PASS.
- [x] 0.7 Atomically activate 016 only after 0.6 — completed in this transition; 016 is now ACTIVE and 015 is VALIDATED.

## 1. Clean-checkout reproducibility — P1
- [x] 1.1 Create a fresh worktree/clone with no inherited caches or generated native folders — disposable worktrees at `8b05941` started with no dependency, Expo, coverage, or native folders.
- [x] 1.2 Verify app-boundary `npm ci` succeeds without `legacy-peer-deps` — the repository has no root manifest/lockfile; `apps/mobile/package-lock.json` is the canonical install boundary and `npm ci --ignore-scripts` passed.
- [x] 1.3 Run repo-state, OpenSpec, ownership, registry, provenance, offline and QA self-test gates — all passed from the clean worktree.
- [ ] 1.4 Run TypeScript, lint, full Jest, web export and Expo Doctor — typecheck, lint, web export, and Expo Doctor passed; full Jest is NOT VALIDATED because 59 worker processes SIGSEGVed under host contention despite 429/488 suites passing.
- [x] 1.5 Add one documented/repeatable certification script if the full sequence is not already executable as one command — `scripts/certification/certify-clean-checkout.mjs`, documented in `scripts/qa/README.md`; it preserves nonzero Jest status unless `--allow-jest-not-validated` is explicit.
- [x] 1.6 Verify repeated clean runs do not mutate tracked files or generated artifacts — two independent runs at `8b05941` ended with `tracked_mutation_after_clean_run=PASS`; both were repeatable for install, static/app gates, export, and Doctor.

## 2. Native build reproducibility — P1
- [x] 2.1 Android clean Expo prebuild from committed config — disposable worktree at `75f81fe`; `npx expo prebuild --platform android --clean --no-install` PASS.
- [x] 2.2 Verify generated manifest permissions and production QA/debug-hook boundaries — generated manifest removes `RECORD_AUDIO` and `SYSTEM_ALERT_WINDOW`; backup/data-extraction rules, deterministic version metadata, and no native QA literals verified; focused boundary/config suite 34/34 PASS.
- [ ] 2.3 Build native Android release/build-smoke artifact from clean generated state — NOT VALIDATED: host has no Java/Gradle/Android SDK tooling (`java`, `adb`, `emulator`, and `sdkmanager` absent).
- [ ] 2.4 Install/start the artifact on the dedicated project device when available — BLOCKED/NOT VALIDATED: no ADB, emulator, or physical device is available on this host.
- [ ] 2.5 Add macOS iOS CI build-smoke: prebuild, pods, Xcode simulator build, signing disabled — NOT VALIDATED: this host is not macOS and no Xcode runner is available in the current environment.
- [ ] 2.6 Archive concise failure logs/artifacts for both native build paths — NOT VALIDATED: Android compilation and iOS Xcode paths were not executable here; prebuild/config evidence is recorded in `.agent/VALIDATION.md`.
- [x] 2.7 Document that signing/store submission remains intentionally deferred — constitution-deferred scope is preserved in `design.md`, `proposal.md`, and the platform/release specs.

## 3. Android environment recovery & fresh certification — P1
- [x] 3.1 Capture current emulator/SDK/WHPX/graphics/AVD versions and segfault logs — bounded inventory captured: Linux host, Android emulator 37.1.11, platform-tools/ADB 37.0.1, SDK platform 35, no Java/Gradle on PATH, no connected device, and only foreign local AVD `study-maker-api35`; prior designated Windows `braintraining-qa36` 37.1.11/WHPX failure logs are recorded in the 014/015 checkpoints.
- [x] 3.2 Reproduce failure once; do not blind-retry — prior bounded designated-AVD boot reproduced `sys.boot_completed=1` followed by emulator/qemu exit, empty `adb devices`, and `device offline`/WHPX segfault evidence; this checkpoint performed no retry.
- [ ] 3.3 Test a pinned known-stable emulator/toolchain candidate — NOT VALIDATED: no known-stable candidate is available on this host; the installed 37.1.11 toolchain is the documented failing environment.
- [x] 3.4 Test software-rendering/headless-safe configuration — prior designated-AVD bounded attempts used headless/no-window, software GPU, disabled Wi-Fi/netsim, cold/wipe-data variants; the emulator still failed, as documented.
- [x] 3.5 Recreate the dedicated AVD from scriptable inputs — prior bounded Windows recovery recreated `braintraining-qa36` from the committed API-35 `aosp_atd`/x86_64 inputs; it remained unstable after boot.
- [ ] 3.6 If available, use a physical ADB device as a non-host-input fallback — BLOCKED/NOT AVAILABLE: no physical device is connected.
- [ ] 3.7 Once stable, run Rule Grid + Transform Match + representative post-015 canaries — NOT VALIDATED because the dedicated device is not stable/available.
- [ ] 3.8 Run Workout V3 daily/focus/relaunch journeys — NOT VALIDATED because the dedicated device is not stable/available.
- [ ] 3.9 Run one full 42/42 `autobot --mode certify` pass on the candidate SHA — NOT VALIDATED because the dedicated device is not stable/available.
- [x] 3.10 If 3.3–3.6 all fail for infrastructure reasons, record BLOCKED with evidence; never mark PASS — Android runtime certification remains BLOCKED/NOT VALIDATED by missing Java/device plus reproducible 37.1.11/WHPX emulator failure; no foreign AVD was adopted.

## 4. CI and test-signal integrity — P2
- [x] 4.1 Enumerate exact 4 skipped suites / 5 skipped tests and their skip conditions — four opt-in measurement suites (`PERF_PROBE=1` or `LARGE_BACKUP_PROBE=1`) plus one opt-in projection measurement block; exact records are represented in the allowlist.
- [x] 4.2 Create explicit skip allowlist with rationale and owner — `scripts/certification/jest-skip-allowlist.json`, five exact file/pattern entries with enablement flags, rationale, and Campaign 016 owner.
- [x] 4.3 Add CI gate that fails on any unexpected/new skip — `scripts/certification/validate-jest-signal.mjs` parses Jest JSON, matches each pending record to exactly one entry, and fails closed; self-test covers all five entries plus an unknown skip.
- [x] 4.4 Add/standardize a dedicated performance-test command for opt-in perf suites — `cd apps/mobile && npm run perf:probe` delegates to the existing `scripts/perf/run-probes.mjs`; command and measurement-only semantics documented in `scripts/perf/README.md`.
- [x] 4.5 Spy/assert expected `console.error` in failure-path tests so green CI is quiet — `error-boundary.test.tsx` now scopes, asserts, and restores the expected React renderer diagnostics; the focused failure-path set passes 5 suites / 20 tests with no emitted console noise.
- [ ] 4.6 Fail or classify unexpected console warnings/errors — NOT VALIDATED; the JSON gate reports warning fields when supplied, but Jest does not emit a repository-wide warning classification field in the current setup and no safe blanket console policy was added.
- [x] 4.7 Upgrade GitHub Actions to current Node-compatible majors after checking release compatibility — verified release tags via GitHub API and upgraded checkout v7, setup-node v7, cache v6, and upload-artifact v7 in both workflows.
- [x] 4.8 Preserve a machine-readable Jest summary artifact — App CI runs Jest with `--json --outputFile=jest-summary.json`, validates it, and uploads it with 14-day retention on every outcome.

## 5. Runtime resilience and data integrity — P1/P2
- [ ] 5.1 Re-run workout ownership/idempotency adversarial matrix after process death/reopen — PARTIAL: `session-provenance`, `reconcile`, `v3`, and session lifecycle coverage passed before the host SIGSEGV; `advance`/full matrix did not produce a result on the bounded rerun.
- [ ] 5.2 Stress duplicate completion delivery and concurrent same-game workout instances — NOT VALIDATED as a complete matrix; the bounded DB integrity/idempotency probe reproduced host Node `SIGSEGV` exit 139 before Jest emitted any suite result.
- [ ] 5.3 Re-run SQLite migration matrix from representative historical schemas — NOT VALIDATED: migration suites did not produce results before the reproducible host SIGSEGV.
- [ ] 5.4 Re-run backup export/import preview/replace/rollback and malformed/corrupt input cases — NOT VALIDATED: backup suites did not produce results before the reproducible host SIGSEGV; existing adversarial/rollback/round-trip tests remain in place.
- [ ] 5.5 Verify storage-unavailable and database-lock failure UX does not corrupt state — storage-unavailable recovery passed (2 tests); database-lock behavior has no completed current-head evidence, and the bounded DB integrity probe crashed before producing evidence.
- [x] 5.6 Re-run background/pause/resume timing fairness canaries — `use-game-session` and timer suites passed in the bounded run, covering pause exclusion, auto-pause on background, resume, timer cancellation, and no orphan timers.
- [x] 5.7 Verify production build does not expose dangerous QA mutation hooks — static source inspection shows GameHost QA panels/tutorial bypasses behind `isDevBuild()` and hook methods behind `assertDevOnly()`; focused production/config boundary suite passed 34/34 and non-migrated QA gate passed.
- [x] 5.8 Re-run offline/network and permission boundaries after native prebuild — offline validator is CLEAN; focused permission/config boundary tests passed 34/34 after the clean prebuild evidence.

## 6. Dependency/security/privacy classification — P2
- [x] 6.1 Run full dependency audit and runtime-only audit separately — both `npm audit` and `npm audit --omit=dev` produced the same 16 findings (12 moderate, 4 high, 0 critical).
- [x] 6.2 Map each advisory to runtime/build/dev reachability and fix availability — `.agent/DEPENDENCY_AUDIT.md` classifies all findings as Expo/Metro/Xcode build-toolchain-only, with no production/runtime-reachable finding and no safe fixed upstream release for the roots.
- [x] 6.3 Apply only safe, in-SDK fixes; do not force incompatible major upgrades for a green number — no risky dependency churn applied; accepted debt remains tied to the planned Expo upgrade and image-size upstream status.
- [x] 6.4 Check committed files for accidental secrets/private keys/tokens — tracked-source secret-pattern scan produced no hits.
- [x] 6.5 Verify no analytics/crash telemetry/network path was accidentally introduced — offline static boundary is CLEAN and no telemetry/network implementation was added in the current wave.
- [ ] 6.6 Verify backup/export contains only intended local user data and integrity metadata — NOT VALIDATED in the current bounded run because backup suites were interrupted by host SIGSEGV.

## 7. Performance and accessibility evidence — P2
- [ ] 7.1 Re-run existing perf probes with identical workloads and record runtime context — NOT VALIDATED: the single bounded `npm run perf:probe` attempt reproduced host SIGSEGVs in both measurement processes and emitted no baseline JSON; no retry was made.
- [ ] 7.2 Reproduce the multi-second backup/export path at realistic history sizes — NOT VALIDATED: the required opt-in measurement process crashed before producing timing evidence.
- [ ] 7.3 Profile only if 7.2 is user-relevant; optimize with before/after evidence — NOT STARTED because 7.2 produced no usable timing evidence and no performance defect was established.
- [ ] 7.4 Re-run loadProgressSnapshot and sync scans to prevent regression — NOT VALIDATED for wall-clock measurement; always-on query/projection guards and sync seam contracts remain covered.
- [x] 7.5 Re-run changed-surface accessibility labels/roles/state/focus checks — focus contract 6/6 and shared game-ui accessibility contract 2/2 PASS; targeted ESLint and typecheck PASS. The focus test uses a deterministic queued-timeout seam to avoid React 19/RNTL async-act timer races.
- [ ] 7.6 Capture Android hierarchy evidence when a stable device exists — BLOCKED/NOT VALIDATED: no stable dedicated device is available on this host.
- [x] 7.7 Keep TalkBack/manual and iOS UX evidence NOT VALIDATED unless actually performed — no manual TalkBack, iOS UX, or system-sheet evidence was claimed.

## 8. Final release-candidate certification — P1
- [ ] 8.1 Clean checkout install and all repository validators PASS — PARTIAL: clean-checkout install/static/app gates passed, but full Jest remains NOT VALIDATED after reproducible host SIGSEGV.
- [x] 8.2 TypeScript PASS; lint 0 errors / 0 warnings — current head typecheck and `expo lint` pass; targeted changed-surface ESLint also passes.
- [ ] 8.3 Jest PASS with only allowlisted skips and zero unexpected console noise — PARTIAL: bounded failure-path set is quiet and 20/20 PASS; full current-head Jest remains NOT VALIDATED.
- [x] 8.4 Web export + Expo Doctor PASS — web export produced 20 static routes; Expo Doctor passed 21/21.
- [ ] 8.5 Android clean prebuild/native build PASS — clean prebuild/config inspection passed; native APK compilation remains NOT VALIDATED because Java/Gradle/Android SDK tooling is absent.
- [ ] 8.6 iOS macOS build-smoke PASS or externally BLOCKED with evidence — BLOCKED/NOT VALIDATED: this host is not macOS and has no Xcode runner.
- [ ] 8.7 Android current-head journeys/certify PASS or externally BLOCKED after bounded recovery matrix — BLOCKED/NOT VALIDATED: no ADB, emulator, or physical device is available; prior WHPX failures are recorded.
- [x] 8.8 Security/dependency classification contains no unresolved Critical/High runtime issue — full and `--omit=dev` audits both report 0 critical; all 16 findings are classified as build/dev-toolchain-only with no runtime-reachable Critical/High issue.
- [ ] 8.9 No material data-loss/corruption/recovery defect remains — NOT VALIDATED: migration/backup/database-lock/full recovery matrices remain blocked by host SIGSEGV.
- [ ] 8.10 Push final coherent main SHA — BLOCKED: GitHub rejects workflow-file updates because the OAuth token lacks the `workflow` scope.
- [ ] 8.11 Confirm App CI + Repository Integrity green on exact final SHA — NOT VALIDATED until the current workflow changes can be pushed.
- [ ] 8.12 Write terminal checkpoint and synchronize STATE/CURRENT_CAMPAIGN/KNOWN_ISSUES/VALIDATION/OpenSpec lifecycle.
- [x] 8.13 Leave deferred systems explicitly deferred, not represented as missing blockers — signing/store submission, iOS/manual UX, SAF sheets, cloud/auth, telemetry, and monetization remain deferred or NOT VALIDATED by design.
