# Campaign 055R — Signal Arcade Desirability Pass Resumption & Terminal Closure

**Status:** READY FOR EXECUTION  
**Repository:** `quantdale/brain-training`  
**Campaign:** resume existing `055-signal-arcade-desirability` — DO NOT open Campaign 056  
**Current repository head before this resumption prompt:** `90169bf73a6d848f21c4b8d7419fc2ac67a0cf7d`  
**Current Campaign 055 verdict:** `CAMPAIGN_055_DESIRABILITY_PASS_PARTIAL`  
**Primary goal:** finish the blocked native matrix, close the bounded remaining Campaign 055 visual debt, reconcile OpenSpec/durable state, and either terminally validate Campaign 055 or report the exact remaining blocker.

---

## 0. Mission

Resume Campaign 055 from its current PARTIAL state.

Do **not** start a new campaign.

Do **not** repeat the broad redesign.

Do **not** perform new mood-board exploration.

The design direction, refinement lock, Refero research, implementation, before/after evidence, and repository matrix already exist.

The remaining work is narrow and concrete:

1. restore a healthy **Brain Training-owned Android runtime** after the host reboot;
2. establish one authoritative **exact-final product artifact** after all remaining source edits;
3. finish the native default/compact/font-scale-2 × light/dark matrix;
4. triage the 27 compact `target<44dp` observations truthfully and fix only real defects;
5. finish the bounded result-system adoption debt:
   - remaining duplicate `Score` / `Final score` presentation;
   - `normalizedResult` / performance-band adoption where truthfully supported;
6. finish small Campaign-055-owned copy debt in Progress drill-downs where clearly administrative;
7. re-run runtime recovery/offline/invalid-route/log/SQLite checks and the full four-game workout;
8. reconcile the existing OpenSpec tasks/status and Campaign 055 closure records;
9. run the full final repository matrix;
10. close Campaign 055 only if the exact final artifact genuinely passes.

The target terminal label remains:

`CAMPAIGN_055_DESIRABILITY_PASS_COMPLETE`

Do not create a separate success label for "055R."

---

# 1. Read the existing Campaign 055 record first

Before editing, read at minimum:

- `docs/redesign/evidence/campaign055/CAMPAIGN055_CLOSURE.md`
- `FINAL_NATIVE_VALIDATION.md`
- `FINAL_REPOSITORY_VALIDATION.md`
- `ACCESSIBILITY_RESPONSIVE_QA.md`
- `VISUAL_CRITIQUE.md`
- `REFINEMENT_LOCK.md`
- `SURFACE_CHANGE_MATRIX.md`
- `COPY_AND_LABEL_AUDIT.md`
- `BEFORE_AFTER_REVIEW.md`
- `PERFORMANCE_SANITY.md`
- `openspec/changes/055-signal-arcade-desirability/change.json`
- `tasks.md`
- `EXECUTION.md`
- current `.agent/STATE.md`, `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`, `.agent/GOVERNANCE.json`

Campaign 055 is currently **ACTIVE/PARTIAL**, not terminal.

The existing OpenSpec tasks file still contains unchecked tasks even though many were already executed. Reconcile those checkboxes from evidence rather than blindly marking everything complete.

---

# 2. Git safety and exact starting state

At startup:

1. fetch remote `main`;
2. inspect HEAD, `origin/main`, worktree, worktrees, branches, and stashes;
3. preserve all pre-existing user/concurrent work;
4. record exact starting SHA;
5. distinguish:
   - repository SHA;
   - last executable/product-source SHA;
   - docs-only commits;
6. verify that the only change introduced by this resumption prompt itself is documentation/instructional.

Never:

- force-push;
- reset away unknown work;
- force checkout over unknown work;
- delete unrelated untracked tool configuration;
- mix unrelated user work into Campaign 055 commits.

---

# 3. CRITICAL runtime ownership rule

The previous recovery attempts accidentally stopped the non-target `emulator-5556`.

That must **not happen again**.

## 3.1 Strict prohibition

Do NOT:

