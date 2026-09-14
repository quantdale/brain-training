# Campaign 028 — Production-Readiness Closure

**Status:** VALIDATED (closed — terminal; not active)
**Campaign id:** `028-production-readiness`
**Predecessor:** `027-deep-hardening` (VALIDATED)
**Mode:** day
**Start SHA:** `1733458`
**Change:** `028-production-readiness` (CLOSED — historical record only)
**Authorization:** owner successor directive 2026-09-13 — autonomous
determination and execution of successor campaigns, quality-improvement passes
and production-hardening tasks until no material executable work remains.

## Mission

Close the residual release-confidence gaps surfaced by four fresh read-only
audits on the 027 closure tree — remaining silent user-action failures,
data-portability robustness and the obsolete export deferral, QA-harness
navigation reliability and artifact retention, validator/CI gate integrity,
documentation truth and dead weight — then re-validate the full stack,
including runtime canaries, on the closure head.

## Where the detail lives

- `openspec/changes/028-production-readiness/EXECUTION.md` — mission, read
  order, work model, validation, exit gate.
- `audit-map.md` — file/line evidence behind every item.
- `proposal.md`, `design.md`, `specs/**`, `tasks.md`.

## Priority summary

1. W1 user-action reliability (Home CTA, rewards, profile claims + tests).
2. W2 data-portability robustness (single-pass export, FK cross-validation,
   pick size guard, re-entrancy/collision).
3. W3 QA harness reliability (verified deep link, pause symmetry, scheduled
   pre-warm, bounded retention, self-tests).
4. W4 validator/CI hardening (dep-audit expiry, offline heuristic, IMPACT_MAP
   sync, repo-state fail-open, jest-skip staleness, certify parity, schedule).
5. W5 cleanup + docs truth; W6 full verification; W7 closure.

## Do not

- Do not add features, redesign UI, add dependencies, or change persistence
  formats.
- Do not implement constitution-deferred systems (cloud/auth/AI/monetization/
  notifications) or password-encrypted backups (recorded as deferred).
- Do not weaken guards/tests to make a change pass; disclose retries.
- Do not touch `emulator-5554` (user-owned) or hijack host input.
- Do not force-push or rewrite history.
