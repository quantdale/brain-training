# Execution Prompt — Campaign 023: Production & Gamification Overhaul

**Status:** ACTIVE
**Change:** `023-production-gamification-overhaul`
**Start-SHA:** `22bf19600dd6ecdd949c0d9615c1d8a43a5542f3`
**Planned-At:** 2026-09-11
**Target-Branch:** `main`
**Predecessor:** `022-release-candidate-certification` (VALIDATED)

## Mission

Execute the owner's goal-mode directive to raise the Campaign 022 release
candidate to App-Store-submission standard:

1. **Phase 1 — Tooling & MCP:** configure the Refero MCP server in local/user
   configuration without committing its bearer token; verify the live
   connection and enumerate tools before design work.
2. **Phase 2 — Audit & functional testing:** run the full automated suite;
   audit every registered mini-game for logic defects, edge-case crashes,
   unresponsive UI, and state desynchronization; fix every confirmed bug with a
   regression test; prove reliable reset/replay with no leaked timers,
   listeners, or stale state.
3. **Phase 3 — Gamification & UX overhaul:** use Refero research
   (Duolingo/Brilliant/Headspace: reward loops, streaks, daily progress,
   celebrations, SFX/haptics triggers, feedback pacing) to redesign game
   shells and menus around shared tokens and primitives: tactile buttons,
   feedback cards, progress meters, completion modals, unified typography,
   color, margins, and animation.
4. **Phase 4 — Production & App Store readiness:** audit assets, responsive
   layouts/safe areas across standard phone profiles, and offline fallbacks;
   run the full production build pipeline to zero errors; resolve
   asset/deprecation/strict-mode issues; classify every check honestly.

## Completion gate

All acceptance criteria in
`openspec/changes/023-production-gamification-overhaul/tasks.md` complete; the
full Jest/typecheck/lint/validator matrix green at the final SHA; every game
carrying an audit disposition; design overhaul implemented with deliberate
visual re-baseline; production artifact built and startable without Metro; and
durable state (`.agent/STATE.md`, `.agent/VALIDATION.md`, campaign packet)
recording honest PASS / NOT VALIDATED / BLOCKED classifications.

## Git requirements

Commit and push coherent progress to `origin/main` per repository policy
(typecheck + risk-based checks green before calling a push green). No
force-push. No credentials or tokens in any commit.

## Final report

Report every bug resolved, every design change made, and the final build
status, with explicit classification of anything not validated on this host.
