# Campaign 015 — Closure Checkpoint

**Checkpoint status:** closure candidate; 015 remains ACTIVE until the closure SHA workflows are verified.
**Starting SHA:** `ea144d705b3bb44f74700a46744fee75821c63c8`
**Canonical branch:** `main`
**Predecessor:** Campaign 014 COMPLETED at `f66f65c`
**Implementation baseline:** `60fdadc` — causal workout attribution and the 015 implementation waves.

## Evidence

- Exact-head App CI run `33121632955` passed on `ea144d7`: 488 passed suites, 4 intentionally skipped suites, 6,043 passed tests, 5 skipped tests, and 5 snapshots. The four skipped suites are opt-in performance probes; the fifth skipped test is the opt-in projection measurement. Expected failure-injection/dev-perf/test-harness console output and Node 20 deprecation annotations are classified, not hidden.
- Exact-head Repository Integrity run `33121632951` passed on `ea144d7`.
- Local Linux full-suite attempts are **NOT VALIDATED**: Node processes segfaulted under host resource contention. The isolated `language-word-scramble` screen suite passed 3/3 repetitions; no timeout threshold or production workaround was introduced.
- Dedicated Android changed-surface and Workout V3 journeys are **BLOCKED / NOT VALIDATED** in this environment: no Android SDK/ADB/emulator is installed here. Prior bounded attempts on the designated `braintraining-qa36` Windows/WHPX environment failed before ADB registration and recorded emulator segfaults. No foreign emulator was adopted.
- iOS native build and manual system-sheet evidence remain **NOT VALIDATED** under the documented host/policy limitations.
- No unresolved Critical/High product regression is known; the remaining limitations are infrastructure/platform evidence debt carried into proposed Campaign 016.

## Closure actions

- Updated 015 tasks 4A.5 and 11.10–11.17 with explicit PASS, NOT VALIDATED, or BLOCKED outcomes.
- Synchronized CURRENT_CAMPAIGN, EXECUTION_PROMPT, STATE, KNOWN_ISSUES, and VALIDATION with the exact CI evidence and blocker classification.
- Ran `node scripts/validate-repo-state.mjs`, `node scripts/validate-task-ownership.cjs`, and pinned OpenSpec validation before committing.
- **Next executable action:** commit and push this closure candidate, verify App CI and Repository Integrity on that exact pushed SHA, then atomically mark 015 `VALIDATED` and activate 016 in a separate transition commit. Never label Android as PASS.
