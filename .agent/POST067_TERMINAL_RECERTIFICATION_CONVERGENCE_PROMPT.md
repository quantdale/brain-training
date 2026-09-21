# Post-067 Terminal Re-certification & Convergence Closure

**Status:** READY FOR EXECUTION  
**Repository:** `quantdale/brain-training`  
**Mode:** terminal closure / no new numbered change  
**Do not create Change 068**  
**Current repository baseline before this prompt:** `2a765ccf5184fb88ea90de32e21e02905789a557`  
**Numbered program:** Changes 056→067 are already `VALIDATED`  
**Current hardening verdict:** `POST_067_HARDENING_COMPLETE`  
**Current hardening build:** `146F63BF42886CEC34C4B86DBD6085CA7BD60B53FE2514A08EC23B7D9DEEE127` (109,602,821 bytes)  
**Prior Change-067 certified artifact:** `B7AA4102…` from `a17c019` — HISTORICAL after hardening source changes  
**Goal:** terminally re-certify the **post-hardening executable tree**, complete the literal convergence requirements from the overnight master prompt, reconcile durable state, and close the entire 056→067 + hardening program truthfully.

---

# 0. Why this session exists

The overnight numbered program succeeded:

- 056 through 067 are all terminally `VALIDATED`;
- Change 067 certified artifact `B7AA4102…`;
- the post-067 hardening phase then found and repaired additional executable defects, including a real High product defect (42-screen deep-link exit dead-end) plus import/export, lifecycle, a11y, and tooling issues;
- the hardening tree built artifact `146F63BF…`.

However, the repository's own current hardening closure explicitly states:

> the 067-certified artifact predates the hardening fixes, and a future release certification must re-issue the 067 matrix on a build from the hardening tree.

That final certification is mandatory under the original overnight master prompt and has not yet been performed on the post-hardening executable tree.

There is also a durable-state inconsistency:

- the top line of `.agent/STATE.md` still says the overnight program is active and Change 066 is open;
- later sections correctly say the program is COMPLETE and 067/hardening are closed.

Finally, the master prompt required **at least three independent full-repository hardening passes**, followed by a fresh residual census. The existing Pass A/B/C were specialized lanes inside a single Wave 1. They were valuable, but do not literally satisfy the requested "three full-repository passes."

This session closes those exact gaps.

---

# 1. Hard boundaries

## 1.1 Do NOT create Change 068

Do not create:

- Change 068;
- another OpenSpec change;
- a new product campaign;
- a redesign campaign.

Continue the already completed 056→067 program as a terminal re-certification/convergence closure.

## 1.2 Do NOT reopen validated numbered changes casually

Changes 056→067 are historical and terminal.

If current evidence exposes a regression in behavior they introduced, fix the current product and update terminal evidence, but do not rewrite history.

## 1.3 Do NOT stop after merely building an APK

The current gap is full exact-artifact certification and literal convergence.

A successful build alone is insufficient.

---

# 2. Read current truth first

Before changing anything, read:

- `.agent/CAMPAIGN056_067_OVERNIGHT_AUTONOMOUS_PROGRAM_PROMPT.md`
- `.agent/OVERNIGHT_056_067_STATE.md`
- `.agent/STATE.md`
- `.agent/VALIDATION.md`
- `.agent/GOVERNANCE.json`
- `.agent/CURRENT_CAMPAIGN.md`
- `.agent/EXECUTION_PROMPT.md`
- `.agent/BACKLOG.md`
- `docs/hardening/post067/README.md`
- `docs/hardening/post067/PASS_A_STATIC.md`
- `docs/hardening/post067/PASS_B_RUNTIME.md`
- `docs/hardening/post067/PASS_C_RELEASE_UX.md`
- `docs/hardening/post067/CONVERGENCE_LOG.md`
- `docs/hardening/post067/HARDENING_CLOSURE.md`
- the complete evidence set under `docs/redesign/evidence/campaign067/`
- `openspec/changes/067-terminal-whole-product-certification/change.json`
- all current 056–067 `change.json` files

Verify independently that 056–067 remain `VALIDATED`.

Do not trust summaries over executable current truth.

---

# 3. Git safety and exact baseline

At startup:

1. fetch remote `main`;
2. safely fast-forward/reconcile;
3. record exact starting SHA;
4. inspect `HEAD` vs `origin/main`;
5. inspect tracked and untracked state;
6. inspect worktrees;
7. inspect local branches;
8. inspect stashes;
9. preserve unrelated user configuration/work.