- stop;
- kill;
- wipe;
- restart;
- install to;
- send input to;
- change settings on;
- take over;
- reuse

**`emulator-5556` or any other non-Brain-Training runtime.**

Do not assume an emulator is safe because it is visible in `adb devices`.

Identify the AVD name/ownership first.

## 3.2 Avoid global ADB disruption

Prefer serial-scoped ADB commands.

Do not run global destructive device-management commands such as `adb kill-server` unless absolutely necessary and only after proving no unrelated connected devices/runtimes would be disrupted.

Do not kill arbitrary `emulator.exe` processes.

## 3.3 Preferred target

Use:

- AVD `braintraining-ui35`;
- dedicated serial if healthy and verified.

If it is still unusable after the host reboot:

1. diagnose boundedly;
2. do not touch other existing AVDs;
3. if the host emulator subsystem is healthy enough, create a **new dedicated Brain Training-only AVD** with a unique name such as `braintraining-c055r`;
4. record its API/resolution/density/profile;
5. use only that dedicated runtime.

If the Windows host/emulator subsystem still cannot boot any dedicated Brain Training AVD, stop the native lane and retain PARTIAL. Do not damage unrelated runtimes trying to force progress.

---

# 4. First action after runtime recovery: prove the environment

Before product changes or certification, verify:

- emulator boots completely;
- `sys.boot_completed` responds;
- shell works;
- screenshot works;
- UIAutomator hierarchy dump works;
- logcat works;
- install/uninstall works;
- no access-violation/crash loop;
- graphics mode is stable enough for repeated captures.

Record this in:

`docs/redesign/evidence/campaign055/RESUMPTION_ENVIRONMENT_RECOVERY.md`

This document should explicitly state that no non-target runtime was touched.

---

# 5. Resolve artifact provenance before closure

Campaign 055 currently has two hashes:

- runtime evidence artifact:
  `9E6B94FCED9A70DDBE828C99734D846DF7A1DB4ED5F42B3FFDC6691A236A367A`
- later frozen-tree rebuild:
  `E1E9C4BD74442C47D26CD22FF00E467D5D2896AE91B30472FD2F3E2AF172D414`

Do not use either as final authority automatically.

The resumption may still make bounded display/accessibility edits.

Therefore:

1. finish all Campaign 055 source edits first;
2. run focused validation;
3. create a **final product-source checkpoint commit**;
4. build a fresh release APK from that exact product tree;
5. record its SHA-256 and size;
6. install **that exact artifact**;
7. use that exact artifact for every terminal native check;
8. after later docs/governance-only commits, prove no executable source changed since the product checkpoint.

There must be only one authoritative final Campaign 055 APK hash in the terminal closure.

Do not call an earlier artifact "final."

---

# 6. Bounded source debt A — result duplication across the catalog

Campaign 055 intentionally left this debt:

> Most other games still show a shared `Final score` artifact plus a game-owned `Score` row.

Close it systematically where the duplication is real.

## 6.1 Inventory first

Build a registry-derived or source-derived inventory across all 42 games of:

- game result title;
- game-owned Score/Final score metric rows;
- shared result score presentation;
- whether duplicate information is actually visible;
- whether removal would lose unique information.

Do not blindly remove every field named "score."

## 6.2 Closure rule

Where shared chrome already communicates the exact same score:

- remove the redundant game-owned row;
- preserve unique metrics such as accuracy, streak, rounds, time, mistakes, level, or mechanic-specific evidence;
- keep stable test IDs/accessibility semantics where they have external contracts, or migrate deliberately with tests.

Where the "score" row conveys unique semantics not represented by shared chrome, retain it and document why.

## 6.3 No scoring changes

This work is display-only.

Do not change:

- score computation;
- normalization;
- persistence;
- session payload;
- rating;
- XP;
- rewards;
- game completion semantics.

Required evidence:

`docs/redesign/evidence/campaign055/RESULT_DUPLICATION_CLOSURE.md`

The inventory should cover **42/42 registered games**, even if not every game needs a source edit.

---

# 7. Bounded source debt B — normalizedResult / performance-band adoption

