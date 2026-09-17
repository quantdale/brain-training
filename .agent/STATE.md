# Durable Project State

**Last update:** 2026-09-17 — owner-directed OpenCode Go / `union-alpha` provider route prepared and audited offline; live runtime stages blocked on the missing `OPENCODE_GO_API_KEY` credential.
**Canonical branch:** `main`
**Active campaign:** `029-artemis-runtime-qa-migration`
**Last campaign:** `028-production-readiness`
**Last campaign status:** VALIDATED

## Current status

Campaign 029 (`029-artemis-runtime-qa-migration`) is the active owner-directed
successor to Campaign 028. Its objective is to replace the repository custom
Android device-driving QA with external Google ARTEMIS at `D:\Tools\artemis`,
remove obsolete driver integration, preserve observable app seams, and keep
the repository buildable and secure. The external ARTEMIS checkout is at
revision `371aa6d`; after a non-destructive host-GPU/no-snapshot boot, its
doctor is **ready** and the bundled helper is answering on the single AVD
`braintraining-ui35` / serial `emulator-5554`.

The migration code/docs boundary is reconciled. The old custom driver has been
removed, the offline contract/CI/certification/docs convergence validates, and
the supported ARTEMIS MCP block is merged without changing unrelated Codex
servers. Provider credentials remain external and are not recorded here. A
live ARTEMIS Settings Flash attempt reached the Settings app but was blocked
by Gemini model availability/quota responses; it is **BLOCKED / NOT
VALIDATED**, not a product pass. The owner then replaced that route: the only
authorized remote inference is OpenCode Go / `union-alpha`, and the external
ARTEMIS route is prepared with all 20 roles pinned to
`anthropic`/`union-alpha` (offline audit PASS). Brain Training Flash and Pro
remain **NOT VALIDATED** — now blocked only by the missing
`OPENCODE_GO_API_KEY` credential; no other model was substituted. The current
APK built,
installed, and started successfully on the dedicated AVD; the setup/diagnostic
self-test now passes with 5 checks and 2 documented launcher skips.

## Campaign 029 checkpoint — ARTEMIS migration (active)

- **External setup:** `D:\Tools\artemis` is a clean upstream checkout at
  `371aa6d`; `uv sync`, the current ready-device doctor/ADB check, helper
  attachment, and `mobile_diagnose` probe passed. The repository setup
  self-test passes 5 checks with 2 documented launcher skips. No ARTEMIS
  source, trace, or credential is copied into Git.
- **Repository boundary:** `scripts/qa/autobot.mjs` and its lock ignore entry
  are removed. Current CI/certification/self-test/docs now use the offline
  ARTEMIS contract or setup/evidence helpers; historical records retain old
  evidence only as historical context.
- **Runtime:** the standalone Settings smoke drove the emulator through
  ARTEMIS, then provider calls returned availability/quota errors. External
  trace IDs and exact safe classifications are recorded in `VALIDATION.md`.
- **Completed:** MCP generator/merge, app build/install, deterministic gates,
  OpenSpec, current-doc/state reconciliation, and the offline runtime contract.
- **Remaining:** the provider-dependent Settings/Brain Training Flash/Pro
  tasks; the device and setup self-test are currently ready/PASS. The current
  single blocker is the missing `OPENCODE_GO_API_KEY` for the owner-directed
  OpenCode Go / `union-alpha` route; the dedicated target is also currently
  owned by another active session (`braintraining-c030`).

## Historical Campaign 028 workstreams (closed VALIDATED)

1. **W1 user-action reliability** — Home workout CTA, rewards purchase/equip,
   profile milestone/quest/achievement claims surface failures; regression
   tests.
2. **W2 data-portability robustness** — single-pass export at the production
   call site (byte-identity already proven in-tree), quest/achievement FK
   cross-validation, pre-read pick size guard, preview re-entrancy and backup
   name collision.
3. **W3 QA harness reliability** — verified bounded deep-link retry with route
   classification, pause/resume verified dismissal on all branches, scheduled
   pre-warm for canaries/certify, bounded `qa-artifacts` retention, offline
   self-tests for the new helpers.
4. **W4 validator/CI hardening** — dependency-audit expiry/schema
   enforcement, offline-validator false-negative classes + self-test,
   IMPACT_MAP↔RULES content sync in CI, repo-state fail-open removal,
   jest-skip staleness detection, certify parity with CI, weekly advisory
   schedule.
5. **W5 cleanup + docs truth** — dead-file removal, KNOWN_ISSUES/
   DEFERRED_DECISIONS/PARITY_MATRIX truth, explicit deferral of
   password-encrypted backups, copy/a11y nits, four missing hooks tests.
6. **W6 verification** — full matrix/lint/validators/OpenSpec at the closure
   head; runtime canaries + daily-workout journey + a11y audit on
   `emulator-5560`; adversarial diff review; durable state sync.

## Baseline at activation (`1733458`)

