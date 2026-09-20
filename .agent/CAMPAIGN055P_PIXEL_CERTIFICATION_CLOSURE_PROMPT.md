# Campaign 055P — Pixel Certification & Terminal Closure

**Status:** READY FOR EXECUTION  
**Repository:** `quantdale/brain-training`  
**Campaign:** continue existing `055-signal-arcade-desirability`  
**Do not open Campaign 056**  
**Current repository baseline before this prompt:** `8e29c8529e4a8856045331be6d8437a6f6f56f61`  
**Current product-source checkpoint:** `ddfe539d1a25b5bf47b2b3975ee37783e0f81f60`  
**Current authoritative Campaign 055 APK:**  
`A83729AEFC9C00D398A215880CFB5B6837A3F08CA248EEC770BAAF2D33C48AA5`  
109,596,169 bytes, `com.braintraining.app` v0.1.0, debug-signed release, Metro-independent  
**Current verdict:** `CAMPAIGN_055_DESIRABILITY_PASS_PARTIAL`

---

## 0. Mission

Finish Campaign 055.

Everything product-owned is already closed.

The sole remaining Campaign 055 blocker is the **pixel-level six-way visual certification matrix**:

- default / light
- default / dark
- compact / light
- compact / dark
- font-scale-2 / light
- font-scale-2 / dark

The previous resumption proved the app semantically on the exact final artifact:

- clean install / first launch;
- warm launch;
- offline launch;
- malformed/oversized/invalid-route recovery;
- Home ready/completed;
- Games + search/filter;
- one Game Detail per each of 8 domains;
- real tutorial/gameplay interaction;
- honest weak Results;
- dark Games/Result hierarchy;
- full 4-game workout;
- relaunch retention;
- SQLite integrity/schema v12/no duplicates;
- clean log review;
- 42/42 result-duplication closure;
- 42/42 normalized-result adoption;
- 27/27 compact target findings classified with 0 true undersized controls;
- full repository matrix green.

Do **not** redo that work unless necessary to protect exact-artifact provenance.

This session is intentionally narrow:

> obtain trustworthy composited pixels for the exact final Campaign 055 artifact, run the six-way visual/a11y matrix, repair only genuine defects exposed by those pixels, and terminally close Campaign 055 if the evidence is clean.

---

# 1. Hard rule: no new campaign

Do not:

- open Campaign 056;
- create a new OpenSpec change;
- create a 055P OpenSpec change;
- start a new redesign;
- perform new product exploration;
- revisit Campaign 052/051 ideation;
- add features.

Continue only:

`openspec/changes/055-signal-arcade-desirability/`

Campaign 056 begins only after Campaign 055 is actually terminal.

---

# 2. Read current truth first

Before doing anything, read:

- `docs/redesign/evidence/campaign055/CAMPAIGN055_CLOSURE.md`
- `FINAL_NATIVE_VALIDATION.md`
- `FINAL_REPOSITORY_VALIDATION.md`
- `ACCESSIBILITY_RESPONSIVE_QA.md`
- `VISUAL_CRITIQUE.md`
- `RESUMPTION_ENVIRONMENT_RECOVERY.md`
- `RESULT_DUPLICATION_CLOSURE.md`
- `NORMALIZED_RESULT_ADOPTION.md`
- `BEFORE_AFTER_REVIEW.md`
- `REFINEMENT_LOCK.md`
- `openspec/changes/055-signal-arcade-desirability/change.json`
- `tasks.md`
- current `.agent/STATE.md`
- `.agent/VALIDATION.md`
- `.agent/KNOWN_ISSUES.md`
- `.agent/GOVERNANCE.json`
- `.agent/CURRENT_CAMPAIGN.md`
- `.agent/EXECUTION_PROMPT.md`

Treat the existing semantic/runtime evidence as authoritative unless current evidence contradicts it.

Do not manufacture reasons to repeat already-passed lanes.

---

# 3. Git safety

At startup:

1. fetch remote `main`;
2. inspect HEAD vs `origin/main`;
3. inspect tracked/untracked worktree;
4. inspect worktrees/branches/stashes;
5. preserve all unrelated user work;
6. record exact starting SHA.

The prompt file itself may advance `main`; synchronize safely.

Never:

- force-push;
- hard-reset unknown work;
- delete unrelated untracked config;
- overwrite concurrent work;
- create unnecessary branches/worktrees.

---

# 4. Product source is FROZEN by default

The authoritative Campaign 055 product checkpoint is:

