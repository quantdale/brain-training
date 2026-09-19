# Campaign 054 — Terminal Gap Closure & Release-Boundary Convergence

**Status:** READY FOR EXECUTION  
**Repository:** `quantdale/brain-training`  
**Mode:** exhaustive gap census → reproduce/classify → close every repository-owned or environment-available gap → final convergence  
**Starting point:** Campaign 053 terminally complete at `8350db21b0a5fc887580e39b24756533c5577e0a`  
**Primary objective:** leave no known repository-owned correctness, validation, documentation, tooling, runtime, or release-boundary gap unresolved before any new product/design campaign begins

---

## 0. Mission

Close the gaps.

Do not start a new feature wave.

Do not redesign the product.

Do not reopen already-closed architecture without evidence.

This campaign exists to reconcile everything that is still:

- unresolved;
- contradictory;
- stale;
- conditionally validated;
- only partially validated;
- historically carried forward after being superseded;
- external but potentially re-testable now;
- documented inconsistently;
- validated at an intermediate SHA but not at the final product SHA;
- technically green but not truthfully represented in durable state.

The goal is a **clean terminal baseline** before any next campaign.

This is not a ceremonial documentation pass.

Actually attempt to close every gap that can be closed with the current repository, environment, tools, accounts, emulator, and available platform access.

Where a gap genuinely cannot be closed because it requires unavailable human/platform/account/store/device capability, prove that boundary as far as practical and retain it as an explicit external/manual boundary.

Never convert unavailable evidence into PASS.

---

# 1. Start with a full gap census

Before implementation, discover all currently open or ambiguous gaps.

Read and cross-check at minimum:

- `.agent/KNOWN_ISSUES.md`
- `.agent/VALIDATION.md`
- `.agent/STATE.md`
- `.agent/GOVERNANCE.json`
- `.agent/CURRENT_CAMPAIGN.md`
- `.agent/EXECUTION_PROMPT.md`
- `.agent/DEFERRED_DECISIONS.md` if present
- `.agent/PARITY_MATRIX.md` if present
- `.agent/DEPENDENCY_AUDIT.md`
- `.agent/IMPACT_MAP.md`
- all current OpenSpec changes and archived validated changes
- Campaigns 041–053 closure/evidence packets
- current GitHub Actions state
- current dependency audit state
- current source/tests/build/runtime

Do not assume `.agent/KNOWN_ISSUES.md` is current merely because it is named "known issues."

Many entries may be historical and superseded.

Build a single authoritative ledger of current gaps.

Required artifact:

`docs/redesign/evidence/campaign054/GAP_CENSUS.md`

For every candidate gap record:

- ID;
- source document(s);
- first introduced campaign;
- current evidence;
- current status;
- whether superseded;
- whether reproducible now;
- owner class:
  - repository-owned;
  - tooling/environment;
  - external account/service;
  - manual human;
  - platform/device unavailable;
- severity;
- closure action;
- final disposition.

Allowed final dispositions:

- `CLOSED_VERIFIED`
- `SUPERSEDED_CLOSED`
- `ACCEPTED_TIME_BOUNDED_DEBT`
- `EXTERNAL_BLOCKER_VERIFIED`
- `MANUAL_PLATFORM_PENDING`
- `NOT_REPRODUCIBLE_WITH_BOUNDED_EVIDENCE`
- `OPEN_PRODUCT_DEFECT`

No vague "known issue" bucket.

---

# 2. Reconcile the Campaign 053 final validation-count mismatch

There is an explicit durable inconsistency that must be resolved first.

Current records disagree:

- terminal Campaign 053 commit message reports:
  - **564 suites**
  - **6,726 tests**
- Campaign 053 `change.json`, `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`, and evidence packet report:
  - **563 suites**
  - **6,724 tests**

Do not guess why.

Run the authoritative current full test command on the current final tree and capture the exact:

- total suites;
- passed suites;
- skipped suites;
- total tests;
- passed tests;
- skipped tests;
- snapshots;
- unexpected-console violations.

Identify exactly which additional suite/tests explain the difference, if any.

Reconcile all authoritative current Campaign 053/054 documentation to one truth.

Do not rewrite historical intermediate-commit counts where they were correct at the time; distinguish intermediate vs terminal counts explicitly.

Required artifact:

`docs/redesign/evidence/campaign054/VALIDATION_COUNT_RECONCILIATION.md`

---

# 3. Re-prove the exact current final SHA

Campaign 053 runtime evidence was built from an implementation checkpoint before terminal documentation/governance commits.

Establish whether any executable/product source changed after that runtime artifact.

If **no executable source changed**, prove it from Git diff/history and record that the prior release artifact still represents the product bits.

If executable source did change, build and validate an exact-final-SHA release artifact.

Prefer rebuilding the final release APK anyway if reasonable.

