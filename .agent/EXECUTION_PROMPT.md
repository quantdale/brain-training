# Execution Prompt — Campaign 076: Product-Wide UI/UX Reboot

**Status:** ACTIVE — `CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED` (former VALIDATED verdict withdrawn after evidence review)
**Change:** `076-product-wide-ui-ux-reboot` (ACTIVE)
**Start-SHA:** `b6654fb` (proposal head; Explore baseline `d3d0b99`)
**Target-Branch:** `main`
**Predecessor:** Phase 10 terminal certification (`f813e6a` / `b6654fb` docs)

## Authority

Owner goal directive (goal_id `d0710eff-2340-4933-96b2-7e9304558107`):
perform openspec apply on `openspec/changes/076-product-wide-ui-ux-reboot/` —
implement its staged tasks (baseline evidence → three prototype directions →
reference lock → shared compositional contract → route redesigns → 42 game
modules → convergence and device certification) until every task is complete
or an honestly BLOCKED condition is durably recorded.

## Guardrails

- Old-release device baseline (`d631ab9a…`, source `d3d0b992…`) must be
  captured for every affected route/game state **before** editing it; the
  post-change screenshots must be matched captures on the same configuration.
- Never alter scoring, persistence, workout ownership, economy, offline
  behavior, or registry semantics from visual-only edits.
- One orchestrator-owned emulator; ARTEMIS doctor verified READY (evidence in
  openspec/changes/076-product-wide-ui-ux-reboot/evidence/task-1-2-artemis.md).
- Shared hotspots (theme tokens, ui primitives, game-host/game-ui contracts)
  have one writer; swarm packets own disjoint route/game directories only.
- Task-ownership: `.agent/task-ownership.json` binds parallel packets per
  wave; coders never edit orchestrator-only surfaces.

## Current checkpoint / outstanding acceptance

After review, 22/168 individual core game-state frames have no valid visual
proof; the final-build 90-route capture matrix aborted amid launcher/SystemUI
ANRs; ARTEMIS Pro journeys remain provider-BLOCKED after nine attempts;
iOS remains NOT VALIDATED. Reconcile these without substituting ADB for Pro or
old-build captures for the final APK. See `evidence/GAME_ASSESSMENT.md`,
`evidence/WAVE14_EVIDENCE.md` and `.agent/KNOWN_ISSUES.md`.

## Waves

1. Baseline inventory + old-build captures (tasks 1.x)
2. Three prototype directions + scorecard + reference lock (tasks 2.x)
3. Shared compositional contract + canary journey (tasks 3.x)
4. Route redesigns: navigation/discovery/workout + supporting routes (tasks 4–5)
5. Game domain packets ×8 (tasks 6–13), 7 coders max, device verification per wave
6. Convergence + device certification + release + durable state (tasks 14.x)