- Campaign 027 closure matrix: 540 suites / 6450 tests PASS, `tsc` clean,
  `expo lint` clean, all validators green, OpenSpec 13/13; canaries 8/8 after
  manual pre-warm and daily-workout PASS.
- Evidence behind the campaign: `openspec/changes/028-production-readiness/audit-map.md`.

## Wave progress (campaign 028)

- **W1+W2 committed** at `18b9bd8`: silent user-action failures now surface
  danger toasts and stay retryable (Home CTA, rewards purchase/equip, profile
  claims); single-pass production export, import FK cross-validation, pick
  size guard, preview re-entrancy/backup-name collision. Wave evidence: 27
  suites / 259 tests PASS, `tsc` clean, targeted lint clean.
- **W3+W4 committed** at `5f55b68` (pushed): autobot verified deep-link
  retry, pause/resume dismissal check, scheduled pre-warm, bounded run-dir
  retention, self-test 70/70; dependency-audit expiry/schema enforcement
  41/41; offline validator rewritten (`*` and `//` line-skip false negatives
  fixed, aliased/dynamic global access, `sendBeacon`/`EventSource`; 18/18
  self-tests, real scan CLEAN over 968 files); IMPACT_MAP↔RULES content sync
  (`--check-sync`, wired into CI, drift proven by negative test); repo-state
  requires task-ownership/EXECUTION_PROMPT and reports ownership parse
  failures (proven) + workflow-referenced script existence check; jest-skip
  allowlist schema v2 with `reviewedAt` and stale-entry detection; certify
  gate parity with CI incl. Jest signal; weekly schedule + cheap self-tests
  in CI.
- **W5 complete:** verified-dead `release-driver.mjs` and
  `tsconfig.validate.json` removed (ownership entry cleaned); `refero.mjs`
  kept with a historical-disposition header; KNOWN_ISSUES resolved entries
  (cold-start race, export double-pass, offline heuristic, artifact
  retention) + dependency-expiry note; DEFERRED_DECISIONS transport corrected
  and password-encrypted backups recorded as explicit deferred (§7, not §33);
  `checksum.ts` comment corrected; PARITY_MATRIX DEFERRED row added and export
  row updated; error-boundary copy, dialog scrim role, game-not-ready copy
  fixed; four hooks tests added (`attention-target-count`,
  `logic-code-cracker`, `logic-rule-grid`, `memory-prospective-cue`) with
  component suites green.
- **W6/W7 closure complete:** full matrix 545 suites / 6486 tests PASS
  (5 allowlisted opt-in probes skipped, signal-validated), `tsc` clean,
  `expo lint` clean, every validator + OpenSpec 15/15 green; runtime
  canaries 8/8 PASS with scheduled pre-warm on `emulator-5560` (one prior
  7/8 run honestly diagnosed as an environmental LogBox-snackbar block on
  `logic-next-sequence`; isolated single-game repro PASS); daily-workout
  journey PASS (4/4 + relaunch persistence); a11y audit 0 violations across
  11 route-verified surfaces; adversarial diff review recorded no guard
  weakening, no fake green, deletions verified unreferenced.

## Frontier-audit application (2026-09-14, owner-directed; no campaign bound)

Under an explicit owner instruction the eight 2026-09-14 frontier-audit
OpenSpec proposals were applied, reviewed, marked **VALIDATED** with
**69/69 tasks complete**, and **archived** to
`openspec/changes/archive/2026-09-14-<id>/`: `terminal-durable-state-truth`,
`settings-driven-color-theme`, `persistent-game-tutorials`,
`progression-refresh-on-surfaces`, `residual-user-surface-honesty`,
`in-game-workout-next-leg`, `certify-provenance-parity`,
`null-absent-performance-metrics`. `GOVERNANCE.activeCampaign` intentionally
was `null` at that historical checkpoint (applied directly under owner
authorization, not as a bound campaign). Full-matrix and runtime evidence is recorded in
`.agent/VALIDATION.md` under “Frontier-audit application”.

## Historical terminal state (`028-production-readiness` VALIDATED)

Campaign 028 was terminal before the owner opened Campaign 029. Its external
evidence classes remain separately classified in KNOWN_ISSUES (store signing,
manual TalkBack, SAF sheets, physical device, iOS runtime).

## Continuation rule

Campaign 029 is active and `.agent/EXECUTION_PROMPT.md` is its executable
recovery pointer. Do not resume the closed 028 packet as active work. Continue
029 until repository work is complete or the external provider blocker meets
the durable blocked-goal threshold. Externally blocked evidence classes (store
signing, manual TalkBack, SAF sheets, physical device, iOS runtime) remain
honestly classified unless 029 explicitly exercises a scoped Android path.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `.agent/VALIDATION.md` and `.agent/KNOWN_ISSUES.md`
7. `openspec/changes/029-artemis-runtime-qa-migration/` (EXECUTION → proposal
   → design → specs → tasks) and `audit-map.md`
