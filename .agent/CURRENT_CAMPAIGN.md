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
