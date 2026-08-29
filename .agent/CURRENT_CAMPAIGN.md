# Campaign 016 — Release Certification & Hardening

**Status:** ACTIVE — predecessor Campaign 015 VALIDATED on exact green SHA `fc9899e`.
**Campaign id:** `016-release-certification-hardening`
**Predecessor:** `015-governance-depth-convergence` (VALIDATED 2026-08-29; closure SHA `fc9899e`)
**Mode:** day
**Change:** `016-release-certification-hardening` (ACTIVE, `change.json` ACTIVE, `GOVERNANCE.activeCampaign` 016, `STATE` synced, `task-ownership` 016 map)
**Authorization:** explicit continuation of the active campaign; hardening is now authorized by the 016 change definition. No game #43, no feature expansion, no cloud/auth/AI/monetization/store work.

## Mission
Turn the mature offline-first product into an evidence-backed release candidate without adding breadth. Reproduce from a clean checkout, obtain native/platform evidence where available, harden failure and recovery paths, make CI skips/warnings interpretable, and preserve honest BLOCKED/NOT VALIDATED classifications.

## Entry evidence
- Campaign 015 exact closure SHA: `fc9899e`.
- App CI `33226167744`: PASS on `fc9899e`; validation, registry, provenance, ownership, offline boundary, QA self-test, typecheck, lint, Jest, web export, and Expo Doctor all passed.
- Repository Integrity `33226167736`: PASS on `fc9899e`.
- 015 local Linux full-suite execution remains NOT VALIDATED after host Node SIGSEGV under contention; this is not converted to PASS.
- Dedicated Android and iOS/manual system-sheet evidence remain BLOCKED/NOT VALIDATED under the documented host/platform limitations; 016 must pursue the bounded recovery/build evidence plan without adopting a foreign emulator or claiming unavailable UX evidence.

## Progress checkpoint — 2026-08-29
- Clean-checkout reproducibility is materially complete: two disposable runs at `8b05941` passed all available install/static/app gates and tracked-mutation checks; full Jest remains NOT VALIDATED due host Node worker SIGSEGVs.
- Native boundary evidence at `75f81fe`: clean Android prebuild, generated permission/backup/version inspection, and 34/34 production/config boundary tests PASS. Android APK compilation/install/device and iOS Xcode build remain BLOCKED/NOT VALIDATED because this host lacks Java/Android SDK/ADB/device and macOS/Xcode.
- Exact-SHA App CI and Repository Integrity are green for `75f81fe` (`33228018746`, `33228018738`).
- CI-signal hardening is implemented locally: four skipped suites / five skipped tests are classified by `scripts/certification/jest-skip-allowlist.json`; App CI now emits/validates/uploads `jest-summary.json`, uses fail-closed skip matching, exposes `npm run perf:probe`, and upgrades Actions to checkout/setup-node v7, cache v6, upload-artifact v7. The bounded failure-path set passes 5 suites / 20 tests with expected renderer diagnostics asserted and suppressed; full current-head Jest remains NOT VALIDATED after host SIGSEGV, and repository-wide warning classification remains open.
- Runtime/security evidence is partially converged: bounded PASS for storage recovery, session lifecycle/timing, workout provenance/reconcile, autobot self-test 49/49, offline boundary, secret scan, QA-hook boundary, and 16-finding build-toolchain-only audit classification. A distinct DB integrity/idempotency probe (`db-integrity`, `integrity-hardening`, `sessions`, DB fixture) reproduced host Node `SIGSEGV` exit 139 before Jest output; migration/backup/database-lock/full workout matrix execution remains NOT VALIDATED and no blind retries were used.
- Performance/accessibility evidence is partially converged: changed-surface focus 6/6 and shared game-ui accessibility 2/2 PASS with typecheck/targeted lint; the single opt-in perf-probe attempt reproduced host SIGSEGV in both measurement processes with no JSON output, so wall-clock probes remain NOT VALIDATED. Device hierarchy/manual TalkBack/iOS UX remain BLOCKED/NOT VALIDATED.
- App-level release gates now pass where executable: current static validators, typecheck/lint, web export (20 routes), Expo Doctor (21/21), and dependency classification (0 critical; 16 toolchain-only findings). Native compilation/device, full Jest, final push/CI, and recovery matrices remain blocked or NOT VALIDATED.
- Android recovery classification is now recorded: Linux inventory found emulator 37.1.11/ADB 37.0.1 but no Java, no connected device, no running emulator, and only foreign AVD `study-maker-api35`; prior designated `braintraining-qa36` headless/software/no-Wi-Fi and recreated-AVD attempts reproduced the documented WHPX/qemu failure. Android runtime/canary/Workout V3/42-game certification remains BLOCKED/NOT VALIDATED.
- Latest local checkpoint before terminal documentation is committed at `87f43c2`; terminal blocked checkpoint is `.agent/checkpoints/016-release-certification-hardening-BLOCKED.md`. Final push/CI confirmation remains blocked by the GitHub token's missing `workflow` scope, and persistence/recovery evidence remains NOT VALIDATED after the single bounded DB probe SIGSEGV.
## Ordered workstreams
1. **Predecessor truth closure:** completed by the 015→016 transition; 015 is VALIDATED and 016 is the sole ACTIVE campaign.
2. **Clean-checkout reproducibility:** fresh install, repository/OpenSpec/ownership/registry/provenance/offline/QA gates, typecheck, lint, full Jest, web export, Doctor, and tracked-file mutation check.
3. **Native build reproducibility:** Android clean prebuild/build smoke and production boundary checks; macOS iOS compile smoke where the external runner is available; signing/store submission remain deferred.
4. **Android current-head certification:** bounded dedicated-AVD recovery matrix, changed-surface canaries, Workout V3 daily/focus/relaunch, and full 42/42 certification only if the designated device is stable.
5. **CI/test-signal integrity:** explicit skip allowlist, no silent skip growth, expected failure-path console assertions, and machine-readable Jest evidence.
6. **Runtime resilience/security:** persistence, attribution/idempotency, backup/import/rollback, storage-unavailable, process-death/relaunch, pause/background, offline, permissions, and production QA-hook boundaries.
7. **Performance/accessibility evidence:** identical probes and changed-surface semantics/hierarchy evidence; manual TalkBack/iOS UX remains NOT VALIDATED unless actually performed.
8. **Final certification:** exact-SHA local/native/platform gates, green App CI + Repository Integrity, terminal checkpoint, and synchronized durable state.

## Guardrails
- Full hardening is explicitly active for 016, but scope remains evidence and resilience, not feature breadth.
- Do not add game #43 or reopen locked product decisions.
- Do not use host mouse/keyboard automation, foreign emulators, blind retries, arbitrary sleeps, or false PASS labels.
- Stop on genuine external blockers only after bounded evidence is recorded and safe work is pushed.

## Recovery order
1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/KNOWN_ISSUES.md`
6. `.agent/VALIDATION.md`
7. `openspec/changes/016-release-certification-hardening/EXECUTION.md`