Campaign 055's route Results can render honest performance bands, while many in-game Results still use generic titles because games do not pass `normalizedResult`.

Close this only where a truthful normalized result already exists or can be derived from an existing canonical game result contract **without inventing semantics**.

## 7.1 Rules

Use, in order of preference:

1. an existing canonical normalized score/result already produced by the game/SDK;
2. an existing explicit percentage/accuracy normalized to the same semantics;
3. an existing documented score/max-score contract only if max-score meaning is stable and already authoritative.

Do **not** invent a normalization formula because a game "looks like" it should be percent-based.

Do not infer cognitive quality from arbitrary raw score.

If a game cannot truthfully produce the shared band:

- keep its factual completion title;
- document it as an explicit non-adopter with reason;
- do not fake uniformity.

## 7.2 Honest weak-performance behavior

For adopting games verify:

- weak result does not trigger success band;
- weak first session does not show "New personal best" celebration;
- reward earned is displayed factually and separately from performance;
- mid/strong results map consistently;
- reduced-motion behavior is preserved.

Required evidence:

`docs/redesign/evidence/campaign055/NORMALIZED_RESULT_ADOPTION.md`

Include:

- total games;
- adopters;
- legitimate non-adopters;
- reason for every non-adopter;
- representative weak/mid/strong test evidence.

---

# 8. Bounded source debt C — Progress drill-down copy

Campaign 055 main Progress was improved, but drill-downs still contain some administrative `explainMetric` copy.

Audit:

- domain detail;
- game detail;
- activity/detail;
- any shared Progress explanation components.

Fix only copy that is clearly:

- robotic;
- internally phrased;
- redundant;
- overly administrative;
- inconsistent with the refined main Progress surface.

Do not:

- change figures;
- change analytics computations;
- change rating algorithms;
- hide uncertainty;
- add unsupported motivational/cognitive claims.

This is a copy refinement, not a Progress redesign.

Update:

`COPY_AND_LABEL_AUDIT.md`

with a resumption section.

---

# 9. Gameplay board dead space — investigate, do not trigger a new redesign

Campaign 055 recorded:

> gameplay dead space below short boards is game-owned.

Investigate whether there is a **shared layout defect**.

If a shared GameHost/container issue is demonstrably causing unnecessary dead space across multiple games, a bounded shared layout fix is authorized.

If the space is due to legitimate game-owned board dimensions/mechanic tuning:

- do not resize boards simply to fill space;
- do not alter mechanics;
- do not retune target positions;
- document as intentional or future game-specific visual debt.

No broad board-sizing campaign inside 055R.

Required evidence may live in:

`FINAL_NATIVE_VALIDATION.md` and `VISUAL_CRITIQUE.md` resumption addendum.

---

# 10. Triage all 27 compact target observations

This is mandatory.

Current grouped observations:

- 4 primary keys measured 43dp due to 4dp console lip;
- 8 back/ghost/favorite controls at 34–37dp visible bounds;
- 5 difficulty selector keys at 34–37dp;
- 4 Progress segmented controls at 24dp;
- 5 Reward action keys at 34dp;
- 1 Profile cosmetic row measured 40dp child content while parent row is 44dp.

Do not mechanically increase everything.

For each observation determine:

- actual layout bounds;
- interactive parent bounds;
- hitSlop;
- whether UIAutomator measured only the visible child/face;
- whether clipping occurred;
- whether the actual touch target is >=44dp;
- whether the source contract/test proves it;
- whether the compact layout makes the control visually or physically hard to operate.

Classify each as:

- `COMPLIANT_PARENT_OR_HITSLOP`
- `MEASUREMENT_ARTIFACT`
- `CLIPPED_BUT_REACHABLE`
- `TRUE_UNDERSIZED_TARGET`

Every `TRUE_UNDERSIZED_TARGET` must be fixed in the smallest shared control possible and then re-audited.

Avoid giant padding that breaks compact/font-scale layouts.

Specifically re-check:

- primary Play/Start/Open controls;
- BackLink/ScreenHeader;
- `How to play`;
- Favorite;
- DifficultySelector;
- Progress SegmentedControl;
- Reward Claim / Freeze / Shield;
- Profile cosmetic entry.

