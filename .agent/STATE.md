# Durable Project State

**State schema:** 1  
**Last bootstrap update:** 2026-08-16  
**Canonical branch:** `main`  
**Active campaign:** `001-autonomous-foundation`

## Current status

Repository bootstrap / pre-implementation state.

The product constitution and autonomous-development governance are locked. No application source has been implemented yet. Phase 1 is ready to execute from a fresh autonomous agent session.

## Completed

- Product decisions frozen in `docs/PROJECT_CONSTITUTION.md`.
- Master implementation phases recorded in `docs/MASTER_PLAN.md`.
- Initial product parity inventory recorded.
- Vendor-neutral root `AGENTS.md` created.
- Durable `.agent/` control plane created.
- Day/night governance defined.
- Kimi project Skills seeded.
- Architecture ADR seeds created.
- Repository-integrity validation and CI seeded.

## Next required action

Execute `.agent/CURRENT_CAMPAIGN.md` (Campaign 001 — Autonomous Foundation).

## Important invariants

- Android-first autonomous QA; iOS later compatibility campaign.
- One emulator by default.
- No host mouse/keyboard automation.
- Up to ~7 coder agents where work is safely partitioned.
- No autonomous full hardening.
- No autonomous force-push to `main`.
- GitHub `main` is canonical once remote exists.

## Recovery note

A fresh agent should not require the chat that created this repository. Read `AGENTS.md`, the constitution, governance JSON, current campaign, state, validation, and recent Git history before working.