Never:

- force-push;
- reset away unknown work;
- delete unrelated untracked files;
- kill concurrent work;
- rewrite published history.

The prompt commit itself is docs-only. Distinguish:

- repository HEAD;
- executable source tree;
- final executable checkpoint;
- final certified artifact.

---

# 4. Establish the current post-hardening executable tree

The first technical task is to identify exactly what executable code is current after post-067 hardening.

Determine:

- which executable files changed after `a17c019`;
- whether all hardening executable edits are contained in `2a765cc`;
- whether anything newer has changed executable source;
- whether the existing `146F63BF…` artifact was built from that exact executable tree.

Do not assume the current hardening artifact is final simply because it exists.

If current executable source is unchanged from the hardening build's source, record that relationship.

If it cannot be proven, rebuild later from a clean frozen current tree.

---

# 5. Three independent FULL-repository residual passes

This is mandatory.

The prior Pass A/B/C were specialized lanes within one hardening wave. This session must execute **at least three independent full-repository residual passes**.

Each pass must review the whole repository and all major executable domains, not merely one specialty.

Use parallel read-only subagents aggressively, but the orchestrator owns decisions and shared files.

For each pass inspect, at minimum:

- app shell/bootstrap/routing;
- all 42 game registrations and shared game infrastructure;
- GameHost/tutorial/results;
- workout lifecycle;
- rating/progression;
- XP/currency/rewards/economy;
- persistence/SQLite/transactions/migrations;
- backup/import/export;
- offline behavior;
- settings/theme/reduced motion;
- discovery/progress/profile/rewards;
- native Android config/build;
- security/privacy/input validation;
- dependencies;
- test architecture;
- validators/allowlists/probes;
- accessibility/responsive behavior;
- runtime lifecycle/performance;
- OpenSpec/governance/state;
- historical regression archetypes.

Do not limit passes to grep/TODO scans.

## Pass R1 — Current-tree invariant attack

Start fresh from source and runtime contracts.

Look for:

- broken invariants;
- race/reentrancy;
- state ownership;
- transaction boundaries;
- unsafe assumptions;
- malformed input;
- null/undefined;
- cleanup/lifecycle;
- cross-component contract drift;
- security/input/path issues;
- executable holes not covered by current gates.

This is a full-repo pass.

## Pass R2 — Historical reintroduction and test-blindness attack

Again inspect the whole repository independently, but seed from:

- historical bugs;
- fixes from 055–067;
- post-067 defects;
- old campaign evidence;
- Git history;
- closed regression classes;
- tests that could pass while behavior is wrong;
- allowlist/skip/probe blind spots;
- source patterns that may reintroduce fixed defects.

Explicitly attack reintroduction of:

- HUD/action clipping;
- tutorial dead-end;
- duplicate/raw result presentation;
- deep-link exit dead-end;
- progression fingerprint/bootstrap failure;
- transaction FK/idempotency issues;
- duplicate economy operations;
- stale focus sync;
- import amplification/bounds;
- undersized touch targets.

This is also a full-repo pass, not just a history scan.

## Pass R3 — Production artifact and hostile-journey attack

Inspect the whole repository again from the perspective of what can fail in production:

- build/package assumptions;
- offline;
- process death/relaunch;
- malformed routes;
- partial workflows;
- stale persisted state;
- corrupted/malformed import;
- repeated actions;
- hostile navigation;
- accessibility;
- long text/font scale;
- dark mode;
- errors/loading/empty states;
- resource/performance hotspots;
- release diagnostics.

This must include current-source reasoning plus targeted runtime planning.

## If any material executable issue is fixed during R1/R2/R3

After the final fix:

- run at least **one additional fresh whole-repository residual pass** over the post-fix tree;
- do not count a pass performed before the fix as proof the new tree converged;
- continue until the latest whole-repo pass finds no new repository-owned Critical/High/Medium issue.

Record all passes in:

`docs/hardening/post067/TERMINAL_RECERT_CONVERGENCE.md`

with:

- pass;
- investigators;
- scope;
- findings;
- severity;
- fixes;
- evidence;
- disposition;
- residual census.

---

# 6. Finding disposition

Every new or revisited finding must end as one of:

- `CLOSED_VERIFIED`
- `LOW_ACCEPTED_DEBT`
- `ACCEPTED_TIME_BOUNDED_DEBT`
- `EXTERNAL_BLOCKER_VERIFIED`
- `MANUAL_PLATFORM_PENDING`
- `NOT_REPRODUCIBLE_WITH_BOUNDED_EVIDENCE`
- `OPEN_PRODUCT_DEFECT`

Do not bury unresolved defects in prose.

Terminal target:

- Critical: 0 open
- High: 0 open
- Medium: 0 repository-owned open

A Low accepted debt must have concrete rationale and no disguised correctness defect.

---

# 7. Source freeze and artifact invalidation rule

After all residual-pass fixes are complete:

1. run focused validation;
2. inspect the complete executable diff;
3. create or identify one exact **final executable checkpoint**;
4. ensure no executable source changes after that checkpoint;
5. build a fresh release APK from that exact tree.

The old Change-067 artifact `B7AA4102…` is historical.

The existing hardening artifact `146F63BF…` is also **not automatically authoritative** because it has not undergone the complete terminal matrix.

A fresh build after convergence is preferred.

Record:

- final executable checkpoint SHA;
- repository SHA used for build;
- bundle hash;
- APK SHA-256;
- APK size;
- package/version;
- signing status;
- Metro independence;
- permission set.

If ANY executable source changes after the artifact is built:

**invalidate it, rebuild, and restart all artifact-dependent certification lanes.**

Docs-only evidence/governance updates may occur afterward, but prove executable source remained unchanged.

---

# 8. Authoritative repository matrix

On the final executable tree run the strongest current repository matrix.

At minimum:

- full gated Jest;
- Jest signal/floor checks;
- unexpected-console gate;
- every current opt-in probe;
- typecheck;
- lint;
- Expo Doctor;
- OpenSpec strict;
- repo-state;
- task ownership;
- affected-map sync;
- registry generation/check;
- provenance;
- offline;
- secrets;
- workflow hygiene;
- dependency audit;
- runtime-QA contract;
- permission policy;
- web export;
- Android debug build;
- Android release build.

Record exact:

- suites passed/skipped;
- tests passed/skipped;
- snapshots;
- console count;
- probe suite/test counts;
- durations where useful.

Do not reuse the prior 598 / 6,933 counts if the tree changed.

---

# 9. Exact-artifact bundle/provenance proof

For the final release APK verify:

- embedded JS bundle corresponds to the final source;
- current freshness markers pass;
- permission set matches policy;
- package/version expected;
- Metro is not required at runtime;
- signing status is explicitly recorded.

Use current repository provenance tooling.

Do not certify an artifact whose bundle/source relationship is ambiguous.

---

# 10. Android runtime ownership and safety

Use only a verified Brain Training-owned emulator.

Known-good Campaign 055/067 profile:

- AVD `braintraining-ui35`
- Android API 35
- emulator 37.1.11
- valid `-gpu host`

Verify ownership before ADB commands.

Do not touch:

- `emulator-5556`;
- unrelated AVDs;
- other project runtimes;
- physical devices not explicitly dedicated.

Prefer serial-scoped ADB.

Do not use the obsolete `-gpu swiftshader_indirect` value.

Do not use an `aosp_atd` image for pixel certification if it cannot composite app frames.

---

# 11. Full post-hardening native re-certification

Run the **complete Change-067-style native matrix again** on the new exact final artifact.

This is not a bounded canary.

## 11.1 Install/startup/lifecycle

At minimum:

- uninstall / clean install;
- true first launch;
- cold launch where environment permits;
- warm launch;
- force-stop/relaunch;
- offline launch;
- return online;
- repeated launch sanity;
- 0 app ANR/fatal.

Record launch timings separately from pass/fail.

## 11.2 Routing and recovery

Run all canonical route/recovery probes from 067, including current equivalents of:

- normal tab routes;
- Game Detail;
- malformed game id;
- oversized game id;
- malformed/oversized result route;
- malformed workout provenance;
- safe-back/deep-link exit.

Explicitly prove the **post-hardening 42-screen deep-link exit fix** on the exact final artifact.

At minimum one deep-linked game:

deep link → Game Detail / game → active state → pause → Quit/back → lands on Games safely.

Also run the repository's reintroduction guard.

## 11.3 Core product journey

Exercise:

- Home;
- Games;
- search/filter;
- Game Detail across representative/all required domains;
- tutorial;
- active gameplay;
- in-session Result;
- route Result;
- Progress;
- Profile;
- Rewards;
- settings/data-management flows relevant to hardened code.