Record:

- exact current source SHA;
- release APK SHA-256;
- package/version;
- build mode;
- whether Metro is required;
- install result;
- cold launch result;
- force-stop/relaunch result;
- offline result;
- filtered fatal/ANR/SQLite/React markers.

Required artifact:

`docs/redesign/evidence/campaign054/FINAL_SHA_ARTIFACT_PROVENANCE.md`

---

# 4. Close stale historical gaps

Review older known-issue entries that later campaigns already repaired.

Examples that must be explicitly reconciled rather than silently left stale:

- Campaign 041 SQLite `NativeDatabase.prepareAsync` NPE;
- Campaign 041 39/42 result-lifecycle gap;
- Campaign 041 release XML/a11y gap;
- Campaign 041 compact/font-scale clipping;
- Campaign 042 Expo patch drift;
- Campaign 050/051 first-launch ANR observations;
- Campaign 050 Android Files provider/import-picker ANR;
- Campaign 044/050 external CI zero-step/account-policy classification;
- any old "conditional" labels that were later superseded technically.

For each one:

- verify whether later evidence truly closes it;
- if closed, mark it superseded and point to the closing campaign/evidence;
- if still relevant, reproduce or re-classify it now;
- remove misleading current-language that makes a closed defect look open.

Do not erase history.

Make current-state sections authoritative and historical sections clearly historical.

---

# 5. First-install / cold-start ANR closure

This is a release-risk observation that has survived multiple campaign records.

Aggressively determine its current status.

Use a dedicated automation-owned Android runtime.

Run a meaningful repeated matrix across:

- clean install;
- clear-data install;
- emulator cold boot;
- warm boot;
- first launch after install;
- second launch;
- force-stop/relaunch;
- offline first launch;
- release APK;
- relevant emulator graphics mode(s) if safe and bounded.

Record sample counts.

Capture:

- `am start -W` timing;
- activity state;
- logcat;
- ANR traces if any;
- system_server markers where useful;
- whether the dialog is app-owned or framework/system-only;
- whether startup completes behind the dialog;
- whether the issue reproduces on the exact current APK.

If reproduced:

- minimize;
- identify root cause;
- repair only if app-side;
- add regression coverage where feasible;
- repeat the matrix after repair.

If not reproduced:

- state the bounded evidence honestly;
- classify as `NOT_REPRODUCIBLE_WITH_BOUNDED_EVIDENCE`, not "impossible."

Required artifact:

`docs/redesign/evidence/campaign054/FIRST_INSTALL_STARTUP_CLOSURE.md`

---

# 6. Android Files provider / import-picker boundary closure

The previous import picker encountered an Android Files provider ANR.

Re-test this independently.

Separate:

- app behavior launching the picker;
- Android system/provider behavior;
- cancel path;
- successful selection path;
- malformed/oversized/corrupt file path where safe;
- return-to-app state;
- import preview;
- import cancel;
- actual disposable import if supported and safe.

Use only disposable data.

If system provider fails:

- capture system-level evidence;
- determine whether app invocation is valid;
- try a clean emulator/provider reset if safe;
- retry boundedly;
- classify external if the app is invoking the contract correctly.

If app-side intent/configuration is wrong:

- fix it;
- add regression coverage;
- retest.

Required artifact:

`docs/redesign/evidence/campaign054/SYSTEM_PROVIDER_IMPORT_CLOSURE.md`

---

# 7. External GitHub Actions gap

Re-query the four current workflows:

- Repository Integrity
- App CI
- Android Build Smoke
- iOS Build Smoke

Inspect:

- latest run IDs;
- event;
- head SHA;
- jobs;
- steps;
- annotations;
- runner labels;
- available logs;
- account/payment/policy indicators;
- whether any repository command executed;
- whether the failure condition changed since Campaign 044/053.

If the linked account now exposes enough control to fix the external account/policy issue safely, do so only if authorized by existing account configuration and no billing purchase/financial action is required.

Do **not** change workflow YAML to mask an external failure.

Classify exactly:

- `PASS`
- `REPOSITORY_WORKFLOW_DEFECT`
- `RUNNER_INFRASTRUCTURE`
- `ACCOUNT_OR_POLICY`
- `GITHUB_TRANSIENT`
- `INDETERMINATE_EXTERNAL_PRE_STEP`

If repository-side, repair and validate.

If external, preserve as `EXTERNAL_BLOCKER_VERIFIED`.

Required artifact:

`docs/redesign/evidence/campaign054/EXTERNAL_CI_FINAL_CLASSIFICATION.md`

---

# 8. Dependency/security debt closure

Re-run the current dependency/security audit.

Verify every accepted advisory entry.

For each accepted item:

- exact package path;
- production reachability;
- severity;
- compatible remediation availability;
- current ecosystem state;
- expiry/review date;
- whether defense-in-depth exists;
- whether the disposition is still justified.

