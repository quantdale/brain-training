# Execution Entry — Campaign 016 Release Certification & Hardening

**Lifecycle:** PROPOSED  
**Baseline:** `1b5802d62447c44e58d0f0bdb36ada740b05d023`  
**Predecessor:** `015-governance-depth-convergence`

## Mission

Turn the existing mature product into an evidence-backed release candidate. Do not add features for breadth. Close lifecycle truth, reproduce from a clean checkout, obtain fresh platform evidence, harden failure/recovery paths, and make CI green signal trustworthy.

## Autonomous execution order

### Phase 0 — Close Campaign 015 truthfully
1. Re-check that App CI `33105102260` and Repository Integrity `33105102351` are green on baseline `1b5802d`.
2. Reconcile 015 `tasks.md` against actual implementation/checkpoint evidence; check only tasks that are truly satisfied and explicitly classify remaining unavailable items.
3. Reconcile the 015 terminal checkpoint, `change.json`, GOVERNANCE, STATE, CURRENT_CAMPAIGN, EXECUTION_PROMPT, task ownership, VALIDATION and KNOWN_ISSUES.
4. Mark 015 COMPLETED/VALIDATED only if its exit policy is honestly satisfied.
5. Commit/push the closure and require both workflows green on that exact closure SHA.
6. Only then atomically activate 016.

### Phase 1 — Clean-checkout reproducibility
Use a genuinely clean worktree/clone with no inherited `node_modules`, generated native folders, Metro cache or Jest cache. Run the full install + repo validation + app validation stack. Add a repeatable script if the commands are currently tribal knowledge.

### Phase 2 — Native build reproducibility
Android: clean Expo prebuild and native release/build smoke from committed config. Verify package ID, version metadata, dangerous permission absence, backup rules, NDK pin, startup, and no debug-only QA exposure in a production-mode build.

iOS: add macOS CI build smoke using Expo prebuild + CocoaPods + Xcode simulator build with signing disabled. Keep runtime UX/device proof separate.

### Phase 3 — Android current-head runtime certification
Repair the dedicated AVD through the bounded matrix in `design.md`. Once stable, run changed-surface canaries, Workout V3 daily/focus/relaunch, then a complete `--mode certify` 42/42 pass on the current candidate SHA. Never adopt a foreign emulator.

### Phase 4 — CI/test signal integrity
Classify the 4 skipped suites / 5 skipped tests; prevent silent growth. Remove expected failure-path `console.error` noise from green logs by spying/asserting it inside the relevant tests. Upgrade GitHub action majors only after confirming current supported Node runtime and lock the result in CI. Keep warnings that cannot be removed explicitly classified.

### Phase 5 — Runtime resilience/security
Run adversarial persistence, workout attribution/idempotency, backup/import/rollback, storage-unavailable, process-death/relaunch, pause/background, and production-QA-hook boundaries. Re-run runtime-vs-dev dependency audit and permissions/offline checks.

### Phase 6 — Performance/accessibility evidence
Re-run identical performance probes. Profile only reproduced hot paths, especially backup/export if still multi-second at realistic history sizes. Re-run changed-path accessibility semantics and Android hierarchy evidence; do not claim manual TalkBack/iOS UX PASS without evidence.

### Phase 7 — Final certification
Run all repo/app/native/platform gates on the final exact SHA, push, confirm GitHub workflows, synchronize docs/state, write terminal checkpoint, and stop when remaining work is genuinely deferred or non-blocking.

## Stop conditions

Stop only when:
- all P0/P1 in-scope findings are closed;
- exact final SHA is green in required CI;
- clean-checkout and native build evidence is reproducible;
- current Android certification is fresh or a genuine external BLOCKED condition is documented after the bounded matrix;
- iOS compile compatibility has evidence or a non-repository external blocker is proven;
- remaining work is P2/P3 or constitution-deferred.

Do not spend time implementing cloud/auth/AI/monetization/social/store-release systems.