## 11.4 Results

Prove:

- real weak completion remains honest;
- no duplicate raw/unrounded score;
- reward/persistence correct;
- no false PB.

If deterministic safe paths exist for mid/strong results, exercise them.

Do not invent scores solely to satisfy a checkbox.

## 11.5 Full four-game workout

Mandatory on the final artifact.

Complete a normal 4-leg workout:

- leg 1 → Next
- leg 2 → Next
- leg 3 → Next
- leg 4 → Finish
- Home shows 4/4 saved/completed
- force-stop/relaunch preserves completion
- no stale in-progress instance
- no duplicate advancement/economy effects.

Use real game flows. QA helpers may assist deterministic setup only where repository policy permits; do not call a force-win hook mechanic certification.

---

# 12. Backup/import/export re-certification

Post-067 hardening modified import bounds and export-memory behavior, so validate these on the exact final tree/artifact.

At minimum:

- export produces valid expected data;
- exported data round-trips through the supported import path;
- provider/picker open + cancel;
- malformed input rejection;
- oversized/upper-bound protection;
- deep nesting rejection;
- prototype-pollution-safe canonicalization behavior;
- no partial state applied on rejected import;
- idempotent/duplicate-safe merge behavior where applicable.

Attempt the previously deferred **two-tap UI import/apply** path if the current environment supports it.

If system-provider automation truly prevents that exact human interaction:

- document the bounded technical evidence;
- preserve it as MANUAL/NOT VALIDATED;
- do not claim it passed.

Do not weaken bounds to make tests pass.

---

# 13. SQLite / persistence terminal audit

After the final workout and import/export exercise, audit the canonical database.

At minimum:

- `PRAGMA integrity_check`;
- `PRAGMA foreign_key_check`;
- schema/user_version;
- duplicate session ids;
- duplicate currency-ledger operation ids;
- duplicate rating operations;
- duplicate tutorial/progression rows where current invariants apply;
- workout terminal state;
- stale in-progress workouts;
- progression/catalog integrity;
- reward/currency conservation/idempotency;
- current migration contiguity.

Also specifically verify post-hardening transaction/FK behavior remains active on the real connection.

---

# 14. Log / crash review

Capture the full terminal native session log.

Scan and attribute:

- FATAL EXCEPTION;
- ANR;
- SIGSEGV;
- OOM;
- SQLite corruption/lock/fatal;
- ReactNativeJS error/fatal;
- RedBox/LogBox;
- unhandled rejection;
- repeated warning storms;
- app-owned unexpected console.

Do not misclassify OS/emulator noise as an app defect.

Do not ignore a real app failure merely because recovery occurred.

Record total log lines and counts.

---

# 15. Full six-way pixel / accessibility matrix

Because post-067 hardening changed executable UI/accessibility behavior, rerun the canonical matrix on the exact final APK:

1. default / light
2. default / dark
3. compact / light
4. compact / dark
5. font-scale-2 / light
6. font-scale-2 / dark

Use the repository's canonical capture tooling.

At minimum 11 canonical surfaces per combination unless the harness has legitimately evolved.

Expected canonical count is therefore at least:

**66/66 valid canonical captures**

plus targeted interaction captures for hardened areas where useful.

Pixel validity requirements:

- real composited frames;
- nonblank;
- nonuniform;
- correct dimensions;
- no stale duplicate frame;
- route verified;
- no system dialog obscuring app.

## 15.1 Specifically re-prove post-hardening UI fixes

Include evidence for:

- Progress period tabs at true 44 dp;
- deep-link game exit navigation;
- radio semantics;
- grid accessibility;
- any current occlusion-classification logic;
- font-scale-2 scrolling/visibility.

## 15.2 Accessibility terminal requirements

Across the final matrix:

- 0 unlabelled interactive nodes;
- 0 decorative leaks;
- 0 unresolved TRUE_UNDERSIZED_TARGET;
- no primary action inaccessible;
- no blocking actionable clipping.

Distinguish:

- compliant via real parent/hitSlop;
- clipped-but-reachable in verified scroll container;
- measurement artifact;
- true defect.

Do not manipulate density to hide findings.

---

# 16. Performance/resource sanity

The post-hardening tree changed:

- focus synchronization;
- export behavior;
- shared reduced-motion subscription;
- state persistence placement.

Re-run:

- every current performance/large-backup opt-in probe;
- startup sanity;
- Games scroll/load sanity;
- Progress navigation/focus churn;
- representative gameplay;
- export large-data probe;
- repeated theme/reduced-motion subscription sanity where observable.

Look for:

- regression in launch time;
- duplicate focus fetches;
- listener leaks;
- timer/animation leakage;
- export memory amplification;
- repeated render storms.

Do not turn this into benchmark theater; compare against same-host prior evidence where meaningful.

---

# 17. Security/release sanity

Re-run and inspect current security/release gates:

- secrets scanner;
- dependency policy;
- offline banned-specifier/runtime checks;
- permission deny-by-default gate;
- provenance;
- malformed import protections;
- prototype-safe canonicalization;
- logging/privacy review for touched paths.

Review accepted advisories/debt expiries.

Do not silently renew waivers.

---

# 18. Durable-state reconciliation

This session must fix current contradictory durable state.

At minimum, the top of `.agent/STATE.md` must no longer claim:

- program active;
- 056–065 only complete;
- Change 066 open.

Reconcile all current truth across:

- `.agent/STATE.md`
- `.agent/VALIDATION.md`
- `.agent/GOVERNANCE.json`
- `.agent/OVERNIGHT_056_067_STATE.md`
- `.agent/CURRENT_CAMPAIGN.md`
- `.agent/EXECUTION_PROMPT.md`
- `.agent/BACKLOG.md`
- task ownership/current program state.

Inspect repository conventions before deciding whether `activeProgram` should:

- be removed/null; or
- remain as a historical completed object.

Either is acceptable only if validators and all durable prose agree.

There must be no contradictory "active" state after terminal closure.

---

# 19. Update hardening evidence truthfully

Update:

- `docs/hardening/post067/HARDENING_CLOSURE.md`
- `docs/hardening/post067/CONVERGENCE_LOG.md`

Add:

- `docs/hardening/post067/TERMINAL_RECERT_CONVERGENCE.md`
- `docs/hardening/post067/FINAL_POST_HARDENING_CERTIFICATION.md`

The hardening closure must no longer say:

> a future release certification must re-issue the 067 matrix

if this session actually completes it.

Instead, record:

- exact final executable checkpoint;
- exact final APK;
- three whole-repo residual passes;
- any additional post-fix pass;
- full repository matrix;
- native matrix;
- workout;
- SQLite;
- logs;
- six-way pixels;
- a11y;
- residual disposition;
- manual/external boundaries.

Preserve the historical 067 artifact and `146F63BF…` hardening build as historical intermediates.

Do not rewrite them as though they were never valid for their original scopes.

---

# 20. OpenSpec handling

Do not create a new change.

All 056–067 should remain `VALIDATED`.

Re-run:

`openspec validate --all --strict`

If current terminal re-certification materially changes the current-artifact truth described in Change 067 evidence, update the **validation note/evidence references** only if repository conventions permit without falsifying the historical certification.

Do not pretend the post-hardening artifact was the original 067 artifact.

Maintain distinction:

- Change 067 certified pre-hardening artifact;
- later post-hardening terminal artifact is the current release candidate.

---

# 21. Manual/external boundaries

Keep explicit boundaries for anything genuinely unavailable, such as:

- human TalkBack/VoiceOver quality;
- physical/OEM devices;
- iOS runtime;
- production/store signing;
- store install;
- external CI/account policy;
- human system-provider usability.

Attempt currently automatable lanes.

Do not let manual/external boundaries hide repository-owned defects.

---

# 22. Final adversarial closure review

Before marking terminal completion, assign an independent critic to answer:

### Artifact
- Is this APK built from the actual post-hardening final executable tree?
- Did executable source change afterward?
- Is bundle freshness proven?
- Are permissions correct?

### Hardening
- Were three independent whole-repository passes really performed?
- If fixes landed, was there a fresh post-fix whole-repo pass?
- Are any repository-owned Critical/High/Medium findings still open?
- Were accepted Low/debt items classified honestly?

### Runtime
- Was the full 067-style native matrix rerun?
- Was the deep-link exit fix proven on the final artifact?
- Was the full 4-game workout rerun?
- Was SQLite audited afterward?
- Were logs clean?

### Import/export
- Were post-hardening import bounds/export memory changes exercised?
- Is any exact UI-provider step still manual and labeled correctly?

