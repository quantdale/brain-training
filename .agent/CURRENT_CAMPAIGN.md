# Campaign 076: Product-Wide UI/UX Reboot (REOPENED — release acceptance blocked)

> **ACTIVE CLOSURE BINDING (2026-10-08):** closure of Campaign 076 is now bound
> to **`openspec/changes/076-f-final-product-certification`** — a *separate
> certification change* that does not replace this campaign's acceptance ledger.
> This campaign's `tasks.md` remains the product-acceptance ledger; 076-f
> authorises checking a parent box only when that task's own linked evidence
> exists. Read 076-f `evidence/VERDICT.md` for the current status.
>
> **ACTIVE EXECUTION (2026-10-09):** execute
> `.agent/CAMPAIGN076F_EVIDENCE_RECONCILIATION_AND_TERMINAL_CLOSURE_PROMPT.md`.
> That prompt is the execution authority; this file and the checkpoints below it
> are history until the prompt's exit gate lands. Do **not** execute the
> historical 076 redesign waves listed in the wave plan below.
>
> **2026-10-12 — status corrected and the blocking device gate is CLOSED.** The
> `BLOCKED_HOST_ANDROID_EMULATOR` state that follows is **historical**. The host was
> never rebooted and PID 50120 is still unreapable, but the WHPX partition was in
> fact free: the blocker was a port-5554 collision, not a hypervisor lock. The
> dedicated AVD `braintraining-ui35` was relaunched headless on a fresh port as
> `emulator-5570` (`sys.boot_completed=1`), and the whole device lane ran there.
> Recovery detail: `openspec/changes/076-f-final-product-certification/evidence/DEVICE_RECOVERY.md`.
>
> Measured on the terminal APK `e243341f4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f`:
>
> - **42/42 games PASS** — every registered game has a complete identity-verified
>   current-device row with a quoted scored verdict.
> - **9/9 controller journeys PASS.**
> - **Game-control accessibility 0 violations** over 126 surfaces / 756 controls
>   across three profiles; 80 occluded nodes excluded from the pass count.
> - **Full Jest 622 suites / 7,241 tests / 5 snapshots**; typecheck and lint clean.
> - **Clean-checkout composite 20/20** from a disposable clone, clone removed.
> - **Terminal APK installed and device-hashed** — the pulled `base.apk` hashes to
>   the identical SHA-256 as the host build.
>
> Ledger: 076-f **38 checked / 4 unchecked**; parent 076 **65 checked / 17
> unchecked**. The four open 076-f tasks are **4.1** (the reproduced D3 contrast
> defect — deliberately unrepaired because the fix rebuilds shared chrome and would
> invalidate every device row captured), **6.2** (its condition is false:
> authentication succeeded), and **8.4/8.5** (ending-SHA CI and the final verdict).
> Parent 14.3 and 14.7 remain open for the matched before/after image gap, named
> individually rather than collapsed.
>
> The decisive cause of the conversion was owner-directed: the controller moved to
> **DeepSeek V4.1 Flash at high thinking effort**, on which re-running the same 37
> previously-failed games converted every one.
>
> **2026-10-12 (later) — D3 REPAIRED and re-verified; the terminal identity moved.**
> The owner directed a minimal-delta closure instead of a full re-run, so the
> previously-open 076-f task **4.1** was repaired rather than left open:
>
> - **Fix:** `apps/mobile/src/components/ui/button.tsx` dropped the whole-control
>   `inactive: { opacity: 0.5 }` collapse. `resolveDisabled(variant, theme)` now
>   maps a disabled button to fill `theme.backgroundElement` (transparent for the
>   ghost variant) and label `textSecondary`, keeps `borderColor: theme.border`,
>   and drops the filled variant's 4dp lip. `inactive = disabled` and
>   `busy = loading` are now separate states.
> - **Proof of the defect is covered by fail-before/pass-after regression tests**
>   (`src/components/ui/__tests__/button-disabled-state.test.tsx`, 7 tests):
>   3 of them FAIL against the pre-fix file from `b293a02` and all 7 PASS after
>   the fix. They carry their own WCAG luminance/contrast implementation.
> - **Impact:** 61 direct `Button` call sites plus 286 `GameButton` sites across
>   all 42 domains, all through one shared component; the repair repaints no
>   enabled control's pixel and touches no behaviour.
>   `evidence/d3-impact.json` classifies the 42 rows: **40 unaffected, 2 affected**
>   (`language-word-scramble`, `logic-code-cracker`).
> - **New terminal APK `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6`**
>   (48,888,528 B) built from source `d5787ec`, installed on `emulator-5570` and
>   device-hashed exactly. The old APK `e243341f…` remains the identity of the
>   42-row review log, the nine journeys and the accessibility audit; those rows
>   are unaffected by this repair.
> - **Measured on device** (`evidence/d3-affected-games-reobserved.json`), both
>   affected submit controls read from their live boards with `enabled=false`,
>   decoded from the rendered screenshot and contrast-computed in both themes:
>   light **#ECEAE5 / #4A4B4E = 7.25:1**, dark **#17181B / #B9BABC = 9.14:1**,
>   both above 4.5:1 AA and both equal to the tokens the repair specifies — the
>   pixel-level proof that no opacity compositing remains (the old collapse sat
>   near 1.63:1). The Profile route's disabled Buy controls independently measure
>   the same 7.25:1 / 9.14:1 pair as a deterministic second witness.
> - **Ledger:** parent 076 is now **79 checked / 3 unchecked** — all 16 remaining
>   game tasks are closed on the 42-row evidence plus, for the two affected rows,
>   the re-observation above. The three open parent tasks are **14.3**, **14.4**
>   and **14.7** (the manifest/visual-report closure), not any game.
> - **Gates re-measured at the new SHA:** full Jest **623 suites / 7,248 tests /
>   5 snapshots**, typecheck clean, ESLint clean (`--max-warnings=0`), strict
>   OpenSpec **61/61**, provenance/dependency/expo/offline/secrets/workflow
>   validators PASS, runtime-QA contract PASS.
>
> ---
>
> **Historical 2026-10-09 `BLOCKED_HOST_ANDROID_EMULATOR` record (superseded — do
> not read as current).** The checkpoint text below is historical. Measured
> corrections: the rendering-dependency closure changed (**2** files, not 0), the
> terminal artifact is `b293a02` / `e243341fd4f9…` (not `c324960` /
> `de6c5fcd…`), Jest is **622 suites / 7,241 tests** (not 621 / 7,237), and the
> controller is **unblocked** (the Google free-tier quota is history). The ledgers
> moved back: parent tasks `6.1`, `6.3` and `6.5` are unchecked and 076-f is at
> 6/42. Per-finding record:
> `openspec/changes/076-f-final-product-certification/evidence/RECONCILIATION.md`.
>
> The clean-checkout composite then passed **20/20**. The device lane then blocked:
> the dedicated emulator died of host memory exhaustion and cannot be restarted, so
> there is **no evidence** for the 42-game rows, the nine journeys, the gameplay
> half of accessibility, or the terminal APK install and device hash. See
> `openspec/changes/076-f-final-product-certification/evidence/DEVICE_BLOCKER.md`.

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

