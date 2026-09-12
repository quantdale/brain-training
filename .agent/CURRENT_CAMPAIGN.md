# Campaign 027 — Deep Hardening

**Status:** ACTIVE
**Campaign id:** `027-deep-hardening`
**Predecessor:** `026-visual-identity-rebuild` (VALIDATED)
**Mode:** day
**Start SHA:** `832971c`
**Change:** `027-deep-hardening` (ACTIVE)
**Authorization:** owner directive 2026-09-13 — Master Autonomous Overnight
Development Campaign: deep repository-wide engineering campaign; do not stop
after the first success; verified improvement over speed. User-invoked
hardening, feature development frozen.

## Mission

Repair the audited correctness defects, bound the unbounded hot paths, close
the highest-value reliability test gaps, harden CI/tooling, truth the
documentation, and remove dead weight — with regression evidence for every
repair and honest classifications for anything blocked or deferred.

## Where the detail lives

- `openspec/changes/027-deep-hardening/EXECUTION.md` — mission, read order,
  work model, validation, exit gate.
- `audit-map.md` — the forensic evidence behind every item.
- `proposal.md`, `design.md`, `specs/**`, `tasks.md`.

## Priority summary

1. W1 correctness repairs (adaptive escalation, stimulus lifetime, dead
   actions, non-finite metric, dead provenance budget).
2. W3 reliability tests (save-failure contract, route failure paths, missing
   screen test).
3. W2 performance/startup (bounded quest evaluation, version-gated bootstrap,
   dev-only phase marks, single-pass export).
4. W4 tooling/CI (workflow validator rules, dependency-audit gate, pins).
5. W5 documentation truth; W6 cleanup.

## Do not

- Do not add features, redesign UI, add dependencies, or change persistence
  formats; game mechanics edits are limited to the audited repairs.
- Do not weaken guards/tests to make a change pass.
- Do not touch the constitution-deferred systems or external evidence classes.
- Do not force-push or rewrite history.
