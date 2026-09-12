# Execution Prompt — Campaign 027: Deep Hardening

**Status:** VALIDATED
**Change:** `027-deep-hardening`
**Planned-From:** `832971c`
**Start-SHA:** `63e6326`
**Closure-SHA:** `212469d`
**Planned-At:** 2026-09-13
**Closed-At:** 2026-09-13
**Target-Branch:** `main`
**Predecessor:** `026-visual-identity-rebuild` (VALIDATED)

## Archived execution prompt — DO NOT RESTART

All acceptance criteria are satisfied and recorded in the repository's
canonical validation/state record:

- Completion evidence: `.agent/VALIDATION.md` → "Campaign 027 — Deep Hardening
  evidence (2026-09-13)".
- Durable state: `.agent/STATE.md` (terminal) and `.agent/CURRENT_CAMPAIGN.md`
  (VALIDATED / TERMINAL).
- Packet: `openspec/changes/027-deep-hardening/` (change.json status
  `VALIDATED`; every task checked in `tasks.md`, with task 2.5 explicitly
  deferred and recorded).

Acceptance summary:

- All in-scope workstreams completed: correctness repairs (`ed07f27`),
  reliability tests + five surfaced fixes (`a14f352`), performance/startup
  (`2d6b5eb`), tooling/CI + docs truth + cleanup (`212469d`).
- Full Jest matrix (540 suites / 6450 tests), `tsc`, `expo lint` and all
  validators green at the closure tree; no introduced Critical/High
  regression.
- Runtime at the closure head: canaries 8/8 (after pre-warming lazy chunks;
  the interim cold-start races are recorded honestly) and daily-workout
  journey PASS (4/4 + persisted completion).
- Documentation and durable state describe reality; the one runtime
  dependency advisory with no compatible fix is escalated as explicitly
  expiring tracked debt rather than silently waived.
