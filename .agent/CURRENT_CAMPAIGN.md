# Campaign 076: Product-Wide UI/UX Reboot (REOPENED — release acceptance blocked)

> **ACTIVE CLOSURE BINDING (2026-10-08):** closure of Campaign 076 is now bound
> to **`openspec/changes/076-f-final-product-certification`** — a *separate
> certification change* that does not replace this campaign's acceptance ledger.
> This campaign's `tasks.md` remains the product-acceptance ledger; 076-f
> authorises checking a parent box only when that task's own linked evidence
> exists. Read 076-f `evidence/VERDICT.md` for the current status.

**Status:** ACTIVE — `CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED`
**Campaign id:** `076-product-wide-ui-ux-reboot`
**Predecessor:** Phase 10 terminal certification (post-075 convergence; all 46 audit findings dispositioned, 0 open)
**Mode:** day
**Start SHA:** `b6654fb` (proposal head). Explore/release baseline captured at source `d3d0b9926a44c039d7fd0d29e1376586afaa897b`, release APK SHA-256 `d631ab9a410f9950f3c5cd989fe23b26d00178ecf98bafc439e86e85f20950a9` on `braintraining-ui35` / `emulator-5554`.
**Change:** `openspec/changes/076-product-wide-ui-ux-reboot` (ACTIVE)
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

## Current checkpoint — 2026-10-08 (superseded by 076-f; see banner above)

Source `c324960` fixes the captured 2× badge clipping and stale HUD CI assertion;
all four source-SHA workflows GREEN. New APK `de6c5fcd…` installed/hash checked;
90/90 route pairs reviewed/filed and six audits PASS (32 occluded unmeasurable),
2 Results-scroll pairs prove reachability. Local full 621 suites/7,237 tests,
typecheck/lint/declared gates/web export PASS. Current Flash runtime failed;
one bounded Pro attempt failed **401 Invalid credential**, no plan/steps:
**BLOCKED_EXTERNAL_ARTEMIS_PROVIDER**. Owner external credential action needed;
no more retry or alternate controller. All 22 current-build gap states, game/
control/reduced-motion/Pro acceptance, full clean-checkout and terminal ledger
still owed. iOS BUILD PASS / RUNTIME NOT VALIDATED. No acceptance checkbox
moved. See `evidence/CLOSURE_CHECKPOINT.md` for exact hashes and evidence.

*2026-10-08 correction (076-f task 1.1). Two statements above are stale and are
superseded — this campaign's checkpoint text is kept as history, not rewritten.*

1. *"401 Invalid credential … BLOCKED_EXTERNAL_ARTEMIS_PROVIDER"* is historical.
   Re-probed under 076-f the credential is **valid**; the failure class is
   provider **quota exhaustion** on the free tier (HTTP 429
   `RESOURCE_EXHAUSTED`). The controller executes real work once routed to a
   model with quota — Flash and Pro smokes both PASS.
2. *"all four source-SHA workflows GREEN"* is true for `c324960`, and the
   evidence SHA `7e7374b` has since earned **its own** four green runs
   (App CI 37719414181, Repository Integrity 37719414125, Android Build Smoke
   37719414141, iOS Build Smoke 37719414138), so that SHA no longer lacks remote
   verification.

*Neither correction is release acceptance. See
`openspec/changes/076-f-final-product-certification/evidence/CONTROLLER.md`.*

## Historical review correction (former terminal claim remains withdrawn)

The former `VALIDATED` verdict was withdrawn after inspecting the actual
per-game images and APK bindings. The historical game index now retains
**172** hashed images, but only **39/42 active**, **27/42 feedback**,
**38/42 pause** and **42/42 result** frames depict their claimed states.
Twenty-two state frames remain NOT VALIDATED (see `evidence/GAME_ASSESSMENT.md`).
The verified 90/90 route matrix is tied to APK `00024954…`, not final
`c3b3e4d9…`. An attempted final-build matrix aborted amid Android
launcher/SystemUI ANRs; it is not filed evidence. Eight final-build detail
stills passed, not the full route matrix. ARTEMIS Flash smoke passed, but
nine Pro attempts were provider-BLOCKED and ADB fallback is not Pro
acceptance. iOS remains NOT VALIDATED. Touch-target source/tests use 48dp
Android and 44pt iOS; final per-game device measurement remains open.
**Do not mark 076 validated until these gaps are closed.** The AVD stopped
after those ANRs, then recovered on 2026-10-07 with one userdata wipe and
cold boot. New contrast fixes require another final APK and full capture
gates; no new acceptance is implied. See `evidence/RESUMPTION.md`.