`ddfe539d1a25b5bf47b2b3975ee37783e0f81f60`

The authoritative exact APK is:

`A83729AEFC9C00D398A215880CFB5B6837A3F08CA248EEC770BAAF2D33C48AA5`

Default policy:

**NO PRODUCT SOURCE EDITS.**

Do not change:

- UI;
- copy;
- styles;
- components;
- games;
- layout;
- results;
- scoring;
- persistence;
- tests;
- assets;
- dependencies;
- native config

just because this session exists.

Only a genuine visual/accessibility defect revealed by the pixel matrix may authorize a source edit.

If any source edit occurs:

1. document the exact pixel defect;
2. minimize root cause;
3. make the smallest fix;
4. add/update focused regression coverage;
5. run the complete required repository matrix;
6. create a new final product-source checkpoint;
7. build a new release APK;
8. invalidate the old A83729AE… artifact for terminal certification;
9. rerun **all six pixel matrices on the new exact APK**;
10. rerun the final runtime canaries necessary to prove the new artifact did not regress protected behavior.

Do not certify pixels from one artifact and semantics from another after a product edit.

---

# 5. Runtime ownership — no collateral damage

The previous resumption correctly avoided non-target runtimes.

Continue that discipline.

Do NOT touch:

- `emulator-5556`;
- Study Maker runtimes;
- any unrelated Android emulator/device;
- any AVD not explicitly confirmed as Brain Training-owned.

Preferred existing dedicated runtime:

`braintraining-c055r-atd`

Previous serial:

`emulator-5554`

But verify ownership from AVD/process/device facts before sending commands.

Use serial-scoped ADB.

Do not run:

- global `adb kill-server`;
- process-wide emulator kills;
- destructive cleanup of all AVDs

unless absolutely required and you can prove no unrelated runtime is affected.

If you need a new AVD, create a fresh uniquely named Brain Training-only AVD.

---

# 6. Diagnose the HOST DISPLAY path first

Previous blocker:

- guest booted;
- shell/UI hierarchy/database/input worked;
- `dumpsys gfxinfo` reported 0 frames;
- screenshots were uniform/blank;
- canonical `ui-capture` therefore reported BLANK;
- host emitted:
  `UpdateLayeredWindowIndirect ... A device attached to the system is not functioning`;
- `braintraining-ui35` still crashed with `0xC0000005`.

This session must first establish whether the display/compositor is now healthy.

Before installing/changing product state:

verify on the dedicated Brain Training AVD:

- emulator boot complete;
- SurfaceFlinger responsive;
- current activity visible;
- `dumpsys gfxinfo` shows real frame activity;
- `adb exec-out screencap -p` produces a nonuniform image;
- screenshot dimensions are correct;
- pixel variance/entropy is nonzero;
- UIAutomator hierarchy corresponds to the screenshot;
- repeated screenshots are stable;
- switching light/dark changes actual pixels;
- changing profile/size/font scale changes actual layout pixels.

Record:

`docs/redesign/evidence/campaign055/PIXEL_CERT_ENVIRONMENT.md`

This must include exact:

- host state;
- emulator version;
- AVD;
- API;
- resolution/density;
- GPU/render mode;
- screenshot verification method;
- evidence that frames are actually composited.

---

# 7. Allowed environment recovery

This session may diagnose and repair the **host/emulator display path**, but not by destabilizing unrelated environments.

Allowed bounded actions include:

- dedicated AVD cold boot;
- dedicated AVD wipe/recreate;
- trying supported emulator GPU modes;
- software rendering for the dedicated AVD;
- checking Windows graphics/WHP state;
- emulator version verification;
- controlled rollback/upgrade of Android Emulator tooling **only if repo/tooling policy allows and the change is external to product source**;
- restarting only session-owned Brain Training emulator processes;
- checking host display-driver/device status;
- verifying Memory Integrity / WHP / virtualization interaction if accessible.

Do not:

- change unrelated app source to work around blank screenshots;
- claim XML hierarchy equals pixel evidence;
- use screenshots from the older artifact as certification for the current artifact;
- treat blank PNG files as PASS.

If the host display cannot be repaired in this session, remain PARTIAL and stop after documenting the exact blocker.

---

# 8. Exact artifact identity before capture

Before the six-way matrix:

1. confirm no product source changed since `ddfe539d`;
2. obtain/rebuild the release APK from that exact product source if needed;
3. hash the APK;
4. require SHA-256 exactly:

`A83729AEFC9C00D398A215880CFB5B6837A3F08CA248EEC770BAAF2D33C48AA5`