Required evidence:

update `ACCESSIBILITY_RESPONSIVE_QA.md` with a terminal resumption table mapping **27/27 observations** to final classifications.

The terminal goal is:

- 0 unlabelled interactive nodes;
- 0 decorative leaks;
- 0 unresolved true undersized targets.

Measurement artifacts may remain if source/layout evidence proves the actual target contract.

---

# 11. Font-scale-2 and dark-mode closure

After any target/copy/result edits, run the full required visual matrix on the **exact final artifact**:

## Profiles

- default;
- compact;
- font-scale-2.

## Themes

- light;
- dark.

At minimum capture the same 11 surfaces used by the Campaign 055 harness:

- Home;
- Games;
- Game Detail;
- Progress;
- Progress Activity/detail;
- Profile;
- Rewards;
- Data Management if included by harness;
- Results;
- GameHost intro/gameplay as defined by current capture tool.

Use the repository's canonical `ui-capture` tooling.

Ensure profile changes cannot leak font scale or dimensions into the next matrix.

For each matrix:

- route-verified;
- nonblank;
- no clipping of actionable controls;
- no hidden primary CTA;
- no unlabelled interactive nodes;
- no decorative art leaks.

Pay special attention to:

- Results primary/secondary actions;
- Rewards action rows;
- Games filter rail and 2-up posters;
- Profile identity block;
- Home focal artifact;
- Progress segmented control;
- tutorial/gameplay controls.

---

# 12. Exact-final runtime closure

Using the exact final release APK, run:

## 12.1 Startup / relaunch

- clean install;
- first launch;
- warm launch;
- force-stop/relaunch;
- offline launch;
- return online;
- logcat marker review.

## 12.2 Route recovery

- invalid game id;
- oversized game id;
- oversized Results id;
- malformed workout provenance;
- recovery back to normal navigation.

## 12.3 Core visual flow

- Home ready/active/completed;
- Games default + scrolled/search/filter;
- at least 8 visually/mechanically distinct games, one per domain, at Detail;
- tutorial;
- active gameplay;
- weak result;
- mid/strong result where deterministic truthful path exists;
- Progress;
- Profile;
- Rewards;
- dark Games/Result.

## 12.4 Full four-game workout

Complete a normal 4-leg workout on the final release artifact.

Verify:

- 4/4 progression;
- Next/Finish hierarchy;
- result persistence;
- final workout completion;
- relaunch retention;
- no duplicate session ids;
- no duplicate ledger operation ids;
- no stale workout advancement.

Do not use a force-win hook as mechanic correctness.

QA support may be used only where current repository policy explicitly allows it, and the evidence must distinguish deterministic completion from real mechanic interaction.

## 12.5 SQLite audit

After final flow:

- `PRAGMA integrity_check`;
- foreign-key check;
- schema version;
- session duplicate check;
- currency/reward operation duplicate check;
- workout instance terminal state;
- any result-band display changes must not affect durable data.

## 12.6 Marker scan

Across the terminal native pass inspect for:

- FATAL EXCEPTION;
- ANR;
- SIGSEGV;
- OOM;
- SQLite fatal/lock errors;
- ReactNativeJS fatal/error;
- RedBox/LogBox contamination where applicable.

---

# 13. Performance closure

No new production image assets are expected.

Still verify that the remaining result/catalog changes do not create pathological render work.

Run the five opt-in probes again.

Perform a bounded on-device sanity check for:

- Home;
- Games initial render/scroll;
- Game Detail;
- representative gameplay;
- Results;
- Profile;
- Rewards.

Do not turn this into a new performance campaign.

Update `PERFORMANCE_SANITY.md`.

---

# 14. Repository validation after final source freeze

After all source edits are complete:

- freeze product source;
- commit the product checkpoint;
- then run the authoritative repository matrix.

At minimum:

- full gated Jest;
- unexpected-console gate;
- all five opt-in probes;
- typecheck;
- lint;
- Expo Doctor;
- OpenSpec strict;
- repo-state;
- task ownership;
- affected-map sync;
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

