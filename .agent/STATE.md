# Durable Project State

**Last update:** 2026-09-13 — Campaign 027 closed VALIDATED (deep hardening; owner-invoked).
**Canonical branch:** `main`
**Active campaign:** none
**Last campaign:** `027-deep-hardening`
**Last campaign status:** VALIDATED

## Current status

Campaign 027 closed VALIDATED at `212469d`: the deep hardening campaign
repaired the forensic audit's correctness defects, added the missing
reliability failure-path coverage (which surfaced and fixed five silent
failure handlers), bounded the hot quest-evaluation path with exact lifetime
aggregates, version-gated definition seeding, hardened CI/tooling (workflow
rules, fail-closed dependency-audit gate, action pins), truthed the
documentation, and removed dead weight. The product remains feature-frozen at
its terminal Campaign 026 scope (42 games, offline-first, no cloud/AI/
monetization). Remaining recorded work is Low/deferred or externally blocked
(see the continuation rule below and KNOWN_ISSUES.md).

## Campaign 027 progress (closed 2026-09-13, VALIDATED at `212469d`)

- Activation: `63e6326`.
- **W1 correctness — COMPLETE (`ed07f27`)**: vigilance stimulus lifetime,
  color-stroop dead actions, speed-color-match null-safe metric,
  spatial-coordinate-turn adaptive escalation (generator 1.2.0), word-scramble
  dead budget (generator 1.2.0), sibling scans — one extra dead action removed
  (`math-equation-builder puzzle-timeout`) with tick-expiry coverage.
- **W3 reliability tests — COMPLETE (`a14f352`)**: math-value-ordering screen
  test, persistence-failure contract, rewards/profile/wipe/export/storage-retry
  failure coverage. Five real defects found and fixed: silent rewards
  claim/claim-all failures, silent generic purchase failures, the spurious
  "No item to apply" after a successful apply, and the swallowed workout
  advance rejection (now a danger toast; hook exposes `advanceError`).
- **W2 performance/startup — COMPLETE (`2d6b5eb`)**: bounded quest evaluation
  with exact lifetime aggregates, Profile snapshot reuse, version-gated
  definition seeding, dev-only bootstrap perf marks; export canonicalization
  deferral recorded.
- **W4 tooling/CI — COMPLETE (`212469d`)**: workflow validator rules
  (44/44 self-test), fail-closed production dependency-audit gate (26/26
  self-test) with an explicitly expiring escalation for the one runtime
  advisory that has no compatible fix, 16 action pins.
- **W5 docs truth + W6 cleanup — COMPLETE (`212469d`)**: ADR/status docs
  corrected; KNOWN_ISSUES/BACKLOG reconciled; ten dead exports removed; two
  scripts deleted; provenance allowlist made precise and expiring.
- Final matrix: 540 suites / 6450 tests PASS; tsc/lint clean; all validators
  green; canaries 8/8 and daily-workout PASS at the closure tree.

## Campaign 027 workstreams (closed)

1. **W1 correctness** — vigilance stimulus lifetime, color-stroop dead
   actions, speed-color-match non-finite metric, spatial-coordinate-turn
   adaptive escalation, word-scramble dead budget.
2. **W2 performance/startup** — bounded quest evaluation + sample reuse,
   version-gated seeding/schema guards, dev-only phase marks, single-pass
   export if byte-identical.
3. **W3 reliability tests** — session save-failure contract, route failure
   paths (rewards/profile/storage-retry/workout-advance/wipe/export),
   `math-value-ordering` screen test.
4. **W4 tooling/CI** — workflow-validator rules + self-tests, dependency-audit
   gate, pinned actions.
5. **W5 docs truth** — ADR-0005/0004, MASTER_PLAN, GAME_SDK, README,
   ANDROID_AUTOMATION, constitution status line, GOAL.md, KNOWN_ISSUES.
6. **W6 cleanup** — dead exports, unreferenced scripts/stray log, provenance
   allowlist, stale TODO.

## Baseline at activation (`832971c`)

- Jest 536 suites / 6412 tests PASS (5 allowlisted skips), `tsc` clean,
  `expo lint` clean, all validators PASS, OpenSpec 13/13 PASS.
- Runtime evidence (Campaign 026 closure): canaries 8/8, daily-workout
  journey PASS, a11y audit 0 violations, release APK
  `2E89B783…D36EC4` (109,496,133 bytes).
- Evidence behind the campaign: `openspec/changes/027-deep-hardening/audit-map.md`.

## Continuation rule

There is **no active campaign**. A successor campaign requires an explicit
owner directive or a separately justified planning pass against current
repository evidence. Remaining recorded work: the deferred export
canonicalization (Low), the expiring runtime dependency escalation
(`decode-uri-component` via expo-router, tracked in KNOWN_ISSUES), the harness
cold-start navigation race, and the external/manual evidence classes
(store signing, manual TalkBack, SAF sheets, physical device, iOS runtime).

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `.agent/VALIDATION.md` and `.agent/KNOWN_ISSUES.md`
7. `openspec/changes/027-deep-hardening/` (EXECUTION → proposal → design →
   specs → tasks) and `audit-map.md`
