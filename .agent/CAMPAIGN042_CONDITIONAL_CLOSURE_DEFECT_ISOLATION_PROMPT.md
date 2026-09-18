# Campaign 042 — Conditional Closure & Defect Isolation

**Status:** READY FOR EXECUTION  
**Repository:** `quantdale/brain-training`  
**Mode:** narrow defect isolation + release-runtime closure + evidence-backed hardening  
**Starting point:** Campaign 041 verdict `CAMPAIGN_041_CONDITIONAL` at final SHA `ac83c2e0c1a4e6043f9acc10ff28759fe8ff5541`  
**Validated product/source SHA from Campaign 041:** `4c0e5f819bbc1d7fd83f9ac979e19406c50753a9`  
**Primary evidence root:** `docs/redesign/evidence/campaign042/`  
**Primary goal:** close the exact technical gaps that prevented Campaign 041 from certifying the current product, without reopening broad redesign or unrelated feature work

---

## 0. Mission

Campaign 041 independently re-proved a large portion of the product and correctly returned `CAMPAIGN_041_CONDITIONAL`.

Campaign 042 is not another broad redesign or generic audit. It exists to close the remaining **technical certification blockers** with current evidence.

The three primary blockers are:

1. an intermittent startup/workout-load `NativeDatabase.prepareAsync` / `NullPointerException` observation that was not minimized to root cause;
2. three registered games that reached real interactive state but did not complete a retained result lifecycle in the Campaign 041 sweep:
   - `math-equation-builder`
   - `memory-sequence-memory`
   - `spatial-coordinate-turn`
3. incomplete clean **release-build** native hierarchy/accessibility/state-matrix evidence because UiAutomation contention and later degraded AVD state prevented a trustworthy final pass.

Secondary closure items include compact/font-scale clipping risks and a fresh external-CI classification.

The desired outcome is not “make it green.” The desired outcome is to determine whether these are real product defects, tooling/environment defects, reproducible edge cases, or bounded non-blocking evidence gaps — and to repair demonstrated product defects when justified.

---

## 1. Evidence doctrine — mandatory

Do not blindly trust Campaign 041 documentation, this prompt, old logs, previous PASS labels, or earlier diagnoses.

For every material claim, establish current truth using this order:

1. current reproducible native runtime observation;
2. current persisted-state inspection;
3. current executable tests/validators;
4. current source/configuration inspection;
5. current build/package behavior;
6. Git history and prior evidence.

Use these labels consistently:

- `[OBSERVED_RUNTIME]`
- `[VERIFIED_PERSISTED_STATE]`
- `[VERIFIED_TEST]`
- `[VERIFIED_SOURCE]`
- `[VERIFIED_BUILD]`
- `[VERIFIED_GIT]`
- `[INFERRED]`
- `[BLOCKED]`
- `[MANUAL/EXTERNAL_PENDING]`

If new evidence contradicts Campaign 041, follow the new evidence and document the contradiction explicitly.

---

## 2. Safety and Git contract

Before changing anything:

- fetch the latest remote;
- record `HEAD`, `origin/main`, branch, status, remotes, worktrees, and stashes;
- preserve concurrent/pre-existing work;
- do not reset away unknown changes;
- do not force-push;
- do not delete unrelated worktrees or AVDs;
- do not rewrite history.

If remote `main` changes during the campaign, inspect ancestry and reconcile safely.

### 2.1 Runtime safety

Use only a clearly dedicated automation-owned Android runtime.

Campaign 041 used a dedicated Android 15/API 35 emulator. Do not assume its current state is healthy. Inspect it first.

If UiAutomation, graphics, package state, emulator service state, or runtime contamination makes evidence unreliable:

- shut down only the dedicated automation-owned runtime;
- recreate or reset a disposable normal phone-oriented Android 15/API 35 AVD as needed;
- do not disturb user-owned emulators or physical devices.

The runtime must be trustworthy before certification evidence is accepted.

---

## 3. Authorized scope

Campaign 042 **may** modify product source and tests, but only for demonstrated current defects within these closure lanes:

- SQLite/database initialization/workout-load startup failure;
- lifecycle/result/persistence behavior of the three incomplete games;
- release-build runtime/a11y issues found during current validation;
- reproducible compact/font-scale clipping or touch-target defects encountered in the required matrix;
- narrowly related regression coverage.

Campaign 042 does **not** authorize:

- new features;
- broad visual redesign;
- new game mechanics;
- economy redesign;
- scoring formula changes;
- schema redesign unless a demonstrated defect absolutely requires it;
- broad dependency upgrades;
- unrelated technical-debt cleanup;
- speculative performance optimization;
- CI workflow edits merely to remove red status.

---

## 4. Phase A — Re-establish a trustworthy dedicated runtime

The Campaign 041 final runtime degraded and release XML/a11y extraction collided with UiAutomation.

Before any substantive validation:

1. inspect the existing dedicated AVD/process state;
2. confirm whether a UiAutomation service is already registered;
3. inspect ADB/server/process contention;
4. inspect package/app state;
5. inspect emulator graphics/rendering health;
6. inspect whether screenshots contain real pixels;
7. inspect whether UI hierarchy extraction works;
8. inspect whether debug and release packages can be independently installed/launched.

If current state is contaminated, perform a bounded clean reset or create a fresh disposable AVD.

Required acceptance before continuing:

- stable boot;
- `adb get-state == device`;
- `sys.boot_completed=1`;
- package manager ready;
- real non-uniform framebuffer pixels;
- successful UI hierarchy extraction;
- clean force-stop/relaunch behavior;
- no unexplained zero-byte screenshots;
- no persistent UiAutomation contention.

Document exact environment provenance.

Required output:

`docs/redesign/evidence/campaign042/RUNTIME_ENVIRONMENT_RECOVERY.md`

---

## 5. Phase B — Isolate the `NativeDatabase.prepareAsync` startup/workout-load failure

This is the highest-priority defect lane.

Do not jump directly to patching source.

### 5.1 Reproduction matrix

Run a bounded but serious reproduction campaign across combinations of:

- cold emulator boot;
- warm app relaunch;
- force-stop/relaunch;
- first install;
- existing DB;
- fresh DB;
- offline startup;
- online/development startup where relevant;
- debug build;
- release build;
- Home loading before DB initialization settles;
- Today/workout loading;
- rapid app reopen;
- background/foreground around startup;
- Metro present vs release independent of Metro.

Capture:

- logcat;
- JS logs;
- native stack traces;
- timing;
- app state;
- DB presence/version;
- whether the failure self-recovers;
- whether data integrity changes;
- whether failure is deterministic, probabilistic, or non-reproducible.

Use enough repetitions to distinguish “could not reproduce” from “tried once.”

### 5.2 Source/path analysis

Trace the complete source path around:

- database singleton/connection creation;
- `prepareAsync`;
- statement lifecycle;
- workout loading/query preparation;
- app/root provider initialization;
- concurrent callers;
- cleanup/finalization;
- hot reload / dev-only lifecycle if relevant;
- release lifecycle.

Inspect for:

- double-open/double-close;
- statement prepared against invalidated native DB handle;
- race between provider unmount/remount and async query preparation;
- concurrent initialization;
- stale promise/state;
- reused statement after connection replacement;
- background/foreground teardown;
- test/dev lifecycle differences.

### 5.3 Repair rule

Only repair if a current defect is reproduced or a root cause is established strongly enough to justify a bounded fix.

If repaired:

1. add focused regression coverage;
2. rerun reproduction matrix;
3. run persistence/workout tests;
4. run full Jest;
5. rerun native startup/workout flows;
6. inspect SQLite integrity/state afterward.

If not reproducible:

- do not fabricate a fix;
- document attempts, probability bounds, evidence, and most likely classification;
- clearly state whether the risk remains release-relevant.

Required output:

`docs/redesign/evidence/campaign042/SQLITE_STARTUP_NPE_ISOLATION.md`

---

## 6. Phase C — Close the three incomplete game result lifecycles

Games:

- `math-equation-builder`
- `memory-sequence-memory`
- `spatial-coordinate-turn`

For each game:

1. resolve Game Detail;
2. enter intro/tutorial;
3. start actual gameplay;
4. reach first interactive state;
5. interact with the real mechanic;
6. complete through the game’s legitimate lifecycle using deterministic QA support only where appropriate;
7. reach the retained Result state;
8. verify navigation out of Result;
9. inspect persisted session row;
10. inspect rating history;
11. inspect XP/currency/reward writes where applicable;
12. verify no duplicate operation IDs;
13. force-stop/relaunch;
14. verify persisted result/history still exists.

Do not use a force-win hook and call that “mechanic correctness.”

For each game distinguish:

- real mechanic interaction;
- deterministic completion support;
- retained result rendering;
- persistence validation.

### 6.1 Repeated-run check

Run each of the three result lifecycles more than once with disposable/controlled state where repository QA tooling allows.

