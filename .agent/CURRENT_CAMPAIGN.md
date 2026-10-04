# ACTIVE — Campaign 076: Product-Wide UI/UX Reboot

**Status:** ACTIVE
**Campaign id:** `076-product-wide-ui-ux-reboot`
**Predecessor:** Phase 10 terminal certification (post-075 convergence; all 46 audit findings dispositioned, 0 open)
**Mode:** day
**Start SHA:** `b6654fb` (proposal head). Explore/release baseline captured at source `d3d0b9926a44c039d7fd0d29e1376586afaa897b`, release APK SHA-256 `d631ab9a410f9950f3c5cd989fe23b26d00178ecf98bafc439e86e85f20950a9` on `braintraining-ui35` / `emulator-5554`.
**Change:** `openspec/changes/076-product-wide-ui-ux-reboot` (ACTIVE — openspec apply in progress)
**Authorization:** owner goal directive — perform openspec apply on `openspec/changes/076-product-wide-ui-ux-reboot/` until every task in its `tasks.md` is complete or an honestly BLOCKED condition is durably recorded. Execution prompt: `.agent/EXECUTION_PROMPT.md`.

## Mission

Replace the oversized, repeated-panel product experience with one coherent,
playable compositional system across every player-facing destination and all
42 game modules, selected through three genuinely different on-device
prototypes (Refero-informed, adapt-not-clone), certified with matched
before/after device captures, accessibility/theme/size matrices and ARTEMIS
runtime journeys. Visual-only change: scoring, persistence, workout
ownership, economy, offline behavior and registry semantics are protected
contracts.

## Wave plan (mirrors tasks.md)

1. **Baseline** — route/state coverage manifest (1.1); AVD+ARTEMIS verify (1.2);
   old-build route captures (1.3); per-domain old-build game-state captures
   (1.4–1.12) before any module edit.
2. **Directions** — three dev-only prototype journeys (Pocket Console /
   Training Studio / Puzzle Index), on-device inspection, weighted scorecard,
   reference lock (2.1–2.5).
3. **Shared contract + canary** — semantic type/color/surface/motion tokens,
   page shell + primitives, in-game chrome, Memory + Equation Builder canary
   boards, old-vs-new journey validation (3.1–3.5).
4. **Routes** — Home/workout (4.1–4.2), Games/discovery (4.3–4.4), standalone
   Results (4.5), Progress (5.1), Rewards (5.2), Profile/settings (5.3),
   data/recovery (5.4), remaining routes (5.5).
5. **Game domains** — eight isolated domain packets (6–13), 7 coders max;
   per-domain device verification; shared hotspots edited only by the
   orchestrator.
6. **Convergence/certification** — 42/42 device board review, theme/size
   matrices, ARTEMIS journeys, impact-map gates, release APK, iOS status,
   final coverage manifest + visual decision report, durable state, push (14.x).

## Progress log

- 2026-10-04: campaign registered (GOVERNANCE/STATE/EXECUTION_PROMPT/
  task-ownership); baseline typecheck clean; jest baseline 612 passed suites +
  2 governance suites failing only on the mid-registration campaign fields
  (expected; re-run after registration completes); ARTEMIS doctor READY on
  `emulator-5554`; old build `d631ab9a…` confirmed installed and launching.

## Terminal records preserved

Campaign 055 (`CAMPAIGN_055_DESIRABILITY_PASS_COMPLETE`, VALIDATED) and the
056–067 overnight program (COMPLETE) remain recorded in `.agent/STATE.md`,
`.agent/OVERNIGHT_056_067_STATE.md` and git history; their full prompt
documents remain in `.agent/`.
