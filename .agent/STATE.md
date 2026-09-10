# Durable Project State

**Last update:** 2026-09-11 — Campaign 023 activated under explicit owner goal-mode directive (production/App-Store readiness + gamification overhaul); Refero MCP configured and live-verified.
**Canonical branch:** `main`
**Active campaign:** 023-production-gamification-overhaul
**Last campaign:** `022-release-candidate-certification`
**Last campaign status:** VALIDATED

## Current status

Campaign 023 — Production & Gamification Overhaul is **ACTIVE**. It executes
the owner directive to take the Campaign 022 release candidate to
store-submission standard: configure/verify the Refero design-reference MCP
without committing its credential; run and repair the full functional test
surface across every registered mini-game; apply a unified gamified UX
overhaul grounded in Refero references from Duolingo/Brilliant/Headspace; and
produce a zero-error production build with honest safe-area/offline/runtime
evidence classification.

Authoritative packet: `openspec/changes/023-production-gamification-overhaul/`
(`EXECUTION.md`, `proposal.md`, `design.md`, `specs/`, `tasks.md`,
`audit-map.md`).

## Campaign 022 terminal outcome (preserved)

Campaign 022 is VALIDATED/terminal with release verdict **CONDITIONAL GO**: no
repository-owned release blocker remains; production/store signing, manual
TalkBack, SAF/system-sheet flows, physical-device behavior, and manual iOS
runtime remain external/manual gaps and must not be reported as PASS until
actually performed. Exact evidence remains in `.agent/VALIDATION.md` and
`openspec/changes/022-release-candidate-certification/`.

## Phase status

- Phase 1 (MCP): Refero configured in gitignored `.kimi-code/local.toml` and
  user opencode config; live `initialize`/`tools/list` PASS
  (`refero_server 0.2.0`).
- Phases 2–4: in progress (see campaign `tasks.md`).

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `.agent/VALIDATION.md` and `.agent/KNOWN_ISSUES.md`
7. `openspec/changes/023-production-gamification-overhaul/`
