# Durable Project State

**Last update:** 2026-09-17 — Campaign 031 is terminally validated on the
latest synchronized `main`; Campaign 030B remains the immutable before
baseline and Campaign 029 external provider evidence remains historical.
**Canonical branch:** `main`
**Active campaign:** none
**Last campaign:** `031-golden-path-redesign`
**Last campaign status:** VALIDATED

## Current status

Campaign 031 (`031-golden-path-redesign`) is the terminally validated
owner-directed product implementation successor. Its authoritative task
specification is
`.agent/CAMPAIGN031_GOLDEN_PATH_REDESIGN_IMPLEMENTATION_PROMPT.md`. The
campaign activation/synchronization start SHA is `44ba153`; implementation was
reconciled on the concurrent latest `origin/main` documentation checkpoint
`5e9d300` before product edits. The Campaign 030B rendered/runtime package is
preserved as the before baseline.

The current implementation is converging the golden path only: Today/Home
hierarchy and CTA, workout handoff context, concise GameHost intro and focused
HUD, outcome-first shared/route Results, direct Next Game, and explicit final
completion. Existing SQLite/workout/provenance/lifecycle/scoring/session/
rating/XP/currency/reward/tutorial/registry/offline contracts remain protected;
no schema or dependency change is authorized.

Campaign 029's ARTEMIS/provider evidence is historical context. The external
ARTEMIS checkout remains outside this repository, credentials remain external,
and its previously recorded OpenCode Go HTTP 503 is not being relabeled as a
Campaign 031 product result. Campaign 031 will use one disposable normal AVD
and classify any unavailable runtime or human evidence explicitly.

## Campaign 031 checkpoint — golden-path redesign (VALIDATED)

- **Before baseline:** Campaign 030B screenshots and dynamic/relaunch evidence
  are preserved under `docs/redesign/evidence/campaign030b/**` and the external
  temp directories documented there; they are not overwritten.
- **Implementation:** Home now makes Today’s Workout the dominant decision,
  moves context and reroll/configuration into secondary surfaces, and keeps the
  existing durable route target. GameHost introduces concise mechanic/workout
  framing and `Start game`; shared and route Results now place facts before
  reward and expose Next/Finish hierarchy.
- **Validation:** focused/full repository and native checks PASS as documented
  in `docs/redesign/evidence/campaign031/REGRESSION_MATRIX.md`; dynamic and
  static light/dark pixel evidence, accessibility, relaunch/idempotency replay,
  and exact-once database checks are recorded in the Campaign 031 package.
- **Human/external limits:** independent human validation, ARTEMIS model trace,
  TalkBack, physical-device/iOS runtime, SAF sheets, and Expo patch drift remain
  explicitly pending/deferred; none is relabeled as PASS.
- **Terminal result:** all Campaign 031 exit criteria are evaluated and the
  repository is ready for a separately authorized Campaign 032, which was not
  started in this session.

## Historical Campaign 029 checkpoint — ARTEMIS migration (closed VALIDATED)

- **Closure:** Campaign 029 is **VALIDATED / CLOSED** (closure commit
  `7cea4a4`; recovery record
  `.agent/checkpoints/029-artemis-runtime-qa-migration-validated-20260917.md`).
  The fresh-session runtime gates passed through Codex to ARTEMIS MCP on
  `emulator-5554`:
  - Settings Flash **PASS** — `9aaa2db9-5743-4bf9-9835-ab5b537fb622`.
  - Brain Training Flash **PASS** — `e927ade5-2b2d-4e2f-a150-7c316230a85d`.
  - Brain Training Pro **PASS by direct trace/step/screenshot inspection** —
    `5908e678-4b6d-4abf-8ece-2fcc41b3cc67`; its optional verifier subchecks
    remain `INCONCLUSIVE` (Muse request-schema errors) and are not reported as
    PASS.
- **Route:** OpenCode Go / `muse-spark-1.3-contributor` on the OpenAI Responses
  API (`https://opencode.ai/zen/go/v1/responses`), `reasoning.effort=xhigh`,
  `fallback=null`; 20/20 effective roles audit clean, with zero Union Alpha,
  Gemini, Gemini Robotics, or alternate-provider routes.
- **External checkout:** `D:\Tools\artemis` is clean at local revision
  `2ef304b` over `26124b4` / `7328c4b` / `07ecb21` / `e70ca52` (upstream
  `371aa6d`); local-only and never pushed upstream. Credentials stay in the
  external `.env`. The repository setup self-test remains 5 checks passed with
  2 documented launcher skips. No ARTEMIS source, trace, or credential is
  copied into Git.
- **Repository boundary:** `scripts/qa/autobot.mjs` and its lock ignore entry
  are removed. Current CI/certification/self-test/docs use the offline
  ARTEMIS contract or setup/evidence helpers; historical records retain old
  evidence only as historical context.
- **Historical context:** the earlier Gemini/Union Alpha provider attempts
  (including the OpenCode Go Messages HTTP 503 and the invalid Gemini-prewarm
  trace `4340ff06-befd-4af7-9404-527940fa68a9`) are superseded and remain
  historical only.

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

Campaign 031 is terminally validated and `.agent/EXECUTION_PROMPT.md` plus the
Campaign 031 evidence package are its recovery record. Do not resume the
historical 029 provider checkpoint or closed 028 packet as active work. Do not
begin Campaign 032 without a new owner directive. Externally blocked evidence
classes (store signing, manual TalkBack, SAF sheets, physical device, iOS
runtime, and any unavailable independent participant) remain honestly
classified.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `.agent/VALIDATION.md` and `.agent/KNOWN_ISSUES.md`
7. `openspec/changes/031-golden-path-redesign/` (EXECUTION → proposal → design
   → specs → tasks) and `audit-map.md`