If the rebuild differs despite no source change:

- investigate why;
- do not silently substitute;
- identify whether build nondeterminism or environment metadata explains it;
- prefer using the already-established exact artifact if available and trustworthy.

Install the exact authoritative artifact.

Record package/version/signing/size/hash again in the pixel-cert evidence.

---

# 9. Canonical six-way visual matrix

Run the canonical repository `ui-capture` flow against the exact artifact.

Required combinations:

1. default / light
2. default / dark
3. compact / light
4. compact / dark
5. font-scale-2 / light
6. font-scale-2 / dark

Do not skip a combination because another looks similar.

Reset profile/theme state cleanly between combinations.

For every matrix, capture the canonical surface set used by current tooling.

At minimum include:

- Home ready/active/completed where harness supports states;
- Games default;
- Games scrolled/library;
- search/filter state;
- Game Detail;
- GameHost intro/tutorial;
- active gameplay;
- in-session Result;
- route Result;
- Progress;
- at least one Progress drill-down;
- Profile;
- Rewards;
- Data Management if part of the canonical harness.

Where a state requires seeded/disposable data, use the repository's approved fixture path and document it.

Do not fake state with source edits.

---

# 10. Pixel validity gate

Every screenshot must pass a real pixel validity check.

For each image verify:

- nonzero file size;
- correct dimensions;
- not uniform;
- meaningful luminance/color variance;
- not a single repeated frame from another route;
- expected route-specific visual markers;
- no system crash/dialog obscuring the surface;
- no blank/black/transparent frame;
- no stale previous-app frame.

The capture harness's route verification is necessary but not sufficient.

If possible compute simple deterministic metrics:

- mean;
- standard deviation;
- unique-color/bucket count;
- perceptual hash uniqueness between clearly different routes.

Do not use these metrics as a visual-quality verdict; use them only to reject invalid captures.

---

# 11. Visual certification criteria

For each required surface/profile/theme inspect actual pixels for:

## Layout

- no actionable clipping;
- no hidden primary CTA;
- no overlap;
- no text overflowing its semantic region;
- no off-screen critical content without scroll affordance;
- no broken 2-up poster grid;
- no collapsed/overstretched collectible grid;
- no malformed result artifact;
- no layout collapse at font scale 2.

## Hierarchy

Campaign 055 intent must remain visible:

- Home: one dominant daily artifact;
- Games: storefront / featured stage + poster grid;
- Detail: world stage + dominant Play;
- Tutorial: concise reveal shell;
- Gameplay: mechanic-first;
- Results: one emotional artifact, honest band, no duplicate score;
- Progress: focal rating/consistency, not dashboard clutter;
- Profile: player identity first;
- Rewards: collectible object presentation;
- Dark: authored palette, not inversion.

## Results-specific

Verify at least one:

- weak result;
- mid/strong result if available;
- route result.

Check:

- no false success treatment;
- no duplicate score row;
- reward separated from performance;
- action hierarchy survives font scale 2;
- dark mode retains separation.

## Accessibility-visible constraints

- actionable controls visually reachable;
- font-scale-2 does not bury actions;
- compact does not create unusable spacing;
- labels are not visually truncated into ambiguity.

---

# 12. Re-run accessibility audit with the valid matrices

Once pixels are valid, rerun the current accessibility audit over the six-way capture set.

Terminal requirements:

- 0 unlabelled interactive nodes;
- 0 decorative-art leaks;
- 0 unresolved true undersized targets;
- the previous 27 observations remain correctly classified or are reclassified with new evidence;
- no new profile/theme-specific accessibility defect appears.

Do not reopen already-settled measurement-artifact findings without evidence.

If a valid pixel reveals real clipping despite compliant hit target, classify that separately as visual layout debt and fix only if actionable.

---

# 13. Before/after reality check

Campaign 055 already has Campaign 052/early-055 before images and first-session after images.

Now perform a final visual reality check using the exact authoritative final APK pixels.

Do not rerun broad design research.

Compare the final pixels against the intended Campaign 055 outcomes:

- less dashboard grammar;
- one focal object per surface;
- identity before metadata;
- honest result bands;
- collectible Rewards;
- credible Progress;
- authored dark mode.

Update:

`docs/redesign/evidence/campaign055/BEFORE_AFTER_REVIEW.md`

with a final-artifact certification section.

Be candid.

If any surface materially regressed from the earlier Campaign 055 visual evidence, investigate.

---

# 14. Final visual debt classification