### Pixels/a11y
- Were all six matrices captured on the final artifact?
- Are all captures real/nonblank?
- Are Progress tabs truly 44 dp?
- Any unlabelled nodes/decorative leaks/true undersized targets?
- Any blocking font-scale/compact/dark regression?

### Governance
- Does `.agent/STATE.md` tell one consistent terminal story?
- Does governance agree?
- Does ledger agree?
- Are 056–067 all VALIDATED?
- Is there no fake active campaign/program?

If any mandatory answer is unsupported, do not use the terminal COMPLETE verdict.

---

# 23. Terminal verdicts

Use exactly one:

## `POST_067_TERMINAL_RECERTIFICATION_COMPLETE`

Requires:

- at least three independent whole-repo residual passes;
- fresh post-fix pass if material executable fixes landed late;
- 0 open repository-owned Critical/High/Medium defects;
- one exact final post-hardening artifact;
- full repository matrix green;
- full 067-style native matrix green;
- full 4-game workout green;
- SQLite terminal audit green;
- log review green;
- complete six-way pixel/a11y matrix green;
- post-hardening import/export hardening exercised;
- durable state reconciled;
- OpenSpec strict green;
- Git synchronized/clean.

Overall program terminal state should also record:

`PROGRAM_056_067_AND_POST_HARDENING_TERMINAL_COMPLETE`

## `POST_067_TERMINAL_RECERTIFICATION_PARTIAL`

Use only if product work is coherent but a required terminal evidence lane is genuinely unavailable.

## `POST_067_TERMINAL_RECERTIFICATION_BLOCKED`

Use if a current product correctness/release defect prevents safe certification and cannot be closed in this session.

---

# 24. Git completion

Use coherent commits.

A reasonable sequence:

1. residual-pass evidence / current-tree census;
2. bounded fixes, if any;
3. final executable source checkpoint;
4. exact artifact build + repository/native/pixel certification;
5. durable-state/evidence terminal closure.

Before final response:

- fetch remote;
- reconcile safely;
- push;
- verify `HEAD == origin/main`;
- tracked worktree clean;
- no abandoned temporary branches;
- no abandoned worktrees;
- no session-created stash;
- preserve unrelated untracked user config.

---

# 25. Final report

Report:

## Identity
- verdict;
- overall program verdict;
- starting SHA;
- final executable checkpoint SHA;
- final repository SHA;
- final APK SHA-256;
- APK size;
- bundle SHA-256;
- package/version/signing/Metro status.

## Residual convergence
- R1 findings;
- R2 findings;
- R3 findings;
- any post-fix R4+ findings;
- counts by severity/disposition;
- final open Critical/High/Medium count.

## Repository
- suites passed/skipped;
- tests passed/skipped;
- snapshots;
- console result;
- probe counts;
- typecheck/lint/Doctor;
- all validators;
- OpenSpec strict;
- debug/release build results.

## Runtime
- AVD/serial;
- startup/lifecycle;
- routes/recovery;
- deep-link exit fix;
- provider/import/export;
- weak/mid/strong result coverage;
- 4-game workout;
- relaunch retention;
- SQLite;
- logs.

## Pixels/a11y
- six-way matrix;
- capture count;
- blank/duplicate count;
- unlabelled nodes;
- decorative leaks;
- true undersized targets;
- Progress tab verification;
- remaining low visual debt.

## State
- 056–067 statuses;
- post-hardening status;
- `.agent/STATE.md` reconciliation;
- governance/ledger consistency.

## Remaining boundaries
Separate:

- manual;
- external;
- accepted time-bounded debt;
- low accepted debt;
- bounded non-reproduced historical issues.

## Git
- `HEAD == origin/main`;
- clean tracked tree;
- worktrees;
- branches;
- stashes.

## Next action
State clearly whether the entire 056→067 + post-hardening program is now genuinely terminal and safe to leave closed.

---

# Core directive

**Do not create Change 068.**

**Do not add speculative features.**

**Do not redo already-proven work without reason.**

Finish the exact missing obligations from the overnight master directive:

1. perform at least three genuine whole-repository residual passes;
2. close any newly substantiated material issue;
3. freeze the post-hardening executable tree;
4. build one exact final artifact;
5. re-run the full Change-067-style certification on that artifact;
6. rerun the six-way pixel/a11y matrix;
7. rerun the full workout, SQLite, logs, and import/export hardening checks;
8. reconcile contradictory durable state;
9. replace the "future re-certification required" handoff with completed evidence;
10. only then declare the 056→067 + post-hardening program terminal.