Check:

- duplicate session IDs;
- duplicate reward/currency operations;
- duplicate rating keys;
- stale result reuse;
- broken difficulty/session metadata;
- navigation traps.

If any of the three currently cannot reach a valid result:

- determine whether the cause is game logic, QA harness, timer/state machine, test fixture, or environment;
- repair only demonstrated product defects;
- do not hide a real lifecycle failure by weakening the detector.

Required output:

`docs/redesign/evidence/campaign042/THREE_GAME_RESULT_LIFECYCLE_CLOSURE.md`

---

## 7. Phase D — Release-build independence and clean native evidence

Campaign 041 did not obtain a complete trustworthy release XML/a11y pass.

This phase must use a **release APK** built from the current Campaign 042 product SHA.

### 7.1 Release independence

Verify:

- release APK builds;
- release APK installs;
- app launches with Metro/dev server unavailable;
- Home renders;
- Games renders;
- Progress renders;
- Profile renders;
- Game Detail renders;
- representative gameplay renders;
- Results render;
- force-stop/relaunch works;
- offline startup works;
- no RedBox/dev-only dependency appears.

### 7.2 Clean release hierarchy

With a healthy UiAutomation environment:

- capture release XML hierarchy;
- capture real pixels;
- run automated accessibility checks;
- inspect actionable nodes;
- inspect semantic labels;
- inspect min target sizes;
- inspect bottom-bar/scroll occlusion;
- inspect modal/overlay behavior.

If hierarchy extraction fails:

- reset/recover the automation runtime and retry boundedly;
- determine whether failure belongs to app, emulator, or tooling;
- do not label release a11y PASS without actual hierarchy evidence.

Required output:

`docs/redesign/evidence/campaign042/RELEASE_RUNTIME_ACCESSIBILITY.md`

---

## 8. Phase E — Complete the missing state-level pixel/accessibility matrix

Campaign 041 had strong route/theme coverage but not a complete required-state matrix.

Capture/verify current real pixels and semantic hierarchies for as many of these states as technically reachable:

### Home
- fresh/no sessions;
- active workout;
- completed workout;
- resume state;
- light/dark;
- compact viewport;
- increased font scale.

### Games
- default Suggested Next/Browse All;
- search populated;
- search no-results;
- category filter;
- Favorites populated/empty;
- Game Detail populated;
- light/dark;
- compact/font-scale.

### Golden path
- intro;
- tutorial/example;
- gameplay;
- pause;
- per-game Result;
- Next Game;
- final workout completion.

### Progress
- empty/sparse;
- populated;
- selected time window;
- domain drill-down;
- game history;
- compact/font-scale.

### Profile/Rewards/Data
- Profile;
- Rewards empty/populated where deterministic fixture exists;
- Data Management;
- settings;
- export/backup surface;
- light/dark;
- compact/font-scale.

### Recovery/error
- invalid route;
- loading boundary;
- recoverable empty/error state;
- offline startup.

For each capture record:

- build type;
- route/state;
- theme;
- viewport/font scale;
- screenshot path/hash;
- hierarchy path/hash;
- a11y result;
- clipping/occlusion observations;
- whether state is exact or fixture-assisted.

Required output:

`docs/redesign/evidence/campaign042/STATE_PIXEL_ACCESSIBILITY_MATRIX.md`

---

## 9. Phase F — Compact viewport and font-scale clipping closure

Campaign 041 recorded Low/Medium clipping risks.

Reproduce them deliberately.

At minimum inspect:

- Home rows/cards/actions;
- Games cards/filters/search controls;
- Game Detail;
- Progress summary/cards;
- Profile grouping;
- Rewards;
- Data Management;
- bottom navigation;
- modal/tutorial surfaces.

Use representative compact viewport and increased font-scale settings.

If clipping/overlap makes an actionable control inaccessible, truncated beyond reasonable comprehension, or below the product’s accessibility contract:

- reproduce;
- minimize;
- fix narrowly;
- add regression/snapshot/layout coverage where realistic;
- recapture before/after evidence.

Do not over-redesign unaffected surfaces.

Required output:

`docs/redesign/evidence/campaign042/RESPONSIVE_TEXT_SCALE_CLOSURE.md`

---

## 10. Phase G — Focused persistence/idempotency revalidation after any repairs

Whether or not source changes were made, rerun the high-risk invariants affected by this campaign.

At minimum:

- one real workout start;
- one completed representative game;
- each of the three formerly incomplete game results;
- force-stop/relaunch;
- one pause/resume cycle;
- Favorite persistence;
- settings persistence;
- exactly-once currency/reward/session/rating checks;
- `PRAGMA integrity_check`;
- schema/user version confirmation.

If SQLite startup code changed, rerun:

- fresh DB;
- existing DB;
- migration-supported fixture smoke;
- backup/export/import smoke.

Required output:

`docs/redesign/evidence/campaign042/PERSISTENCE_REVALIDATION.md`

---

## 11. Phase H — Full repository and build gates

Run after final source state is settled.

At minimum:

- full Jest CI-mode suite;
- all focused tests added/changed;
- typecheck;
- lint;
- generated registry;
- provenance;
- offline boundary;
- secrets;
- dependency policy validator;
- raw dependency audit classification;
- task ownership;
- affected-map;
- workflow hygiene;
- runtime-QA contract;
- OpenSpec;
- Expo Doctor;
- web export;
- Android debug build;
- Android release build.

Do not hide intentional skips; classify them.

If opt-in performance/large-backup probes remain supported and Campaign 042 touched persistence/runtime initialization, rerun the relevant probes.

Required output:

`docs/redesign/evidence/campaign042/FINAL_REPOSITORY_VALIDATION.md`

---

## 12. Phase I — External CI reclassification

At the final Campaign 042 source/evidence SHA, inspect the current workflow runs.

For:

- Repository Integrity;
- App CI;
- Android Build Smoke;
- iOS Build Smoke.

Record:

- workflow run ID;
- conclusion;
- event;
- jobs;
- step count;
- available annotations/logs;
- whether any repository command executed.

Classify one of:

- `PASS`
- `REPOSITORY_WORKFLOW_DEFECT`
- `RUNNER_INFRASTRUCTURE`
- `ACCOUNT_OR_POLICY`
- `GITHUB_TRANSIENT`
- `INDETERMINATE_EXTERNAL_PRE_STEP`

Do not modify workflow YAML unless repository-side workflow failure is actually proven.

Required output:

`docs/redesign/evidence/campaign042/EXTERNAL_CI_RECHECK.md`

---

## 13. Mandatory adversarial second pass

After you believe the three blockers are closed, attempt to disprove your own conclusion.

Ask:

- Can the SQLite failure still be triggered under another startup ordering?
- Did the three game result paths persist the right session/reward/rating data?
- Did release validation accidentally depend on debug state?
- Did UiAutomation succeed only because a dev overlay/state differed from release?
- Do compact/font-scale repairs break normal layout?
- Did any fix introduce duplicate writes?
- Do repeated result transitions reuse stale state?
- Does force-stop/relaunch alter completion?
- Are screenshots real current pixels or stale artifacts?
- Are hierarchy captures from the correct package/build?
- Does offline release still work?
- Are any previous conditional gaps merely renamed rather than actually closed?

Run targeted checks for the highest-risk answers.

Required output:

`docs/redesign/evidence/campaign042/ADVERSARIAL_SECOND_PASS.md`

---

## 14. Defect-repair policy

Every repair must follow:

1. reproduce;
2. minimize;
3. identify root cause;
4. classify severity;
5. add/strengthen regression coverage where appropriate;
6. make the smallest coherent fix;
7. rerun focused validation;
8. rerun affected broad gates;
9. native-retest;
10. document before/after.

Do not:

- weaken tests;
- broaden allowlists;
- hide failures;
- suppress errors without root cause;
- add a QA bypass to make one game “complete” unless the product already supports legitimate deterministic completion;
- rewrite stable mechanics unrelated to the defect;
- mix broad dependency upgrades into this campaign.

Required output:

`docs/redesign/evidence/campaign042/DEFECT_REPAIR_LOG.md`

---

## 15. Human/platform boundary

Campaign 042 is an engineering technical-closure campaign.

Do not claim:

- independent human usability;
- independent human TalkBack/VoiceOver quality;
- physical Android coverage;
- iOS runtime coverage;
- store install/signing coverage;
- system document/share-sheet usability;

unless genuinely executed.

Carry forward unavailable items explicitly.

Required output:

`docs/redesign/evidence/campaign042/HUMAN_PLATFORM_BOUNDARY.md`

---

## 16. Required closure packet

Create at minimum:

1. `docs/redesign/evidence/campaign042/CAMPAIGN042_CLOSURE.md`
2. `RUNTIME_ENVIRONMENT_RECOVERY.md`
3. `SQLITE_STARTUP_NPE_ISOLATION.md`
4. `THREE_GAME_RESULT_LIFECYCLE_CLOSURE.md`
5. `RELEASE_RUNTIME_ACCESSIBILITY.md`
6. `STATE_PIXEL_ACCESSIBILITY_MATRIX.md`
7. `RESPONSIVE_TEXT_SCALE_CLOSURE.md`
8. `PERSISTENCE_REVALIDATION.md`
9. `FINAL_REPOSITORY_VALIDATION.md`
10. `EXTERNAL_CI_RECHECK.md`
11. `DEFECT_REPAIR_LOG.md`
12. `ADVERSARIAL_SECOND_PASS.md`
13. `HUMAN_PLATFORM_BOUNDARY.md`

Do not create empty ceremonial files.

---

## 17. Final verdict

Return exactly one:

### `CAMPAIGN_042_TECHNICAL_CERTIFIED`

Only if all of the following are true:

- the SQLite startup/workout-load NPE is either reproducibly fixed **or** convincingly dispositioned as a non-product/tooling/environment issue with strong evidence;
- all three previously incomplete games now complete a retained result lifecycle with persistence evidence;
- clean release APK launches independently of Metro;
- release XML/hierarchy/accessibility evidence is obtained cleanly;
- required state-level matrix is materially closed;
- compact/font-scale blocker-level clipping is fixed or proven non-blocking;
- no unresolved Critical/High/Medium product correctness defect remains from this campaign;
- full repository/build gates pass or deviations are clearly external/non-product;
- adversarial second pass finds no certification-blocking contradiction.

This verdict does **not** imply human/iOS/store certification.

### `CAMPAIGN_042_CONDITIONAL`

Use if the product is technically strong but one or more material technical evidence gaps remain, or Medium/Low debt remains that should block a stronger technical label.

### `CAMPAIGN_042_BLOCKED`

Use if:

- a Critical/High product correctness/data-integrity defect remains;
- one of the three games cannot complete due to a real unresolved product defect;
- the SQLite failure remains reproducible and unresolved;
- release runtime cannot be validated;
- evidence becomes contradictory enough that certification is unsafe.

Do not invent a more favorable label.

---

## 18. Git completion contract

Before final handoff:

- review final diff;
- remove transient artifacts/secrets;
- do not commit APKs, AVD data, giant raw traces, or credentials;
- commit coherent checkpoints;
- push under existing repository policy;
- verify `HEAD == origin/main`;
- verify clean worktree except explicitly preserved user work;
- record starting SHA, final SHA, and validated product SHA.

Final CLI response must report:

- primary verdict;
- starting SHA;
- validated product SHA;
- final SHA;
- SQLite NPE disposition;
- three-game lifecycle result;
- release runtime/a11y result;
- state-matrix counts;
- compact/font-scale result;
- defects found/fixed/open by severity;
- repository test counts;
- build results;
- persistence/idempotency result;
- external CI classification;
- ARTEMIS/tooling actually used;
- human/platform pending items;
- whether product source changed;
- `HEAD == origin/main`;
- worktree state;
- safest next action.

---

## 19. Anti-premature-completion rules

Campaign 042 is **not complete** merely because:

- the emulator boots;
- the SQLite NPE fails to reproduce once;
- the three games reach their boards;
- a force-win hook produces a Result;
- debug accessibility is green;
- release APK launches;
- one release hierarchy capture succeeds;
- static screenshots look good;
- Jest passes;
- Expo Doctor is 21/21;
- old Campaign 041 evidence exists.

The three technical blockers must be genuinely closed or truthfully carried forward.

---

## 20. Tool authorization

Use all useful available tooling, including where available:

- ARTEMIS;
- computer use;
- Android emulator;
- ADB;
- UIAutomator;
- Maestro;
- SQLite tooling;
- repository QA harnesses;
- Gradle/Expo/Node;
- Git/GitHub;
- browser/research for platform/runtime documentation;
- parallel read-only subagents for source/history/test analysis.

ARTEMIS may assist with observation and interaction, but cross-check important conclusions independently.

---

## 21. Core directive

**Close the gaps that Campaign 041 exposed. Do not reopen the whole product.**

Attack the SQLite startup failure.

Close the three missing result lifecycles.

Get clean release-native hierarchy/accessibility evidence.

Finish the missing state matrix.

Fix only reproduced clipping or runtime defects.

Revalidate persistence and exactly-once behavior.

Then challenge the result with a second adversarial pass.

Only after that issue the Campaign 042 verdict.