Record exact final counts.

Do not reuse the 565 / 6,731 counts if tests were added or changed.

---

# 15. Reconcile the existing OpenSpec change — do not create a new one

Continue using:

`openspec/changes/055-signal-arcade-desirability/`

Do not create `055r` or Campaign 056 OpenSpec changes.

## 15.1 Tasks

The current `tasks.md` shows unchecked tasks even though most implementation work already happened.

Reconcile every checkbox against current durable evidence.

Do not mark a task complete merely because the closure summary says so.

For already completed tasks:

- verify supporting source/evidence;
- mark complete.

For the native matrix and remaining debt:

- mark complete only after this resumption actually closes them.

## 15.2 change.json

On successful terminal closure:

- `status`: `VALIDATED`;
- `validatedAt`: current date;
- replace partial fields as appropriate with terminal validation note;
- final verdict:
  `CAMPAIGN_055_DESIRABILITY_PASS_COMPLETE`.

If native closure fails again:

- retain ACTIVE/PARTIAL honestly;
- update `partialNote`;
- do not fabricate validation.

Run:

`openspec validate --all --strict`

after reconciliation.

---

# 16. Update Campaign 055 evidence in place

This is a resumption of the same campaign.

Prefer updating the existing Campaign 055 evidence rather than creating a disconnected `campaign055r` folder.

Required terminal updates:

- `CAMPAIGN055_CLOSURE.md`
- `FINAL_NATIVE_VALIDATION.md`
- `FINAL_REPOSITORY_VALIDATION.md`
- `ACCESSIBILITY_RESPONSIVE_QA.md`
- `VISUAL_CRITIQUE.md`
- `COPY_AND_LABEL_AUDIT.md`
- `PERFORMANCE_SANITY.md`
- `BEFORE_AFTER_REVIEW.md` if final pixels changed materially

Add new focused evidence:

- `RESUMPTION_ENVIRONMENT_RECOVERY.md`
- `RESULT_DUPLICATION_CLOSURE.md`
- `NORMALIZED_RESULT_ADOPTION.md`

If final visual source edits materially change Results/Progress/a11y controls, capture updated final screenshots and refresh relevant contact-sheet/evidence links.

Do not overwrite historical "before" screenshots.

---

# 17. Durable project state

On COMPLETE:

update current truth in:

- `.agent/GOVERNANCE.json`
- `.agent/STATE.md`
- `.agent/CURRENT_CAMPAIGN.md`
- `.agent/EXECUTION_PROMPT.md`
- `.agent/VALIDATION.md`
- `.agent/KNOWN_ISSUES.md`
- `.agent/task-ownership.json`
- any current backlog/deferred record that still calls Campaign 055 debt open.

Terminal state should say:

- active campaign: none;
- last campaign: 055;
- last status: VALIDATED / COMPLETE;
- no native matrix gap remains from the host-emulator failure.

Do not erase the fact that the first session was blocked by the emulator crash. Preserve it as historical context and record the successful resumed closure separately.

---

# 18. Protected contracts

This resumption remains a **display/accessibility/native-validation** campaign.

Do not alter:

- game mechanics;
- scoring algorithms;
- timers;
- generators;
- difficulty semantics;
- 42 registry IDs;
- workout generation/progression;
- session/workout identity;
- provenance;
- XP;
- currency;
- economy/reward meaning;
- schema v12;
- migrations;
- persistence semantics;
- backup/import/export semantics;
- route semantics;
- bootstrap recovery;
- route input envelope;
- offline-first behavior;
- dependency dispositions except if a newly discovered current issue independently requires action.

If a real correctness defect appears during resumed validation, reproduce and fix it with focused regression coverage before closure.

---

# 19. Adversarial final review

Before changing the verdict from PARTIAL to COMPLETE, challenge the closure.

Ask:

- Are we certifying the same exact artifact that was actually exercised?
- Did any source change after the "final" APK build?
- Were all 27 target observations classified?
- Are any true undersized controls still open?
- Did duplicate score removal accidentally delete unique game metrics?
- Did normalizedResult adoption invent semantics?
- Do weak results remain visually honest?
- Did Results changes preserve workout Next/Finish?
- Did any of the 42 game result components regress?
- Was the full 4-game workout executed on the final artifact?
- Was SQLite checked after that workout?
- Were default/compact/font-scale-2 × light/dark actually captured?
- Was `emulator-5556` untouched?
- Did OpenSpec tasks/status become truthful?
- Is Campaign 055 really terminal, or merely "probably fine after reboot"?

Record this adversarial review in the terminal closure.

---

# 20. Final verdict rules

Use exactly one Campaign 055 verdict:

## `CAMPAIGN_055_DESIRABILITY_PASS_COMPLETE`

Only if all of the following are true:

- a healthy dedicated Brain Training Android runtime was used;
- no non-target emulator/device was disturbed;
- one exact final release APK is identified and exercised;
- default/compact/font-scale-2 light+dark matrix is complete;
- 27/27 target observations are classified;
- 0 unresolved true undersized targets remain;
- result duplication inventory covers 42/42 games;
- redundant score rows are removed where truly redundant;
- normalizedResult adoption is complete where truthfully supported, with explicit legitimate non-adopters;
- weak results remain honest;
- Progress drill-down copy debt is closed or explicitly proven outside scope/non-problematic;
- force-stop/relaunch/offline/invalid-route/log review passes;
- full final-artifact four-game workout passes;
- post-workout SQLite integrity/duplicate audit passes;
- final repository matrix passes;
- OpenSpec is strict-valid and terminally VALIDATED;
- durable state is synchronized;
- no unresolved Critical/High/Medium product/accessibility regression remains.

## `CAMPAIGN_055_DESIRABILITY_PASS_PARTIAL`

Use if the product work is coherent but any required closure lane remains NOT VALIDATED.

## `CAMPAIGN_055_BLOCKED`

Use if a current product correctness/accessibility defect blocks safe closure or the final artifact cannot be established.

---

# 21. Git completion

Use coherent commits.

Suggested sequence:

1. resumption/environment evidence + debt inventory;
2. result/normalized-result/display-only source closure;
3. accessibility target fixes if any;
4. final product-source checkpoint;
5. final repository/native evidence;
6. OpenSpec/governance terminal closure.

Before final response:

- fetch remote;
- reconcile safely;
- push;
- verify `HEAD == origin/main`;
- verify tracked worktree clean;
- verify no abandoned worktree/branch/stash created by this session;
- preserve unrelated pre-existing untracked tool config.

---

# 22. Final CLI report

Report:

- verdict;
- starting SHA;
- final product-source checkpoint SHA;
- final repository SHA;
- authoritative final APK SHA-256 and size;
- runtime/AVD name and serial;
- explicit confirmation that `emulator-5556` and all non-target runtimes were untouched;
- environment recovery result;
- final Jest counts;
- OpenSpec count/result;
- 27-target triage counts by classification;
- number of true target defects fixed;
- result duplication inventory: 42/42 coverage and number of edits/non-edits;
- normalizedResult adoption count + legitimate non-adopter count;
- Progress drill-down copy disposition;
- default/compact/font-scale-2 × light/dark matrix result;
- four-game workout result;
- SQLite audit result;
- runtime/log result;
- performance result;
- remaining visual debt;
- remaining manual/external boundaries;
- backend/product semantics changed? yes/no with explanation;
- HEAD/origin state;
- worktree state;
- safest next action.

---

# Core directive

**Resume Campaign 055. Do not start Campaign 056.**

Use the rebooted host to finish the native proof the first session could not complete.

Close real accessibility findings, not measurement artifacts.

Make the result system coherent across the 42-game catalog without changing scoring.

Use performance bands only where they are semantically truthful.

Exercise one exact final artifact through the complete matrix and four-game workout.

Then either terminally validate Campaign 055 or keep it PARTIAL with the exact remaining evidence gap.

No shortcuts, no collateral damage to other emulators, and no new product campaign until Campaign 055 is truthfully closed.