Especially re-check the Expo Router → query-string → decode-uri-component advisory.

Do not rely solely on Campaign 053's conclusion if package metadata/current lockfile differs now.

If a safe compatible remediation now exists, isolate and apply it.

If not, keep a time-bounded accepted disposition.

No broad `npm audit fix --force`.

Required artifact:

`docs/redesign/evidence/campaign054/DEPENDENCY_SECURITY_CLOSURE.md`

---

# 9. Skips, probes, quarantines, exemptions, allowlists

Inventory every current:

- skipped test;
- opt-in test;
- quarantine;
- allowlist;
- expected-warning exception;
- dependency exception;
- catalog exemption mechanism;
- platform-specific skip;
- TODO/FIXME that is treated as validation debt.

For each one, classify:

- intentionally opt-in and executed elsewhere;
- impossible in current environment;
- obsolete and removable;
- unjustified gap;
- real product debt.

Execute every safe opt-in probe.

Ensure no skip is hiding a normal functional test.

Ensure the unexpected-console baseline remains empty.

Ensure the 42-game persistence exemption roster remains empty unless current evidence requires an exemption.

Required artifact:

`docs/redesign/evidence/campaign054/SKIP_ALLOWLIST_EXEMPTION_AUDIT.md`

---

# 10. OpenSpec / governance / durable-state consistency

Validate that current OpenSpec/governance truth agrees everywhere.

Check:

- `GOVERNANCE.json`;
- `STATE.md`;
- `CURRENT_CAMPAIGN.md`;
- `EXECUTION_PROMPT.md`;
- task ownership;
- active/last campaign;
- Campaign 053 status;
- Campaign 054 activation/closure state;
- OpenSpec change status;
- archived vs active changes;
- evidence references;
- known issues;
- deferred decisions;
- parity matrix;
- validation counts.

Repair contradictions.

Do not rewrite historical evidence merely to make files look uniform.

Current state must be unambiguous.

Run strict OpenSpec validation after reconciliation.

Required artifact:

`docs/redesign/evidence/campaign054/DURABLE_STATE_CONSISTENCY.md`

---

# 11. Full current regression matrix

After all repository-owned repairs are complete, run the strongest current matrix.

At minimum:

- full Jest / CI-mode test command;
- unexpected-console gate;
- all opt-in probes;
- typecheck;
- lint;
- Expo Doctor;
- OpenSpec strict;
- repository-state validator;
- task ownership;
- affected-map sync/strict;
- registry generation/check;
- offline validator;
- secrets validator;
- provenance;
- workflow hygiene;
- dependency audit/policy;
- runtime QA contract;
- web export;
- Android debug build;
- Android release build.

If any additional authoritative validator exists, include it.

Record exact counts.

Required artifact:

`docs/redesign/evidence/campaign054/FINAL_REPOSITORY_MATRIX.md`

---

# 12. Final Android runtime convergence

Use the exact final release artifact.

At minimum verify:

- clean install;
- first launch;
- Home;
- Games;
- Game Detail;
- representative gameplay;
- Result;
- four-game workout;
- force-stop/relaunch;
- offline;
- invalid route;
- oversized/malformed route envelope;
- startup recovery screen fault path;
- recovery back to Home;
- export/share reachability;
- import picker cancel/success where environment permits;
- SQLite integrity;
- no duplicate sessions/rewards/currency in exercised flows;
- no filtered fatal/ANR/OOM/SIGSEGV/SQLite fatal markers.

Do not repeat the entire 66-capture visual campaign unless needed.

This is closure, not visual redesign.

Required artifact:

`docs/redesign/evidence/campaign054/FINAL_ANDROID_CONVERGENCE.md`

---

# 13. Human/platform boundary attempt

Before simply carrying forward manual boundaries, check whether the current environment actually provides any of them now.

Inspect availability of:

- authorized physical Android;
- iOS/macOS runtime;
- TalkBack technical traversal;
- VoiceOver;
- production signing assets;
- store-install path;
- independent human participant.

Use them only if genuinely available and authorized.

Do not fabricate.

If unavailable, retain exact status:

- `MANUAL_PLATFORM_PENDING`

Create a minimal executable handoff for each remaining manual item.

Required artifact:

`docs/redesign/evidence/campaign054/MANUAL_PLATFORM_BOUNDARIES.md`

---

# 14. No new product work

This campaign is allowed to repair defects required to close gaps.

It is **not** allowed to:

- add product features;
- redesign UI;
- modify game mechanics for taste;
- change scoring/economy semantics;
- perform broad architectural rewrites without a reproduced closure blocker;
- start another visual campaign;
- perform unrelated cleanup.

Every source change must map to a current gap in `GAP_CENSUS.md`.

---

# 15. Repair protocol