## Former terminal result (2026-10-06; superseded, not acceptance evidence)

`CHANGE_076_PRODUCT_WIDE_UI_UX_REBOOT_VALIDATED` — all 82 tasks executed:
baseline (272 old-build captures), three-prototype selection gate (Training
Studio, REFERENCE_LOCK), shared compositional contract (tokens/stage panel/
staged results), route redesigns (all 17 routes), 42/42 games canary-
disciplined and individually played/captured on the converged release build
(`14cb165b…`), canonical matrices 66/66 PASS, a11y audits clean, ARTEMIS
Flash smoke PASS (Pro lane provider-BLOCKED with the deterministic ADB
fallback executed), repo gates + validators + full jest (616 suites / 7,210
tests) green, iOS honestly NOT VALIDATED, no abandoned worktrees. Terminal
evidence: `openspec/changes/076-product-wide-ui-ux-reboot/evidence/`
(WAVE14_EVIDENCE.md + per-wave records).

## Progress log

- Closure recovery: reconciled `eff5de0` source and `6e31d41e` intermediate APK;
  actual new gap acquisition is 21/22 (Tap Rush feedback missing). Matrix has
  90 acquired pairs but captured 2× Progress-detail badge clipping; minimal
  wrap repair + regression guard applied. Stale fractional-HUD test caused
  `c3c75b9` App CI failure; assertion corrected. Full local 621 suites/7,237
  tests + typecheck/lint/declared validators PASS. Rebuild, new-identity
  captures, visual acceptance and current controller/remote gates owed;
  no acceptance tasks moved. See `evidence/CLOSURE_CHECKPOINT.md`.

- 2026-10-07 resumption: all four workflows PASS for security SHA `142e3c0`;
  dedicated AVD recovered, ARTEMIS helper/doctor ready. Six HUD-secondary
  ink defects corrected in five games, light/dark render/catalog guard added;
  source `cda4401` passed four remote workflows and built/installed. Three
  actual active states reviewed; passive red score/cue leakage found and
  repaired (44 color selections + Countdown). Fresh full Jest 618 suites/
  7,232 tests, typecheck/lint, repo gates, web export, OpenSpec 60/60 PASS.
  Final rebuilt capture matrix and ARTEMIS retries owed; no checkboxes moved.
- 2026-10-05: **waves 0-3 complete (22/82 tasks)**. Wave 1: route/state
  inventory manifest; ARTEMIS doctor READY (evidence task-1-2-artemis.md);
  old-build device baseline COMPLETE — 42/42 games (tutorial/active/pause/
  feedback/result) + route/interaction/recovery captures (272 images, hashed)
  against APK `d631ab9a…`. Wave 2: three dev-only prototype systems built,
  captured (66 images light/dark/fs2) and scored on device — **Training Studio
  selected**, REFERENCE_LOCK.md published (borrowings: board-still identity
  tiles + numbered fact rows; rejected traits recorded). Wave 3: tokens
  re-authored to the lock (contrast + lock tests green; design-system doc
  synced; snapshots regenerated), Card `stage` variant, session stage panel +
  stage-presented instrument strip + staged result artifact, canary boards
  device-verified (Memory domain-hue flash; Equation Builder neutral tokens +
  timeout state), full workout journey completed on the new build with SQLite
  audit PASS (integrity ok, schema v13, 0 FK violations, 51/51 exactly-once
  ledger, 0 duplicate ratings, 0 FATAL/ANR). Builds: wave-3 release APK
  `9e61db2e…`. Next: wave 4 (route redesigns 4.1-4.5), wave 5 (5.1-5.5),
  game-domain packets 6-13, convergence/certification 14.
- 2026-10-04: campaign registered (GOVERNANCE/STATE/EXECUTION_PROMPT/
  task-ownership); baseline typecheck clean; ARTEMIS doctor READY on
  `emulator-5554`; old build `d631ab9a…` confirmed installed and launching.

## Terminal records preserved

Campaign 055 (`CAMPAIGN_055_DESIRABILITY_PASS_COMPLETE`, VALIDATED) and the
056–067 overnight program (COMPLETE) remain recorded in `.agent/STATE.md`,
`.agent/OVERNIGHT_056_067_STATE.md` and git history; their full prompt
documents remain in `.agent/`.
