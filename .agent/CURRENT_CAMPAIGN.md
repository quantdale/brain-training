# Campaign 016 — Release Certification & Hardening

**Status:** VALIDATED — terminal repository state; external device/manual certification remains pending
**Campaign id:** `016-release-certification-hardening`
**Predecessor:** `015-governance-depth-convergence` (VALIDATED 2026-08-29; closure SHA `fc9899e`)
**Mode:** day
**Change:** `016-release-certification-hardening` (VALIDATED; `change.json` VALIDATED, `GOVERNANCE.activeCampaign` null, `STATE` and terminal ownership synchronized)
**Authorization:** owner-authorized Campaign 016 closure after repository-owned implementation and automated certification converged. No Campaign 017 was created. No game #43, feature expansion, cloud/auth/AI/monetization/store work.

## Final classification

**LOCALLY / AUTOMATED COMPLETE — EXTERNAL DEVICE / MANUAL CERTIFICATION PENDING**

Campaign 016 is terminally `VALIDATED` under the repository's OpenSpec
lifecycle. All repository-owned implementation, automated certification,
security/privacy classification, native build-smoke, and exact-source CI work
that is available through automation is complete. Unavailable device and
manual evidence remains explicitly `BLOCKED` or `NOT VALIDATED`; it is not
represented as a product defect or a fabricated PASS.

## Exact-source CI evidence independently verified before closure

Source head `f0d301bc1b80ed657c75af81c476ee87dbeea540` was clean and had four
green workflows:

- App CI `33293614545` — PASS, job `Mobile app build/typecheck/tests`.
- Repository Integrity `33293614543` — PASS, job `durable-state`.
- Android Build Smoke `33293614561` — PASS, job `Android clean native build`;
  clean native generation, release APK compilation, release-boundary checks,
  and artifact upload completed.
- iOS Build Smoke `33293614540` — PASS, job `iOS simulator compile smoke`;
  clean prebuild, CocoaPods, and unsigned simulator compile completed.

The older Android timeout (`33239131146` on `31a6143`) remains historical
evidence only. It is not the current Android result and is not erased.

## Closure evidence

- Full Jest: 489 suites passed / 4 allowlisted skipped; 6,056 tests passed / 5
  allowlisted skipped; 0 failures. Jest signal validation: 0 unclassified
  skips, 0 unexpected warnings.
- DB integrity/idempotency, migration matrix/robustness/v10 hardening,
  backup/import/rollback, storage/database-lock boundaries, workout
  attribution/lifecycle, and production-boundary/offline tests passed.
- TypeScript passed; lint passed with 0 errors / 0 warnings; Expo Doctor passed
  21/21; web export produced 20 static routes; QA self-test passed 49/49.
- Both opt-in performance probes passed on Node 22.23.2. Current measurements
  include `loadProgressSnapshot_20000_ms=112.691259`,
  `exportLocalData_5000_incl_checksum_canonical_ms=5155.865523`,
  `syncQuestProgress_20000_total_ms=37.63658`, and
  `syncAchievements_20000_total_ms=98.749851`.
- Full and runtime-only npm audits report 0 critical, 0 low, 12 moderate, and
  4 high findings. `.agent/DEPENDENCY_AUDIT.md` classifies all 16 as
  Expo/Metro/Xcode build-toolchain-only with no runtime-reachable Critical or
  High finding; no risky dependency churn was applied.

## Device and manual classifications

- Android dedicated install/start, Rule Grid and Transform Match canaries,
  Workout V3 daily/focus/relaunch, current-head 42/42 `autobot --mode certify`,
  and Android hierarchy: **BLOCKED / NOT VALIDATED**. The designated
  `braintraining-qa36` AVD is unavailable on this host; the bounded
  emulator-37.1.11/WHPX/qemu recovery failure remains documented. The only
  connected ADB device is the foreign `study-maker-api35` and was not used.
- Manual TalkBack, SAF/share/document-picker system sheets, physical-device
  behavior, and manual iOS runtime UX: **NOT VALIDATED / DEFERRED**. iOS
  simulator compile PASS is not manual iOS UX PASS.
- Signing, provisioning, store publication, cloud/auth, telemetry,
  monetization, and other constitution-deferred decisions: **DEFERRED**, not
  missing implementation requirements.

## Exit state

No unresolved Critical defects, High defects, or material data-loss/corruption
defects are known. Remaining Medium/Low items are external/manual platform
limitations or accepted build-toolchain audit findings. The terminal checkpoint
is `.agent/checkpoints/016-release-certification-hardening-VALIDATED-20260830.md`.
No future campaign is implied; a successor requires explicit owner
authorization and genuinely new scope.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/checkpoints/016-release-certification-hardening-VALIDATED-20260830.md`
6. `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`
