# Execution Prompt — Campaign 016: Release Certification & Hardening

**Status:** VALIDATED — terminal closure
**Change:** `016-release-certification-hardening` (`change.json` VALIDATED)
**Start-SHA:** `f0d301bc1b80ed657c75af81c476ee87dbeea540`
**Planned-At:** 2026-08-30 final convergence
**Target-Branch:** `main`
**Predecessor:** `015-governance-depth-convergence` (VALIDATED at `fc9899e`)
**Authorization:** explicit owner directive to converge and close Campaign 016. No Campaign 017 was created, and no new product scope was opened.

## Mission and closure decision

Campaign 016 was an evidence-first release-certification and hardening
campaign. It did not add game #43 or implement cloud/auth/AI/monetization,
social, signing, or store functionality. Repository-owned implementation and
automated/native compile evidence are complete. The campaign is terminally
`VALIDATED`; no executable campaign is active.

Final classification:

> LOCALLY / AUTOMATED COMPLETE — EXTERNAL DEVICE / MANUAL CERTIFICATION PENDING

Unavailable device and manual evidence is retained as `BLOCKED` or `NOT
VALIDATED`, never inferred from compilation or prior device runs.

## Exact-source evidence

The independently verified source head
`f0d301bc1b80ed657c75af81c476ee87dbeea540` passed all four required workflows:

- App CI `33293614545` — PASS, `Mobile app build/typecheck/tests`.
- Repository Integrity `33293614543` — PASS, `durable-state`.
- Android Build Smoke `33293614561` — PASS, `Android clean native build`,
  including clean native generation, release APK compilation,
  release-boundary checks, and artifact upload.
- iOS Build Smoke `33293614540` — PASS, `iOS simulator compile smoke`,
  including clean prebuild, CocoaPods, and unsigned simulator compile.

The final pushed SHA and its post-closure CI run IDs are recorded in the
terminal checkpoint. The older Android timeout `33239131146` on `31a6143` is
historical only and remains explicitly labeled as such.

## Automated completion gate

- Repository state, OpenSpec, ownership, registry, provenance, and offline
  validators: PASS.
- QA self-test: 49/49 PASS.
- TypeScript: PASS. Lint: 0 errors / 0 warnings.
- Jest: 489 suites and 6,056 tests passed; 4 suites and 5 tests skipped by the
  explicit allowlist; 0 failures. Jest signal: 0 unclassified skips and 0
  unexpected warnings.
- Web export: 20 static routes PASS. Expo Doctor: 21/21 PASS.
- DB integrity/idempotency, migration matrix/robustness/v10 hardening,
  backup/import/rollback, storage/database-lock, workout attribution/lifecycle,
  production-boundary/offline, and accessibility contract tests: PASS.
- Opt-in performance probes: PASS on Node 22.23.2; current measurements are
  recorded in the terminal checkpoint and `.agent/VALIDATION.md`.
- Dependency/security: 0 critical, 0 low, 12 moderate, 4 high, all 16
  classified as build/dev-toolchain-only in `.agent/DEPENDENCY_AUDIT.md`.

## External and manual boundary

The designated `braintraining-qa36` AVD is unavailable on the current host;
the bounded 37.1.11/WHPX/qemu failure remains documented. The only connected
ADB emulator is the foreign `study-maker-api35` and was not used. Android
dedicated install/start, changed-surface canaries, Workout V3 daily/focus/
relaunch, current-head 42/42 certification, hierarchy capture, manual
TalkBack, SAF/system sheets, physical-device behavior, and manual iOS runtime
UX remain `BLOCKED`/`NOT VALIDATED`. iOS compile PASS is not runtime UX PASS.

Signing, store publication, cloud/auth, telemetry, monetization, and other
constitution-deferred decisions remain deferred and are not defects.

## Terminal artifact and recovery

The terminal artifact is
`.agent/checkpoints/016-release-certification-hardening-VALIDATED-20260830.md`.
No unresolved Critical or High defect and no material data-loss/corruption
defect is known. A successor campaign requires explicit owner authorization
and genuinely new scope.