## Historical 076-f checkpoint — 2026-10-09 (superseded by the reconciliation above)

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

## Current checkpoint — 2026-10-09 (reconciled; device lane blocked)

- **Execution authority:** `.agent/CAMPAIGN076F_EVIDENCE_RECONCILIATION_AND_TERMINAL_CLOSURE_PROMPT.md`.
- **Starting SHA:** `709ae55` — historical prompt start, not the current `HEAD`.
- **Record close:** document contradictions from the 2026-10-09 review are
  corrected in this pass. The device lane is still blocked. Do not read
  `709ae55` as `HEAD`.
- **Terminal identity:** application source `b293a02e1cd5df260a66dd886c1d279978b68994`,
  release APK `e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f`
  (48,888,452 B, x86_64, `com.braintraining.app` 0.1.0/1000). Built and hashed on
  the host — an **exact reproducibility match** — but **not installed and not
  device-hashed**.
- **Ledgers:** 076-f `tasks.md` 6 checked / 36 unchecked; parent ledger 58 checked.
- **Games:** 42 assessment slots, **0 accepted on the terminal APK**.
- **Provenance:** 302 rows; 194 game frames `SOURCE_NOT_EQUIVALENT`; 92 route rows
  `SOURCE_EQUIVALENT_HISTORICAL` with `currentApplicability: false`; generator
  exits non-zero by design while the dependency surface is dirty.
- **Repository gates measured without a device:** clean-checkout composite
  **PASS 20/20**, strict OpenSpec **61/61**, full Jest **622 / 7,241 / 5
  snapshots**, release APK **BUILD SUCCESSFUL**.
- **Controller:** operational on the owner-directed OpenDesign endpoint; both
  smokes PASS. Nine journeys still owed.
- **BLOCKER:** `BLOCKED_HOST_ANDROID_EMULATOR` — see
  `openspec/changes/076-f-final-product-certification/evidence/DEVICE_BLOCKER.md`.
  Every remaining gate needs a device.
- **Verdict:** `CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED`.

## Progress log

- 2026-10-12 (D3 minimal-delta closure): repaired the one reproduced defect that
  was deliberately left open, then reconciled every ledger against existing
  evidence instead of re-running the 42 reviews or the nine journeys. The
  reconciliation is one-directional and auditable: `scripts/qa/build-d3-impact.mjs`
  classifies each of the 42 rows as affected or unaffected by the repair, and
  `scripts/qa/reconcile-parent-tasks.mjs` checks a parent game task only when its
  row is unaffected (or, for the two affected rows, when the re-observation
  evidence exists). `scripts/qa/add-d3-row-addendum.mjs` appends the
  re-observation addendum to the two affected review rows. Measurement is
  `scripts/qa/measure-d3-pixels.mjs` (in-process PNG decoder + WCAG 2.x contrast);
  capture is `scripts/qa/verify-d3-disabled.mjs` (both themes via
  `uimode night` plus a cold restart per theme). The classifier is the thing that
  had to be corrected twice: a 5th/95th-percentile luminance split degenerates
  when a disabled Button's fill is >95% of its own region, so the final version
  takes FILL = most common exact colour and LABEL = most common non-fill colour.
  The cross-check on that choice is the label glyph count, which is identical for
  a given control across both themes (924 px for Submit, 1655 px for Submit
  guess) because it is the same text at the same size. No 42-row status was
  weakened and no checkbox was moved without linked evidence.

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
