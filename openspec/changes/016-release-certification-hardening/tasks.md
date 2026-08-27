# Tasks — Campaign 016 Release Certification & Hardening

## 0. Predecessor truth closure — P1
- [ ] 0.1 Confirm baseline exact-head App CI + Repository Integrity success.
- [ ] 0.2 Diff 015 checkpoint claims against actual 015 code/tests/tasks.
- [ ] 0.3 Update 015 task checkboxes only where evidence exists; classify unavailable runtime items explicitly.
- [ ] 0.4 Reconcile 015 change lifecycle and all machine-readable active-campaign fields.
- [ ] 0.5 Reconcile STATE/CURRENT_CAMPAIGN/EXECUTION_PROMPT/KNOWN_ISSUES/VALIDATION.
- [ ] 0.6 Push 015 closure SHA and require both workflows green on that exact SHA.
- [ ] 0.7 Atomically activate 016 only after 0.6.

## 1. Clean-checkout reproducibility — P1
- [ ] 1.1 Create a fresh worktree/clone with no inherited caches or generated native folders.
- [ ] 1.2 Verify `npm ci` succeeds without legacy-peer-deps.
- [ ] 1.3 Run repo-state, OpenSpec, ownership, registry, provenance, offline and QA self-test gates.
- [ ] 1.4 Run TypeScript, lint, full Jest, web export and Expo Doctor.
- [ ] 1.5 Add one documented/repeatable certification script if the full sequence is not already executable as one command.
- [ ] 1.6 Verify repeated clean runs do not mutate tracked files or generated artifacts.

## 2. Native build reproducibility — P1
- [ ] 2.1 Android clean Expo prebuild from committed config.
- [ ] 2.2 Verify generated manifest permissions and production QA/debug-hook boundaries.
- [ ] 2.3 Build native Android release/build-smoke artifact from clean generated state.
- [ ] 2.4 Install/start the artifact on the dedicated project device when available.
- [ ] 2.5 Add macOS iOS CI build-smoke: prebuild, pods, Xcode simulator build, signing disabled.
- [ ] 2.6 Archive concise failure logs/artifacts for both native build paths.
- [ ] 2.7 Document that signing/store submission remains intentionally deferred.

## 3. Android environment recovery & fresh certification — P1
- [ ] 3.1 Capture current emulator/SDK/WHPX/graphics/AVD versions and segfault logs.
- [ ] 3.2 Reproduce failure once; do not blind-retry.
- [ ] 3.3 Test a pinned known-stable emulator/toolchain candidate.
- [ ] 3.4 Test software-rendering/headless-safe configuration.
- [ ] 3.5 Recreate the dedicated AVD from scriptable inputs.
- [ ] 3.6 If available, use a physical ADB device as a non-host-input fallback.
- [ ] 3.7 Once stable, run Rule Grid + Transform Match + representative post-015 canaries.
- [ ] 3.8 Run Workout V3 daily/focus/relaunch journeys.
- [ ] 3.9 Run one full 42/42 `autobot --mode certify` pass on the candidate SHA.
- [ ] 3.10 If 3.3–3.6 all fail for infrastructure reasons, record BLOCKED with evidence; never mark PASS.

## 4. CI and test-signal integrity — P2
- [ ] 4.1 Enumerate exact 4 skipped suites / 5 skipped tests and their skip conditions.
- [ ] 4.2 Create explicit skip allowlist with rationale and owner.
- [ ] 4.3 Add CI gate that fails on any unexpected/new skip.
- [ ] 4.4 Add/standardize a dedicated performance-test command for opt-in perf suites.
- [ ] 4.5 Spy/assert expected `console.error` in failure-path tests so green CI is quiet.
- [ ] 4.6 Fail or classify unexpected console warnings/errors.
- [ ] 4.7 Upgrade GitHub Actions to current Node-compatible majors after checking release compatibility.
- [ ] 4.8 Preserve a machine-readable Jest summary artifact.

## 5. Runtime resilience and data integrity — P1/P2
- [ ] 5.1 Re-run workout ownership/idempotency adversarial matrix after process death/reopen.
- [ ] 5.2 Stress duplicate completion delivery and concurrent same-game workout instances.
- [ ] 5.3 Re-run SQLite migration matrix from representative historical schemas.
- [ ] 5.4 Re-run backup export/import preview/replace/rollback and malformed/corrupt input cases.
- [ ] 5.5 Verify storage-unavailable and database-lock failure UX does not corrupt state.
- [ ] 5.6 Re-run background/pause/resume timing fairness canaries.
- [ ] 5.7 Verify production build does not expose dangerous QA mutation hooks.
- [ ] 5.8 Re-run offline/network and permission boundaries after native prebuild.

## 6. Dependency/security/privacy classification — P2
- [ ] 6.1 Run full dependency audit and runtime-only audit separately.
- [ ] 6.2 Map each advisory to runtime/build/dev reachability and fix availability.
- [ ] 6.3 Apply only safe, in-SDK fixes; do not force incompatible major upgrades for a green number.
- [ ] 6.4 Check committed files for accidental secrets/private keys/tokens.
- [ ] 6.5 Verify no analytics/crash telemetry/network path was accidentally introduced.
- [ ] 6.6 Verify backup/export contains only intended local user data and integrity metadata.

## 7. Performance and accessibility evidence — P2
- [ ] 7.1 Re-run existing perf probes with identical workloads and record runtime context.
- [ ] 7.2 Reproduce the multi-second backup/export path at realistic history sizes.
- [ ] 7.3 Profile only if 7.2 is user-relevant; optimize with before/after evidence.
- [ ] 7.4 Re-run loadProgressSnapshot and sync scans to prevent regression.
- [ ] 7.5 Re-run changed-surface accessibility labels/roles/state/focus checks.
- [ ] 7.6 Capture Android hierarchy evidence when a stable device exists.
- [ ] 7.7 Keep TalkBack/manual and iOS UX evidence NOT VALIDATED unless actually performed.

## 8. Final release-candidate certification — P1
- [ ] 8.1 Clean checkout install and all repository validators PASS.
- [ ] 8.2 TypeScript PASS; lint 0 errors / 0 warnings.
- [ ] 8.3 Jest PASS with only allowlisted skips and zero unexpected console noise.
- [ ] 8.4 Web export + Expo Doctor PASS.
- [ ] 8.5 Android clean prebuild/native build PASS.
- [ ] 8.6 iOS macOS build-smoke PASS or externally BLOCKED with evidence.
- [ ] 8.7 Android current-head journeys/certify PASS or externally BLOCKED after bounded recovery matrix.
- [ ] 8.8 Security/dependency classification contains no unresolved Critical/High runtime issue.
- [ ] 8.9 No material data-loss/corruption/recovery defect remains.
- [ ] 8.10 Push final coherent main SHA.
- [ ] 8.11 Confirm App CI + Repository Integrity green on exact final SHA.
- [ ] 8.12 Write terminal checkpoint and synchronize STATE/CURRENT_CAMPAIGN/KNOWN_ISSUES/VALIDATION/OpenSpec lifecycle.
- [ ] 8.13 Leave deferred systems explicitly deferred, not represented as missing blockers.
