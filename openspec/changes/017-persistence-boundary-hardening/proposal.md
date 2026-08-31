# Proposal — Campaign 017 Persistence Boundary Hardening

## Decision

Use the first owner-authorized successor campaign to harden the local
authoritative data boundary. The product remains offline-first and SQLite
remains canonical. This campaign does not add games, cloud services, accounts,
or new player-facing systems.

## Scope

The campaign covers the failure modes found by the whole-codebase audit:

- SQLite INTEGER storage and numeric-domain validation;
- rating/session identity and duplicate replay protection;
- backup validation, profile scoping, merge identity, and replace rollback;
- deterministic conflict resolution and cursor preservation;
- explicit as-of reads so future-dated imported rows cannot grant progression;
- regression tests over real migrated databases and the data-portability path.

## Completion definition

017 is complete when the persistence and portability invariants are enforced at
both API and schema boundaries, malformed/future/duplicate data has adversarial
coverage, the focused and full test signals pass, and the durable campaign
state records any unavailable platform checks honestly. All deferred cloud,
auth, monetization, signing, and store decisions remain untouched.