After seeing the real exact-final pixels, classify every remaining visual issue as:

- `CLOSED`
- `LOW_ACCEPTED_DEBT`
- `MANUAL_HUMAN_REVIEW`
- `REAL_PRODUCT_DEFECT`
- `ENVIRONMENT_BLOCKED`

Known likely residual:

- game-owned short-board dead space.

Do not automatically call it a defect.

If it remains visually acceptable and mechanic-owned, keep it LOW accepted debt.

Do not start a new game-board redesign inside this session.

---

# 15. Source-edit escape hatch

If the matrix reveals a genuine defect, source edits are authorized only if:

- directly visible in required final pixels;
- Campaign 055-owned;
- not merely subjective preference;
- significant enough to block certification.

Examples:

- primary action clipped at font scale 2;
- result action inaccessible;
- dark-mode text unreadable;
- poster grid structurally broken;
- overlay prevents interaction;
- Result duplicate reappears;
- Profile/Rewards layout collapses.

For a real defect:

1. reproduce;
2. capture before evidence;
3. minimal fix;
4. focused tests;
5. full relevant visual matrices;
6. full repository matrix;
7. new product checkpoint;
8. new authoritative release APK;
9. redo all terminal pixel evidence on that new APK.

Do not patch cosmetic taste indefinitely.

---

# 16. Runtime semantic canary after pixel certification

If **no product source changed**, do not repeat the entire 4-game semantic campaign.

Run a bounded canary on the exact artifact to ensure the pixel-cert environment did not accidentally alter state:

- launch Home;
- open Games;
- open one Game Detail;
- start one game through intro to active state;
- return safely;
- force-stop/relaunch;
- log scan.

The already-completed final four-game workout/SQLite evidence remains authoritative because it was executed on the same exact APK.

If product source changes, rerun the stronger runtime matrix required by the previous 055R contract.

---

# 17. Repository validation

If no product source changed:

run at minimum the repository's terminal integrity gates needed to prove docs/OpenSpec/governance changes did not disturb the tree:

- repo-state;
- task ownership;
- OpenSpec strict;
- affected-map sync;
- provenance;
- secrets/workflow checks as required by impact map.

You may reuse the existing full 565-suite / 6,731-test product validation because the executable tree is unchanged, but explicitly prove it is the same executable tree.

If product source changes:

rerun the complete authoritative matrix:

- full gated Jest;
- unexpected-console gate;
- all 5 opt-in probes;
- typecheck;
- lint;
- Expo Doctor;
- OpenSpec strict;
- repo-state;
- task ownership;
- affected map;
- registry;
- provenance;
- offline;
- secrets;
- workflow hygiene;
- dependency audit;
- runtime QA contract;
- web export;
- Android debug build;
- Android release build.

---

# 18. OpenSpec terminal closure

Continue:

`openspec/changes/055-signal-arcade-desirability/`

On successful pixel certification:

## tasks.md

- verify every existing task against durable evidence;
- mark the previously partial native matrix task complete;
- ensure no unchecked required task remains.

## change.json

Set:

- `status`: `VALIDATED`;
- `validatedAt`: current date;
- terminal `validationNote`;
- `verdict`: `CAMPAIGN_055_DESIRABILITY_PASS_COMPLETE`.

Remove or preserve partial fields only according to repository convention, but do not leave the current state ambiguously ACTIVE/PARTIAL.

Run:

`openspec validate --all --strict`

Terminal requirement: all OpenSpec items PASS.

---

# 19. Durable state closure

On COMPLETE, update:

- `.agent/GOVERNANCE.json`
- `.agent/STATE.md`
- `.agent/CURRENT_CAMPAIGN.md`
- `.agent/EXECUTION_PROMPT.md`
- `.agent/VALIDATION.md`
- `.agent/KNOWN_ISSUES.md`
- `.agent/task-ownership.json`
- current backlog/deferred records if they still call the pixel matrix open.

Terminal truth:

- active campaign: none;
- last campaign: `055-signal-arcade-desirability`;
- status: VALIDATED;
- verdict: `CAMPAIGN_055_DESIRABILITY_PASS_COMPLETE`.

Preserve both historical environment failures:

1. initial emulator 0xC0000005 crash loop;
2. resumed host compositing/0-frame failure.

Do not erase them.

Record that pixel certification later succeeded on the exact same product artifact, if that is what happens.

---

# 20. Evidence updates

Add:

`docs/redesign/evidence/campaign055/PIXEL_CERT_ENVIRONMENT.md`

