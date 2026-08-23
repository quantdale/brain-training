# Campaign 012 — Broad Convergence and Release-Candidate Preparation

**Status:** COMPLETED (closed 2026-08-23)
**Campaign id:** `012-broad-convergence-release-prep`
**Predecessor:** `011-full-validation-hardening` (COMPLETED at `b8ca36f`)
**Successor:** `013-final-product-completion` (opened immediately at closeout)
**Mode:** day (default; owner did not select night)

## Mission

CONSOLIDATE → COMPLETE → SIMPLIFY → DEEPEN → PREPARE FOR RELEASE.

1. **P1 — GameHost migration:** 42/42 games on the shared host. ✅
2. **P2 — Workout V2 complete product:** short/standard/extended/focus,
   resume, history, completion summary, picker UX, device traversal. ✅
3. **P3 — Content debt:** equation-builder dead templates resolved + global
   catalog integrity sweep CLEAN. ✅
4. **P4 — Release polish:** Home/Games/Workout/Progress/Rewards/Profile/
   Results/Game Detail/Data Management coherence without redesign churn. ✅
5. **P5 — Performance maturation:** evidence-negative; baselines recorded. ✅
6. **P6 — Build determinism:** prebuild two-run determinism proven; CNG
   plugins codified; RECORD_AUDIO blocked. ✅
7. **P7 — Dependency audit:** W15 report → pins lifted, doctor 21/21. ✅
8. **P8 — iOS static preparation:** source-level fixes landed; build honestly
   NOT VALIDATED (Windows host, no Xcode). ✅

## Parent closeout (this closure)

The remaining parent-owned exit criteria were executed 2026-08-23 and are
evidenced in `.agent/VALIDATION.md` (Campaign 012 closeout section):

- Clean native reconstruction: fresh prebuild + assembleDebug + install on a
  cold-booted dedicated AVD; deterministic versionCode mechanics added.
- Device journeys: Workout V2 short/focus/resume/daily ALL PASS (including
  mid-workout kill/relaunch resume and persisted-completion relaunch checks);
  canaries 8/8 PASS; 17 additional games terminally classified PASS today.
- Closeout QA surfaced and fixed one Critical (workout advance never notified
  Home — stale completion UI), two High (clipped tutorial controls; QA panel
  below fold), plus harness robustness gaps; each fix carries regression
  coverage or structured device evidence.
- Final gates green: tsc 0 errors; Jest test:ci PASS (0 failures); lint 0
  errors; repo-state/registry/provenance/ownership/offline validators PASS;
  expo-doctor 21/21.

## Exit criteria (final)

- [x] GameHost migration fully completed (42/42) with per-batch validation
- [x] Workout V2 short/standard/focus/resume/history flows implemented;
      device automation written (W06/W07/W08)
- [x] Device journeys run by parent: workout template journeys PASS;
      migrated-game canaries/journeys PASS (see VALIDATION.md)
- [x] Dead math content fixed; global content audit completed CLEAN
- [x] UX/settings/release surfaces matured without redesign churn
- [x] Build configuration audited; prebuild determinism evidenced
- [x] Dependency audit delivered; approved changes applied and validated
- [x] iOS static compatibility improved; build honestly NOT VALIDATED
- [x] Final full gates green (see above)
- [x] Durable state synchronized; release-blocker inventory recorded
      (KNOWN_ISSUES.md); successor campaign opened

## Deferred product decisions (unchanged — do not activate)

Branding, account provider, Supabase production, cloud sync deployment,
premium pricing, ads, AI provider/pricing, social, notification schedule,
store listing timing.
