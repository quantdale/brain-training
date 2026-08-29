# Execution Entry — Campaign 016 Release Certification & Hardening

**Lifecycle:** ACTIVE
**Baseline:** `1b5802d62447c44e58d0f0bdb36ada740b05d023`
**Predecessor:** `015-governance-depth-convergence` (VALIDATED on `fc9899e`)

## Mission
Turn the mature offline-first product into an evidence-backed release candidate without adding breadth. Reproduce from a clean checkout, obtain native/platform evidence where available, harden failure and recovery paths, make CI skips/warnings interpretable, and preserve honest BLOCKED/NOT VALIDATED classifications.

## Autonomous execution order

### Phase 0 — Predecessor truth closure — COMPLETE
Campaign 015 was validated only after App CI `33226167744` and Repository Integrity `33226167736` both passed on exact main SHA `fc9899e`. Governance, STATE, CURRENT_CAMPAIGN, EXECUTION_PROMPT, ownership, OpenSpec lifecycle, checkpoint, KNOWN_ISSUES, and VALIDATION were synchronized. Android/iOS/manual-sheet limitations were retained as BLOCKED/NOT VALIDATED.

### Phase 1 — Clean-checkout reproducibility
Use a genuinely clean worktree/clone with no inherited `node_modules`, generated native folders, Metro cache, or Jest cache. Run the full install, repository, app, and native-preparation stack. Add a repeatable certification script if the sequence is not already executable as one command.

### Phase 2 — Native build reproducibility
Android: clean Expo prebuild and native release/build smoke from committed config. Verify package ID, version metadata, dangerous permission absence, backup rules, NDK pin, startup, and no debug-only QA exposure in a production-mode build.

iOS: add or use macOS CI build smoke with Expo prebuild, CocoaPods, and an unsigned Xcode simulator build. Keep runtime UX/device proof separate; signing and store submission remain deferred.

### Phase 3 — Android current-head runtime certification
Repair the designated AVD through the bounded matrix in `design.md`. Once stable, run changed-surface canaries, Workout V3 daily/focus/relaunch, then one complete `--mode certify` 42/42 pass on the current candidate SHA. Never adopt a foreign emulator.

### Phase 4 — CI/test signal integrity
Classify the four skipped suites and five skipped tests; prevent silent growth. Remove expected failure-path `console.error` noise from green logs by spying/asserting it in relevant tests. Upgrade GitHub actions only after confirming supported runtime compatibility. Preserve a machine-readable Jest summary artifact.

### Phase 5 — Runtime resilience/security
Run adversarial persistence, workout attribution/idempotency, backup/import/rollback, storage-unavailable, process-death/relaunch, pause/background, offline/network, permissions, and production-QA-hook boundary checks. Re-run runtime-vs-dev dependency audit.

### Phase 6 — Performance/accessibility evidence
Re-run identical performance probes. Profile only reproduced user-relevant hot paths, especially backup/export. Re-run changed-path accessibility semantics and Android hierarchy evidence; do not claim manual TalkBack or iOS UX PASS without evidence.

### Phase 7 — Final certification
Run all repo/app/native/platform gates on the final exact SHA, push, confirm App CI and Repository Integrity, synchronize docs/state, write a terminal checkpoint, and stop when remaining work is genuinely deferred or non-blocking.

## Stop conditions

Stop only when all in-scope P0/P1 findings are closed, the exact final SHA is green in required CI, clean-checkout/native evidence is reproducible where supported, current Android certification is fresh or a genuine external BLOCKED condition is documented after the bounded matrix, iOS compile compatibility has evidence or an external blocker is proven, and remaining work is P2/P3 or constitution-deferred.

Do not implement cloud/auth/AI/monetization/social/store-release systems or add game #43.
