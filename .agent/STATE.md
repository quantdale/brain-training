# Durable Project State

**Last update:** 2026-09-13 — Campaign 028 activated (production-readiness closure; owner successor directive).
**Canonical branch:** `main`
**Active campaign:** `028-production-readiness`
**Last campaign:** `027-deep-hardening`
**Last campaign status:** VALIDATED

## Current status

Campaign 027 closed VALIDATED at `212469d`. Four fresh read-only audits on
`1733458` (app-surface production scan, data portability, autobot harness,
validators/CI) found no Critical/High product defect but a bounded set of
release-confidence gaps: residual silent user-action failures, obsolete export
deferral plus import-validation and file-pick robustness gaps, unverified
autobot deep links (the recorded 4/8 and 6/8 canary runs) with unbounded
artifact growth, validator gates that do not enforce their own written policy
(dependency-audit expiry, IMPACT_MAP drift, repo-state fail-open, offline
heuristic), and residual documentation/cleanup debt. Campaign 028
(`028-production-readiness`) is active to close exactly those items, with no
new features and constitution-deferred systems untouched.

## Campaign 028 workstreams (active)

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

## Continuation rule

Execute `.agent/EXECUTION_PROMPT.md` (ACTIVE) and
`openspec/changes/028-production-readiness/` until the exit gate is satisfied
or a genuine blocker is durably recorded. No new features; no
constitution-deferred systems. Externally blocked evidence classes (store
signing, manual TalkBack, SAF sheets, physical device, iOS runtime) remain
out of scope and honestly classified.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `.agent/VALIDATION.md` and `.agent/KNOWN_ISSUES.md`
7. `openspec/changes/028-production-readiness/` (EXECUTION → proposal →
   design → specs → tasks) and `audit-map.md`