Update:

- `CAMPAIGN055_CLOSURE.md`
- `FINAL_NATIVE_VALIDATION.md`
- `ACCESSIBILITY_RESPONSIVE_QA.md`
- `BEFORE_AFTER_REVIEW.md`
- `VISUAL_CRITIQUE.md`
- `FINAL_REPOSITORY_VALIDATION.md` only as needed to record unchanged-executable reuse or new validation
- `PERFORMANCE_SANITY.md` only if meaningful frame/timing evidence becomes available

Preserve historical screenshots and evidence.

Store the valid final exact-artifact matrix under a clear final path, for example:

`docs/redesign/evidence/campaign055/screens/final-cert/`

or the repository's established capture layout.

Do not commit enormous raw transient capture trees if repository evidence conventions use compressed final images/contact sheets instead.

Produce a final contact sheet for the six-way certification if useful.

---

# 21. Adversarial certification review

Before declaring COMPLETE, answer all of these with evidence:

- Is the APK hash exactly A83729AE…48AA5, or was a new artifact legitimately established after a real defect fix?
- Are the screenshots definitely nonblank and composited?
- Were all six profile/theme combinations captured?
- Did each required surface route verify?
- Did font-scale-2 preserve primary actions?
- Did compact preserve interaction and hierarchy?
- Did dark mode remain authored and readable?
- Do Results show one score presentation and honest performance bands?
- Does Games remain a storefront rather than repeated giant cards?
- Does Profile remain identity-first?
- Do Rewards remain collectible?
- Did any visual defect require a source edit?
- If yes, was all certification redone on the new artifact?
- Is the executable tree unchanged after the certified APK?
- Is OpenSpec now terminal VALIDATED?
- Is active campaign now none?
- Were all non-target emulators/devices untouched?

If any mandatory answer is unsupported, do not declare COMPLETE.

---

# 22. Final verdict

Use exactly one:

## `CAMPAIGN_055_DESIRABILITY_PASS_COMPLETE`

Only if:

- valid composited pixels exist;
- all six visual matrices are complete;
- required surfaces are visually reviewed;
- no blocking visual/accessibility defect remains;
- exact artifact identity is proven;
- no post-artifact executable drift exists;
- accessibility matrix is clean;
- OpenSpec 055 is VALIDATED;
- governance is terminal;
- no unresolved Critical/High/Medium Campaign 055 product defect remains.

## `CAMPAIGN_055_DESIRABILITY_PASS_PARTIAL`

Use if host/environment still prevents trustworthy pixel certification or another required evidence lane remains unavailable.

## `CAMPAIGN_055_BLOCKED`

Use if the final pixels expose a serious product/accessibility defect that cannot safely be repaired in this session.

---

# 23. Git completion

Commit only coherent certification/evidence/governance changes, unless a real source defect required repair.

Before final response:

- inspect final diff;
- fetch/reconcile remote safely;
- push;
- verify `HEAD == origin/main`;
- verify tracked worktree clean;
- verify no temporary branches/worktrees/stashes created by this session remain;
- preserve unrelated untracked tool config.

---

# 24. Final CLI report

Report:

- verdict;
- starting SHA;
- product-source SHA;
- final repository SHA;
- certified APK SHA-256 and size;
- whether product source changed in this session;
- AVD name and serial;
- emulator version / rendering mode;
- explicit confirmation non-target runtimes were untouched;
- pixel-environment recovery result;
- six-way matrix:
  - default/light
  - default/dark
  - compact/light
  - compact/dark
  - font-scale-2/light
  - font-scale-2/dark
- number of valid screenshots/surfaces;
- accessibility result;
- any visual defects found/fixed;
- exact-artifact before/after review result;
- remaining visual debt;
- semantic runtime canary result;
- reused or rerun repository validation counts;
- OpenSpec result/status;
- governance terminal state;
- remaining manual/external boundaries;
- HEAD/origin state;
- worktree state;
- whether Campaign 056 is now safe to begin.

---

# Core directive

**Do not redesign. Certify.**

Campaign 055 product work is already done.

Obtain real pixels from the exact final artifact.

Prove all six visual matrices.

Fix only genuine blocking defects.

Do not touch unrelated emulators.

Do not invalidate artifact provenance casually.

Then either close Campaign 055 as:

`CAMPAIGN_055_DESIRABILITY_PASS_COMPLETE`

or keep it PARTIAL with the precise remaining environment blocker.

**Campaign 056 must not begin until Campaign 055 is terminal.**
