# Execution Prompt — Campaign 024: Frontend UX Modernization

**Status:** ACTIVE
**Change:** `024-frontend-ux-modernization`
**Start-SHA:** `0402279`
**Planned-At:** 2026-09-11
**Target-Branch:** `main`
**Predecessor:** `023-production-gamification-overhaul` (VALIDATED)

## Objective

Rebuild the app's visual and interaction layer to the standard of the
owner-named reference class (Duolingo, Brilliant.org, Elevate) using
Refero-MCP research, while preserving every locked product decision and all
gameplay/scoring/persistence semantics.

Deliverables: design-language v2 tokens, a real UI kit, modernized hierarchy on
every surface, universal micro-interaction feedback, genuinely consumed
responsive breakpoints (tablet/landscape), WCAG-AA accessibility closure, and
native before/after screenshot evidence captured on a GPU-enabled AVD.

## Read before acting

`.agent/GOVERNANCE.json`, `.agent/STATE.md`, `.agent/CURRENT_CAMPAIGN.md`,
`.agent/task-ownership.json`, then the OpenSpec change at
`openspec/changes/024-frontend-ux-modernization/` (EXECUTION.md → proposal.md →
design.md → specs/** → tasks.md → audit-map.md → research/**).

## Work model

Orchestrator owns the shared layers (`theme/**`, `platform/**`,
`components/ui/**` core, `components/shell/**`, `components/game-host/**`,
`components/game-ui/**`, app chrome, scripts, docs, governance). Swarm packets
own disjoint screen surfaces listed in `.agent/task-ownership.json` and report
shared-file needs to the orchestrator for a single convergence edit.

## Honest-status policy

Never convert unavailable evidence into PASS. Checks that cannot run on this
host (manual TalkBack, physical device, store signing, iOS runtime) stay
NOT VALIDATED / EXTERNALLY BLOCKED with the reason recorded.
