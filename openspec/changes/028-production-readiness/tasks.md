# Tasks — Campaign 028: Production-Readiness Closure

## W1 — User-action reliability

- [x] 1.1 Home primary workout CTA (`onStartTemplate`) rejection surfaces a
      danger toast and stays retryable; route failure test added.
- [x] 1.2 Rewards cosmetic purchase + equip rejections surface toasts;
      route failure tests added.
- [x] 1.3 Profile milestone/quest/achievement claim rejections surface
      toasts; route failure tests added.
- [x] 1.4 Sweep sibling handlers in the same screens for the same silent
      class; fix or record each.

## W2 — Data-portability robustness

- [x] 2.1 Migrate the production export call site to the proven single-pass
      `exportLocalDataBundle`; resolve the 027 W2.5 deferral in
      KNOWN_ISSUES; update barrel/tests; byte-identity suites stay green.
- [x] 2.2 Cross-validate `questProgress.questId` and
      `achievementUnlocks.achievementId` in `deserialize.ts` with a typed
      validation rejection; adversarial test added.
- [x] 2.3 Pre-read size guard for picked backup files where asset size is
      available; test added.
- [x] 2.4 `onPreview` busy re-entrancy guard; collision-resistant
      `defaultBackupName`; preview replace-mode counter accuracy;
      tests updated.

## W3 — QA harness reliability

- [x] 3.1 Pure `routeState` + `parseAmStart` helpers with offline self-tests
      (target/loading/home/other/unknown; Status ok vs delivered-warning).
- [x] 3.2 Verified bounded `deepLinkToGame` retry in `flowGame` +
      `probeNextGame`; disclosed attempts; failure reason includes attempts
      and last route; cold-start escalation for delivered-but-ignored links.
- [x] 3.3 Pause/resume patient-retry branch verifies overlay dismissal before
      setting `resumed`.
- [x] 3.4 Scheduled best-effort pre-warm before canaries/certify/all with
      `QA_PREWARM=0` escape; recorded in `run.json`.
- [x] 3.5 Bounded `qa-artifacts` retention in `initRunDir` with safety
      guards (`QA_KEEP_RUNS` default 10, `QA_NO_PRUNE`, harness-owned dirs
      only, never curated evidence).
- [x] 3.6 Harness self-test run stays green and covers the new pure helpers.

## W4 — Validator/CI hardening

- [x] 4.1 Dependency-audit gate enforces `runtime-accepted-debt` schema
      (future `expires` + `tracking`), rejects unknown classifications, and
      fails closed on expired entries; self-tests extended (expired future
      fixture + malformed fixture).
- [x] 4.2 `validate-offline.mjs`: fix `*`/`//` line-skip false negatives, add
      dynamic-access/aliasing/whitespace/`sendBeacon`/`EventSource`
      coverage, add `--self-test` fixtures, wire self-test into CI.
- [x] 4.3 `validate-affected.mjs` exposes structured rules and a
      content-level IMPACT_MAP sync check; `--list-areas` runs in CI; dead
      root-package patterns removed; table and RULES reconciled.
- [x] 4.4 `validate-repo-state.mjs`: require `task-ownership.json` +
      `EXECUTION_PROMPT.md`; ownership parse failures reported not skipped;
      workflow-referenced script existence check added.
- [x] 4.5 `validate-jest-signal.mjs`: stale allowlist entry detection
      (missing file / missing `enableWith`), review metadata on entries,
      self-test extended.
- [x] 4.6 `certify-clean-checkout.mjs` gate set matches CI (dependency
      audit, workflow hygiene, secrets, jest signal); docs updated.
- [x] 4.7 `repository-integrity.yml` gains a weekly schedule; every
      validator self-test reachable from CI where cheap.

## W5 — Cleanup and documentation truth

- [ ] 5.1 Verified-dead `scripts/qa/release-driver.mjs` and
      `apps/mobile/tsconfig.validate.json` removed; `refero.mjs` disposition
      verified (keep with reference or remove).
- [ ] 5.2 KNOWN_ISSUES contradiction fixed; DEFERRED_DECISIONS transport note
      corrected; password-encrypted backups recorded as explicit deferred
      decision; `checksum.ts` comment corrected.
- [ ] 5.3 PARITY_MATRIX updated (encryption DEFERRED row; fusion resolved);
      MASTER_PLAN/README touched only if drift found.
- [ ] 5.4 `error-boundary` copy matches available actions; dialog scrim role
      corrected; `game-not-ready` unreachable-variant copy truthed.
- [ ] 5.5 `hooks.test.ts` added for `attention-target-count`,
      `logic-code-cracker`, `logic-rule-grid`, `memory-prospective-cue`.
- [x] 5.6 Constitution status line + GOAL.md directive history updated for
      Campaign 028.

## W6 — Verification and closure

- [ ] 6.1 Full matrix (`jest`), `tsc`, `expo lint`, every validator,
      OpenSpec validate — green at the closure head.
- [ ] 6.2 Runtime on `emulator-5560`: scheduled-prewarm canaries PASS,
      daily-workout journey PASS, a11y audit 0 violations (or honest
      NOT VALIDATED with reasons).
- [ ] 6.3 Adversarial self-review of the campaign diff (deletions verified
      unreferenced; retries traced; no guard weakened; no fake green).
- [ ] 6.4 STATE.md, CURRENT_CAMPAIGN.md, VALIDATION.md, GOVERNANCE.json,
      task-ownership, EXECUTION_PROMPT closed; commits pushed.