For every repository-owned defect repaired:

1. reproduce;
2. minimize;
3. identify root cause;
4. classify severity;
5. add regression coverage;
6. make the smallest coherent fix;
7. focused validation;
8. broad validation;
9. exact-final-runtime validation where relevant;
10. update gap ledger.

No fake green.

Do not:

- weaken tests;
- expand warning allowlists;
- suppress logs;
- disable a11y;
- hide CI failures;
- skip failing states;
- relabel tool failure as product pass.

---

# 16. Adversarial second pass

After the gap ledger appears closed, independently challenge it.

Look specifically for:

- stale known issues still worded as current;
- validation count mismatch;
- intermediate SHA evidence presented as final-SHA evidence;
- opt-in tests not actually executed;
- accepted dependency debt with expired review;
- old conditional campaign language that conflicts with current proof;
- first-install ANR evidence being hand-waved;
- system-provider failure incorrectly blamed on app or vice versa;
- CI external classification without current run evidence;
- local debug signing being described as production release;
- missing final exact artifact hash;
- dirty state or unpushed evidence;
- "closed" gaps that are only untested.

Required artifact:

`docs/redesign/evidence/campaign054/ADVERSARIAL_GAP_REVIEW.md`

---

# 17. Terminal current-state ledger

Create:

`docs/redesign/evidence/campaign054/TERMINAL_GAP_LEDGER.md`

This must be the definitive current-state summary.

It should list every gap from the census and its final disposition.

At the top include totals:

- Closed verified
- Superseded closed
- Accepted time-bounded debt
- External blockers verified
- Manual/platform pending
- Not reproduced with bounded evidence
- Open product defects

The desired terminal condition is:

**0 open repository-owned product defects of Critical/High/Medium severity.**

Low issues may remain only if explicitly accepted with rationale.

External/manual boundaries may remain only when genuinely unavailable.

---

# 18. Final verdict

Use exactly one:

### `CAMPAIGN_054_GAPS_CLOSED`

Only if:

- all repository-owned Critical/High/Medium gaps are closed;
- validation-count inconsistency is reconciled;
- durable docs/governance are consistent;
- exact final artifact provenance is established;
- first-install ANR is fixed or boundedly non-reproduced/classified;
- Files/import-provider boundary is closed or proven external;
- current external CI classification is refreshed;
- dependency dispositions are current;
- all safe opt-in probes are executed;
- final repository matrix passes;
- final Android convergence passes;
- adversarial review finds no hidden repository-owned blocker;
- remaining gaps are exclusively accepted time-bounded debt, verified external blockers, or genuine manual/platform pending items.

### `CAMPAIGN_054_CONDITIONAL`

Use if the repository-owned core is strong but a material current repository-owned Medium gap remains unresolved or evidence is still contradictory.

### `CAMPAIGN_054_BLOCKED`

Use if:

- Critical/High current defect remains;
- persistence/data integrity fails;
- exact final release artifact cannot be validated;
- current evidence materially contradicts claimed closure.

Do not invent a stronger label.

---

# 19. Git completion

Commit coherent repairs/evidence.

Before terminal response:

- inspect final diff;
- remove transient artifacts/secrets;
- fetch;
- reconcile concurrent work safely;
- push;
- verify `HEAD == origin/main`;
- verify clean worktree;
- verify no abandoned temporary worktrees/branches/stashes created by this campaign.

Update current governance/durable state to reflect Campaign 054 truth.

Do not leave Campaign 054 marked active after terminal closure.

---

# 20. Final CLI response

Report:

- verdict;
- starting SHA;
- validated product/source SHA;
- final SHA;
- exact final APK SHA-256;
- gap census total;
- CLOSED_VERIFIED count;
- SUPERSEDED_CLOSED count;
- ACCEPTED_TIME_BOUNDED_DEBT count;
- EXTERNAL_BLOCKER_VERIFIED count;
- MANUAL_PLATFORM_PENDING count;
- NOT_REPRODUCIBLE_WITH_BOUNDED_EVIDENCE count;
- OPEN_PRODUCT_DEFECT count;
- validation-count reconciliation result;
- first-install ANR disposition;
- Files/import-provider disposition;
- external CI classification;
- dependency/security disposition;
- skips/probes/allowlists disposition;
- final Jest counts;
- OpenSpec result;
- Android runtime result;
- remaining manual/platform boundaries;
- whether product source changed;
- HEAD/origin relationship;
- worktree state;
- safest next action.

---

# Core directive

**Close everything that can honestly be closed before the next campaign.**

Do not carry stale gaps forward.

Do not erase history.

Do not fabricate unavailable evidence.

Do not start new product work.

When Campaign 054 ends, the repository should have one coherent answer to:

> What is still actually open right now?

And that answer should contain no unresolved repository-owned Critical/High/Medium correctness gap.
