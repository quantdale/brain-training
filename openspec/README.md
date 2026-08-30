# OpenSpec Workflow

This directory is the repository's spec-driven development surface.

## Authority

For an active change, authority is:

1. `docs/PROJECT_CONSTITUTION.md` — locked product and autonomy constraints.
2. `openspec/changes/<change-id>/proposal.md` — why the change exists and what is in/out.
3. `openspec/changes/<change-id>/design.md` — architectural decisions and invariants.
4. `openspec/changes/<change-id>/specs/**/spec.md` — normative behavioral requirements.
5. `openspec/changes/<change-id>/tasks.md` — ordered implementation and validation checklist.
6. `.agent/CURRENT_CAMPAIGN.md` / `.agent/STATE.md` — execution state and recovery pointer.
7. `.agent/specs/**` — audit working papers/supporting evidence only when an OpenSpec change exists.

If two documents conflict, stop the conflicting work and reconcile the higher-authority document first. Do not silently choose whichever is easier.

## Change lifecycle

`PROPOSED -> ACTIVE -> IMPLEMENTED -> VALIDATED -> ARCHIVED`

An ACTIVE change is executable. An IMPLEMENTED change is not complete until its
required validation passes. A change may be ARCHIVED only after durable
evidence is recorded and a successor campaign advances. If a validated change
has no authorized successor, it remains `VALIDATED` and the repository records
`GOVERNANCE.activeCampaign: null` plus the last validated campaign; this is the
explicit terminal state and does not imply unfinished executable work.

## Agent rule

A fresh agent should not need a giant prompt. It should sync canonical `main`, read `.agent/CURRENT_CAMPAIGN.md`, then follow the active OpenSpec change's `EXECUTION.md`, `proposal.md`, `design.md`, `specs/`, and `tasks.md`.

## Validation rule

Requirements use RFC-style terms:

- **MUST / MUST NOT** — blocking requirement.
- **SHOULD / SHOULD NOT** — expected unless a documented reason exists.
- **MAY** — optional.

A requirement is not satisfied by unit-test count alone. Its scenarios and the change's exit gate define the evidence required.
