# Campaign 016 — Release Certification & Hardening

**Status:** ACTIVE — App CI/iOS/Repository Integrity PASS on latest SHA; Android latest build timed out; residual runtime/recovery evidence remains BLOCKED/NOT VALIDATED.
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
- CI-signal hardening is implemented: four skipped suites / five skipped tests are classified by `scripts/certification/jest-skip-allowlist.json`; App CI emits/validates/uploads `jest-summary.json`, uses fail-closed skip matching, exposes `npm run perf:probe`, and uses current action majors. The bounded failure-path set passes 5 suites / 20 tests with expected diagnostics asserted and suppressed.
- Runtime/security evidence is partially converged: bounded PASS for storage recovery, session lifecycle/timing, workout provenance/reconcile, autobot self-test 49/49, offline boundary, secret scan, QA-hook boundary, and 16-finding build-toolchain-only audit classification. Full Jest, DB integrity/idempotency, migration, backup/rollback, database-lock, and full workout matrix remain NOT VALIDATED after host Node SIGSEGV/exit 139.
- Accessibility contracts pass (focus 6/6 and shared game UI 2/2); opt-in wall-clock performance probes remain NOT VALIDATED after the same host SIGSEGV. Manual TalkBack, SAF/system sheets, and iOS UX remain BLOCKED/NOT VALIDATED.
- Latest exact-SHA CI status at `31a6143`: App CI `33239131160`, iOS Build Smoke `33239131153`, and Repository Integrity `33239131170` PASS. Android Build Smoke `33239131146` was cancelled by the 60-minute job timeout after stalling in `:app:compressReleaseAssets`; it is BLOCKED/NOT VALIDATED, not a product-build PASS. The prior Android release artifact PASS at `1b87619` remains valid historical evidence (`APK_BYTES=109245513`, SHA-256 `be21bb375d75eda9331f5d8d66958944ea3f91754e9ed3c33f1e81f25194db16`).
- Android dedicated-device installation/startup, post-015 canaries, Workout V3 journeys, hierarchy evidence, and 42/42 certification remain NOT VALIDATED. The designated AVD recovery attempts reproduced the documented 37.1.11/WHPX/qemu failure; the foreign `study-maker-api35` AVD was not adopted.
- Platform convergence checkpoint: `.agent/checkpoints/016-release-certification-hardening-platform-convergence-20260829.md`. The earlier `-BLOCKED` checkpoint is a historical pre-push/pre-platform snapshot; Campaign 016 remains ACTIVE because residual runtime/recovery/device evidence is unresolved.
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
