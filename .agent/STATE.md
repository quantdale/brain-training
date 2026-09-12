# Durable Project State

**Last update:** 2026-09-13 — Campaign 027 activated (deep hardening; owner-invoked).
**Canonical branch:** `main`
**Active campaign:** `027-deep-hardening`
**Last campaign:** `026-visual-identity-rebuild`
**Last campaign status:** VALIDATED

## Current status

Campaign 026 closed terminal with the "Neon Arcade" identity shipped and a
green matrix (536 suites / 6412 tests). A four-scout forensic audit on
2026-09-13 found no P0 defect but a stack of P1–P3 correctness, performance,
reliability, tooling and documentation debt; the owner then invoked a deep
repository-wide hardening campaign. Campaign 027 (`027-deep-hardening`) is
active with feature development frozen: repairs, fail-path tests, bounded hot
paths, version-gated bootstrap, CI/tooling hardening, documentation truth and
dead-code cleanup.

## Campaign 027 workstreams (active)

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

Execute `.agent/EXECUTION_PROMPT.md` (ACTIVE) until its completion gate is
satisfied or a genuine blocker is durably recorded. Feature development stays
frozen. Externally blocked evidence classes (store signing, manual TalkBack,
SAF sheets, physical device, iOS runtime) remain out of scope and honestly
classified.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `.agent/VALIDATION.md` and `.agent/KNOWN_ISSUES.md`
7. `openspec/changes/027-deep-hardening/` (EXECUTION → proposal → design →
   specs → tasks) and `audit-map.md`
