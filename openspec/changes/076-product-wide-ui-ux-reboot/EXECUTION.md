# Change 076 — Product-Wide UI/UX Reboot (Execution Entrypoint)

**Status:** ACTIVE — `CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED` (former terminal verdict withdrawn)
**Change:** `076-product-wide-ui-ux-reboot`
**Start SHA:** `b6654fb` (proposal head)
**Baseline SHA:** `d3d0b9926a44c039d7fd0d29e1376586afaa897b` (release APK
`d631ab9a410f9950f3c5cd989fe23b26d00178ecf98bafc439e86e85f20950a9` installed on
`braintraining-ui35` / `emulator-5554`, verified launching 2026-10-04)
**Target branch:** `main`
**Predecessor:** Phase 10 terminal certification (all 46 audit findings
dispositioned, 0 open; `docs/redesign/evidence/phase10-terminal-certification/`)

## Authority

Owner goal directive: perform openspec apply on
`openspec/changes/076-product-wide-ui-ux-reboot/` — implement the staged
tasks in `tasks.md` (baseline evidence → three prototype directions →
reference lock → shared compositional contract → route redesigns → 42 game
modules → convergence, device certification and release) until every task is
complete or an honestly BLOCKED condition is durably recorded. Do not narrow
the specified behavior; surface added scope explicitly.

## Scope

The complete player journey: Home/workout entry-resume-completion; Games
search/filters/empty/favorites; game detail/tutorial; all 42 games' active
play, feedback, pause/quit, timeout, result and error/recovery states;
Progress/insights; Rewards; Profile/settings; storage/data and results
routes. Three genuinely different Refero-informed prototype directions are
built, inspected on device and scored before one reference lock is chosen.
Visual quality is a device gate: matched before/after captures, route/state
and 42-game coverage manifest, light/dark and large-text/small-device checks,
ARTEMIS-led Android journeys, and a final visibly transformed release APK.

## Guardrails

- Visual-only change: no scoring rule, generator, schema, migration,
  workout-ownership, economy-ledger, backup-format, routing-envelope or
  offline-behavior change. Any consequential architecture change requires an
  ADR and constitution review.
- Old-release captures for every affected route/game state precede the edit
  of that presentation (`evidence/before/` + per-wave manifests); after
  captures are matched on the same device/profile/theme configuration.
- One orchestrator-owned emulator (`emulator-5554` / `braintraining-ui35`);
  ARTEMIS doctor verified READY; automation is emulator-local only (no host
  mouse/keyboard/focus).
- Shared hotspots (`theme/tokens.ts`, `components/ui/*`, `components/game-ui/*`,
  `components/game-host/*`, app-tabs/screen-shell) have one writer — the
  orchestrator or a single integrator packet; coder packets own disjoint
  route/game directories (`.agent/task-ownership.json`).
- Dangerous QA controls stay dev-only (`assertDevOnly`/`isDevBuild`); semantic
  test IDs are preserved; no silent behavior migration; no force-push.

## Waves

1. Baseline inventory + old-build captures (tasks 1.1–1.12)
2. Three prototype directions, scorecard, reference lock (2.1–2.5)
3. Shared compositional contract + Memory/Equation-Builder canary journey (3.1–3.5)
4. Core navigation/discovery/workout + supporting routes (4.1–5.5)
5. Eight game-domain packets (6.1–13.5), 7 coders max, per-wave device verification
6. Convergence, 42/42 device certification, ARTEMIS journeys, release APK,
   iOS status, final coverage manifest + visual decision report, durable
   state and push (14.1–14.8)

## Current checkpoint — 2026-10-08

Read `evidence/CLOSURE_CHECKPOINT.md` first. Source `c324960` four workflows
GREEN, APK `de6c5fcd…` installed/SHA checked, 90 route pairs + 2 Results-scroll
pairs personally reviewed/filed, six audits 0 violations / 32 occluded
unmeasurable; 2× badge clipping repaired. Current Pro HTTP 401 Invalid
credential, no plan/steps: **BLOCKED_EXTERNAL_ARTEMIS_PROVIDER**. Owner must
restore configured credentials externally; no retry/fallback until then.
All 22 current-build gap states and remaining game/control/reduced-motion/
Pro/clean-checkout/terminal acceptance still owed. iOS BUILD PASS / RUNTIME
NOT VALIDATED. No acceptance checkbox moved. Below is historical review.

## Historical review correction — remaining gate scope still applies

The 2026-10-06 VALIDATED declaration was premature and is superseded.
Per-frame visual audit yields **39/42 A, 27/42 F, 38/42 P, 42/42 R**;
22 of 168 core state frames are NOT VALIDATED (`evidence/GAME_ASSESSMENT.md`).
A verified 90/90 route/theme/profile matrix exists only for APK
`00024954…`; the later final-board-still APK `c3b3e4d9…` has 8/8
focused detail stills, while its full-matrix attempt aborted amid system
ANRs. ARTEMIS Flash smoke passed, but all nine Pro attempts were
provider-BLOCKED: direct ADB does not satisfy controller-led acceptance.
iOS is NOT VALIDATED. Task 14.4 and other unchecked tasks remain open; do not
promote the change to VALIDATED on source/test passes or historical screenshots.
Historical wave results are recorded in `evidence/WAVE14_EVIDENCE.md` but
are not proof of these outstanding final-build gates.
