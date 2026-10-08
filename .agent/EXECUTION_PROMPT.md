# Execution Prompt — Campaign 076: Product-Wide UI/UX Reboot

> **ACTIVE CLOSURE BINDING (2026-10-08):** the active closure binding is now
> **`openspec/changes/076-f-final-product-certification`**. This prompt remains
> the ORIGINAL active 076 redesign prompt and is deliberately left as
> historical context — it is NOT evidence of certification, and its GitHub
> Actions runs are NOT certification evidence. Do not execute the redesign wave
> plan below as if it were the current closure work. Read the 076-f
> `evidence/VERDICT.md` for the current status.

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

## Current checkpoint — 2026-10-08 (superseded by 076-f; see banner above)

See change `evidence/CLOSURE_CHECKPOINT.md`: source `c324960` four workflows
GREEN; new APK `de6c5fcd…`, reviewed/filed 90 route pairs + 2 scrolled Results
pairs and 0 automated violations (32 occluded unmeasurable). Current Pro
HTTP 401 Invalid credential, no steps: **BLOCKED_EXTERNAL_ARTEMIS_PROVIDER**.
Owner must restore configured credentials only externally; no retry/fallback.
All 22 current-build gap states and remaining acceptance still owed; no
checkbox moved. iOS BUILD PASS / RUNTIME NOT VALIDATED.

*2026-10-08 correction (076-f task 1.1): the HTTP 401 above is historical.
Re-probed under 076-f the credential is valid; the failure class is provider
**quota exhaustion** on the free tier. See
`openspec/changes/076-f-final-product-certification/evidence/CONTROLLER.md`.
The four workflows at evidence SHA `7e7374b` are green (37719414181 /
37719414125 / 37719414141 / 37719414138), so that SHA no longer lacks remote
verification. Neither correction is release acceptance.*

## Historical review checkpoint / outstanding acceptance scope

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
