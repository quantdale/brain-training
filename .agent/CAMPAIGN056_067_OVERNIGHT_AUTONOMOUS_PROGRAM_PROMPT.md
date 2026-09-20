# Campaign 056→067 — Overnight Autonomous Program + Post-067 Full Repository Hardening

**Status:** READY FOR EXECUTION  
**Repository:** `quantdale/brain-training`  
**Canonical branch:** `main`  
**Owner mode:** **NIGHT / OVERNIGHT AUTONOMOUS EXECUTION AUTHORIZED**  
**Pre-prompt terminal baseline:** `73525cb34ee0716d4c4f21c8de703da2d4a87109`  
**Last validated product checkpoint:** `34c9b2dc4137f8f238b73547c6fa69914272945c`  
**Last certified APK:** `99D1D132FD21E4A49D46EF10997305D62949291B1771F755E7B010200C990C55`  
**Last campaign:** `055-signal-arcade-desirability` — `VALIDATED / CAMPAIGN_055_DESIRABILITY_PASS_COMPLETE`  
**Required numbered execution boundary:** **Change 067**  
**After Change 067:** immediately begin a separate repository-wide hardening phase.  
**Do not stop between changes.**

---

# 0. OWNER DIRECTIVE

Continue execution autonomously and do not stop after completing only the next change.

Your required numbered execution boundary is **Change 067**.

You must proceed sequentially through:

`056 → 057 → 058 → 059 → 060 → 061 → 062 → 063 → 064 → 065 → 066 → 067`

and fully implement, validate, reconcile, and close every change before advancing.

Completing one change is **not** a stopping condition.

Finishing the currently active change is **not** a stopping condition.

A green test suite is **not** a stopping condition.

Do not ask the owner whether you should continue.

Do not wait for approval between changes.

Do not hand control back between changes.

After Change N is terminally closed, immediately begin Change N+1.

When Change 067 is terminally completed, **do not stop**. Immediately begin the separate **Post-067 Full Repository Hardening** phase defined later in this prompt.

---

# 1. CURRENT VERIFIED BASELINE

Campaign 055 is genuinely terminal.

The current baseline has:

- no active campaign;
- OpenSpec 055 `VALIDATED`;
- final Campaign 055 verdict `CAMPAIGN_055_DESIRABILITY_PASS_COMPLETE`;
- final product checkpoint `34c9b2d`;
- final release APK SHA-256 `99D1D132FD21E4A49D46EF10997305D62949291B1771F755E7B010200C990C55`;
- six-way pixel certification complete;
- 66/66 canonical + 42/42 interaction captures;
- 108/108 nonblank;
- 0 unresolved true undersized targets;
- final repository matrix 567 suites / 6,734 tests / 5 snapshots;
- 5/5 opt-in probes;
- full 4-game native workout;
- SQLite integrity/schema-v12/no-duplicate evidence;
- clean terminal log review;
- no active governance campaign.

Campaign 055 found and fixed real defects that semantic-only validation missed:

- HUD pause clipping;
- duplicate raw/unrounded result score presentation;
- tutorial retry clipping/dead-end.

Treat those classes as high-value regression archetypes.

Do not casually reopen Campaign 055.

---

# 2. TRUTH HIERARCHY — DO NOT BLINDLY TRUST DOCUMENTATION

Existing documentation, reports, state files, prior campaign summaries, TODO lists, and comments are useful evidence but **not authority by themselves**.

For every substantive claim, derive current truth from the strongest available evidence.

Preferred hierarchy:

1. exact-artifact runtime observation;
2. current executable source behavior;
3. current tests and reproducible diagnostics;
4. generated registries / SQLite / build outputs / machine-readable state;
5. Git history, issues, PRs, prior evidence;
6. prose documentation.

If prose conflicts with runtime/source/tests:

- preserve historical truth;
- correct current-language state;
- do not force implementation to match stale docs.

A stale document is not a product requirement unless corroborated by current product intent or owner direction.

---

# 3. INITIAL OVERNIGHT PROGRAM DISCOVERY — BEFORE CHANGE 056

Before proposing Change 056, run one broad **read-first program census** using parallel subagents.

Use up to the repository-governed coder-agent limit, with the orchestrator owning shared state and integration.

Recommended independent lanes:

1. **Current executable architecture + invariants**
   - bootstrap;
   - routing;
   - GameHost/SDK;
   - scoring/normalization;
   - workout lifecycle;
   - XP/currency/rewards;
   - persistence;
   - migrations;
   - backup/import/export;
   - offline;
   - settings;
   - native/runtime boundaries.

2. **Historical bug archaeology**
   - deep Git history, not merely recent commits;
   - closed/open issues where available;
   - merged/closed PRs where available;
   - prior campaign evidence;
   - recurring regression classes;
   - fixes that were reverted/reintroduced;
   - historically fragile subsystems.

3. **Testing / CI / diagnostics / dependency risk**
   - skipped tests;
   - opt-in probes;
   - allowlists;
   - flaky classes;
   - blind spots;
   - dependency dispositions;
   - workflow drift;
   - local vs CI divergence.

4. **Persistence / data integrity / recovery**
   - schema invariants;
   - transaction boundaries;
   - idempotency;
   - interrupted writes;
   - malformed backups;
   - corruption recovery;
   - stale-state re-entry;
   - duplicate-operation protection.

5. **Runtime / performance / resource use**
   - startup;
   - long sessions;
   - memory/resource cleanup;
   - event listeners/timers;
   - list/render hotspots;
   - repeated game transitions;
   - app background/foreground;
   - offline/relaunch.

6. **Security / privacy / unsafe assumptions**
   - secrets;
   - untrusted input;
   - path/file handling;
   - import validation;
   - logs;
   - dependency advisories;
   - unsafe native/config defaults.

7. **Product / UX / accessibility / visual residuals**
   - current final 055 pixels;
   - loading/error/empty/recovery states;
   - compact and font-scale behavior;
   - consistency across all 42 games;
   - interaction friction;
   - low accepted visual debt;
   - product wording;
   - manual/platform boundaries.

The initial discovery should produce a **living opportunity/risk register** ranked by:

- severity;
- reproducibility;
- user impact;
- breadth;
- confidence;
- dependency ordering;
- cost/risk of repair;
- whether the issue is already proven closed.

Do not create twelve arbitrary tasks just to satisfy numbering.

Do not split one tiny defect into multiple fake changes.

The numbered changes must be materially distinct, evidence-derived work packages.

---

# 4. PROGRAM CONTINUITY LEDGER

Create one durable master program ledger before Change 056 implementation.

Suggested location:

`.agent/OVERNIGHT_056_067_STATE.md`

and, if useful, a machine-readable companion:

`.agent/OVERNIGHT_056_067_STATE.json`

It must track at minimum:

- program start SHA;
- current change number;
- completed changes;
- each change's slug;
- exact start/final SHA;
- product-source checkpoint;
- artifact identity where applicable;
- findings closed;
- accepted debt;
- external/manual blockers;
- newly discovered risks;
- validation counts;
- next-change rationale;
- subagent/worktree ownership;
- whether Phase 2 hardening has started;
- final hardening passes.

Update it after every change.

This is the continuity mechanism. Do not rely on chat memory.

---

# 5. HOW TO SELECT CHANGES 056–067

The exact implementation scope of later changes must be derived from current evidence rather than guessed upfront.

Use these **range themes as guardrails**, not mandatory feature lists.

## Changes 056–058 — Product and behavioral completeness

Prioritize evidence-backed gaps in:

- critical user flows;
- game-to-game consistency;
- workout behavior;
- recovery/error/empty/loading states;
- onboarding/tutorial friction;
- result/reward correctness;
- navigation;
- progress/profile/reward behavior;
- offline behavior;
- persistence-visible product behavior.

Avoid cosmetic churn when a behavioral issue has higher value.

## Changes 059–061 — Structural quality and deep invariants

Prioritize:

- state-machine correctness;
- shared abstractions;
- cross-game contract consistency;
- concurrency/race risks;
- persistence/idempotency;
- lifecycle cleanup;
- accessibility contract gaps;
- performance/resource problems;
- architectural duplication that causes real maintenance/regression risk.

Do not refactor merely for aesthetics.

## Changes 062–064 — Release resilience and platform robustness

Prioritize:

- malformed inputs;
- interrupted operations;
- backup/import/export;
- migrations;
- startup/recovery;
- background/foreground;
- long-run/soak;
- packaging/build;
- dependency/security issues;
- runtime observability;
- environmental robustness;
- exact-artifact native evidence.

## Changes 065–066 — Adversarial convergence

Actively search for what previous changes missed.

Perform independent critic passes against:

- runtime;
- source;
- tests;
- data;
- pixels;
- accessibility;
- release artifact;
- Git/OpenSpec/governance state.

These changes should close residual cross-cutting gaps, not add arbitrary features.

## Change 067 — Terminal whole-product certification

Change 067 is primarily a certification/convergence change.

Do not use it as a dumping ground for speculative redesign.

Its purpose is to:

- prove the final executable system;
- reconcile all numbered changes;
- close remaining repository-owned correctness gaps;
- certify one exact final artifact;
- produce one authoritative terminal ledger;
- establish the baseline for the separate hardening phase.

If Change 067 discovers a real defect, fix it and re-certify.

---

# 6. CHANGE CREATION PROTOCOL — EVERY CHANGE 056–067

For each numbered change:

## 6.1 Explore from current truth

Before writing the spec:

- inspect current source;
- inspect adjacent code;
- inspect relevant current tests;
- inspect runtime/pixels/data when relevant;
- inspect prior fixes in Git history;
- check whether a similar bug was previously fixed;
- check current OpenSpec/governance;
- prove the target is not already closed.

Use subagents for independent investigation.

## 6.2 Create a real OpenSpec change

Follow the repository's current OpenSpec conventions.

Each change must have a specific slug and bounded goal.

Do not create a vague "improve everything" numbered change.

The change must define:

- problem/evidence;
- current behavior;
- desired invariant/outcome;
- explicit non-goals;
- affected areas;
- protected contracts;
- implementation plan;
- test plan;
- runtime/native evidence plan;
- rollback/risk notes where appropriate;
- completion criteria.

Run strict OpenSpec validation before implementation.

## 6.3 Implement completely

For the change:

- fully implement the specification;
- inspect all affected and adjacent code;
- resolve incomplete logic, TODOs, stubs, regressions, and integration gaps that are materially part of the change;
- handle edge/failure states;
- add or repair tests;
- preserve product semantics outside scope;
- do not leave known repository-owned correctness work "for later" if it belongs to this change.

## 6.4 Validate continuously

Do focused validation after each meaningful shared-layer edit.

Do not wait until the end to discover broad breakage.

## 6.5 Final change validation

Use risk-based validation, escalating to the full matrix for cross-cutting/native/persistence changes.

Typical gates include:

- Jest;
- unexpected-console gate;
- opt-in probes;
- typecheck;
- lint;
- Expo Doctor;
- OpenSpec strict;
- repo-state;
- task ownership;
- affected-map;
- registry;
- provenance;
- offline;
- secrets;
- workflow hygiene;
- dependency audit;
- runtime QA contract;
- web export;
- Android debug/release builds;
- native runtime;
- pixel/a11y matrix when visual/UI changes are involved;
- SQLite integrity/duplicate checks when persistence can be affected.

Record exact counts rather than saying "tests passed."

## 6.6 Adversarial review

Before closing each change, ask a fresh independent agent to challenge:

- whether the spec is actually satisfied;
- whether tests merely mirror implementation;
- whether adjacent systems regressed;
- whether docs overclaim;
- whether an edge state was skipped;
- whether the artifact actually contains the intended source;
- whether a manual/external limitation is being mislabeled as product success.

Repair substantiated findings.

## 6.7 Terminally close the change

Do not advance until:

- OpenSpec status is terminal/validated according to repository convention;
- executable work is committed;
- evidence is durable;
- governance/state are reconciled;
- tracked worktree is clean;
- `HEAD == origin/main` after safe push/reconciliation;
- no temporary worktree/branch/stash from this change remains;
- the next-change rationale is written to the overnight ledger.

Then immediately begin Change N+1.

---

# 7. NON-NEGOTIABLE CONTINUATION RULE

Before Change 067 is complete, **do not stop** merely because:

- one change completed;
- a milestone completed;
- tests pass;
- implementation looks good;
- documentation is complete;
- you have recommendations;
- the next task is large;
- the codebase is already better;
- the current change is terminal;
- you reached the end of a normal work session.

The owner explicitly authorized overnight continuation.

A normal completion message between numbered changes is prohibited.

---

# 8. ONLY VALID PRE-067 STOP CONDITION

Before Change 067 is complete, stopping is permitted only for a **genuine external blocker that prevents all safe progress required to close the current change**, after reasonable engineering investigation.

Examples may include:

- unavailable external service with no local substitute;
- host failure that prevents required exact-artifact evidence and cannot be repaired/replaced;
- account/policy permission wall with no authorized alternative;
- corrupted external dependency/environment outside repository control.

A single blocked lane is not automatically a campaign stop.

If other independent work can safely continue, continue it.

Do not call these blockers:

- difficult work;
- slow tests;
- large scope;
- failing code you can fix;
- stale docs;
- an emulator configuration issue that can be investigated;
- local dependency/tooling problems that can reasonably be repaired;
- CI account failure when equivalent required local validation remains possible.

If a genuine blocker stops the sequence:

- preserve all completed work;
- record exact blocker evidence;
- state exactly which change cannot terminally close;
- do not skip ahead and falsely mark later changes complete.

---

# 9. SUBAGENT / SWARM RULES

Use subagents aggressively for speed, but preserve ownership discipline.

Repository governance currently allows up to **7 coder agents**.

Rules:

- orchestrator owns OpenSpec, governance, shared state, final integration, and verdicts;
- every writing subagent gets explicit file/area ownership;
- prefer isolated worktrees for concurrent writers;
- read-only investigations may run broadly in parallel;
- no two agents edit the same shared file concurrently;
- do not let agents independently mutate `main`;
- merge/reconcile through the orchestrator;
- every subagent must report exact files, tests, findings, and residual risk;
- do not trust a subagent's "done" without inspecting diff/evidence.

Useful roles per change:

- source archaeologist;
- historical Git/PR/issue archaeologist;
- test/contract critic;
- runtime/native investigator;
- data/persistence investigator;
- security/performance investigator;
- visual/accessibility critic.

Scale down for narrow changes.

---

# 10. GIT SAFETY

At program start and before every numbered change:

- fetch;
- inspect branch;
- inspect `HEAD` and `origin/main`;
- inspect tracked/untracked state;
- inspect worktrees;
- inspect stashes;
- preserve user/concurrent work.

Never:

- force-push;
- discard unknown changes;
- reset away concurrent work;
- delete unrelated untracked configuration;
- rewrite published history;
- use broad cleanup commands without proving ownership.

Push coherent checkpoints frequently according to repository governance.

A blocked/partial checkpoint must never be labeled green.

---

# 11. ANDROID RUNTIME SAFETY

Use only a verified Brain Training-owned runtime.

Preferred known-good profile from Campaign 055:

- `braintraining-ui35`
- Android 15 / API 35
- emulator 37.1.11
- valid `-gpu host` mode

Do not reuse the invalid legacy `-gpu swiftshader_indirect` assumption from the earlier failed session.

Do not use `aosp_atd` for pixel certification if it cannot composite app frames.

Before sending ADB input:

- identify AVD ownership;
- use serial-scoped commands.

Do not touch unrelated devices/emulators.

Avoid global `adb kill-server` or arbitrary emulator-process termination unless ownership and blast radius are proven.

For visual/native certification:

- prove screenshots are real/nonblank;
- prove frame activity;
- verify route/hierarchy/pixel agreement;
- reject stale/duplicate/uniform frames.

---

# 12. REFERO / VISUAL DESIGN RULES

The owner explicitly authorized Refero for this overnight program.

The current **Signal Arcade** direction and final Campaign 055 pixels are the primary product-design baseline.

Do not perform a wholesale visual reset merely because a future change touches UI.

For **any change with material visual/UX work**:

1. inspect current exact-product pixels first;
2. use Refero research **before** implementation;
3. search **styles first** for visual direction;
4. use **screens** for concrete mobile UI patterns;
5. use **flows** for multi-step journeys;
6. research multiple references;
7. create a reference lock / decision ledger;
8. assign each reference a bounded role;
9. do not copy one product;
10. do not average strong references into generic AI UI;
11. compare final rendered pixels against the lock;
12. fix meaningful drift.

Useful seed references discovered for this program include:

- Playdate style `c91209ef-f7f3-4d2b-bf69-41b58e4e2cc2` — physical/tactile game-object confidence;
- Le Puzz style `7e31e67d-effb-46e9-8690-6a848555fda0` — collectible/catalog visual object emphasis;
- .SWOOSH style `455bb2ec-a36c-46e0-8990-33b0a41ada50` — disciplined dark gaming contrast and accent restraint;
- Apple Games Library screen `6173c2eb-7d4e-4a31-9558-6cd23af76b3a` — game-library hierarchy and direct Play affordance;
- Apple Games achievement screen `64618161-9619-48d9-b4f0-a8f39b3d534d` — progress/achievement focus;
- Duolingo dark Profile `27c26f13-c88e-4016-aa5d-69b8a81dbfd8` — identity + achievements hierarchy;
- CapWords completion `cfff4b0a-b7fc-4d35-a5a8-6d9f5507acbc` — focused completion/reward hierarchy.

These are **seeds, not mandates**. Search fresh references for the actual problem in each visual change.

Do not repurpose another reference's color/token role blindly.

Do not regress the Campaign 055 six-way accessibility/pixel standard.

---

# 13. PRODUCT SAFETY / CLAIM BOUNDARY

This is a brain-training product.

Do not introduce unsupported:

- IQ claims;
- intelligence-improvement claims;
- brain-age claims;
- medical claims;
- prevention/treatment claims;
- unsupported transfer claims.

Progress/result language must remain factual and evidence-bounded.

---

# 14. REGRESSION FLOOR FROM CAMPAIGN 055

Unless a later evidence-backed change intentionally revises a contract, preserve at minimum:

- 42 registered games;
- deterministic game QA contracts;
- GameHost lifecycle;
- honest normalized performance bands;
- single-score result presentation;
- tutorial retry reachability;
- HUD pause reachability;
- workout Next/Finish behavior;
- session/workout identity;
- XP/currency/reward idempotency;
- schema v12 unless a deliberate migration changes it;
- migration correctness;
- backup/import/export;
- offline-first behavior;
- malformed-route recovery;
- bootstrap recovery;
- route input envelope;
- unexpected-console baseline;
- generated registry/provenance;
- six-way responsive/a11y expectations;
- dark-mode authored intent.

Treat the final 055 artifact and evidence as a regression oracle, not as a reason to avoid improving proven problems.

---

# 15. CHANGE QUALITY BAR

Every numbered change must produce something materially useful.

Forbidden:

- renumbering docs as a "change";
- artificial micro-splitting to reach 067;
- speculative refactors with no proven value;
- broad rewrites when a bounded repair suffices;
- skipping runtime evidence for runtime-sensitive changes;
- marking work complete because unit tests pass;
- carrying repository-owned correctness defects forward merely to preserve schedule.

If a discovery pass finds no legitimate work in the planned theme, broaden the evidence search and select another material open gap.

Later changes may legitimately be certification/hardening-focused if product work is already mature.

---

# 16. CHANGE 067 TERMINAL REQUIREMENTS

Before declaring Change 067 complete:

## Repository

- exact final `HEAD`;
- exact final product-source checkpoint;
- clean tracked worktree;
- no abandoned campaign worktrees/branches/stashes;
- `HEAD == origin/main`;
- OpenSpec 056–067 all terminal and truthful.

## Test/build

Run the strongest authoritative final repository matrix, including at least:

- full gated Jest;
- unexpected-console;
- all current opt-in probes;
- typecheck;
- lint;
- Expo Doctor;
- all repository validators;
- dependency audit;
- web export;
- Android debug build;
- Android release build;
- OpenSpec strict.

Record exact counts.

## Exact final artifact

Build and identify one authoritative final release APK.

Record:

- source checkpoint;
- SHA-256;
- size;
- package/version;
- signing status;
- Metro independence.

No executable source may drift after certification without rebuilding/re-certifying.

## Native

On the exact final artifact validate:

- clean install;
- first/warm/relaunch;
- offline;
- invalid/oversized/malformed routes;
- Home;
- Games;
- Game Detail;
- tutorial;
- gameplay;
- weak/mid/strong result paths where truthful;
- Progress;
- Profile;
- Rewards;
- full 4-game workout;
- relaunch retention;
- SQLite integrity/foreign keys/schema;
- duplicate session/ledger/rating operations;
- log scan.

## Visual/accessibility

Run the current canonical six-way matrix:

- default/light;
- default/dark;
- compact/light;
- compact/dark;
- font-scale-2/light;
- font-scale-2/dark.

Reject blank/stale frames.

Require:

- 0 unlabelled interactive nodes;
- 0 decorative leaks;
- 0 unresolved true undersized targets;
- no blocking clipping/layout defect.

## Terminal ledger

Produce one authoritative Change 067 terminal ledger separating:

- CLOSED_VERIFIED;
- ACCEPTED_TIME_BOUNDED_DEBT;
- LOW_ACCEPTED_DEBT;
- EXTERNAL_BLOCKER_VERIFIED;
- MANUAL_PLATFORM_PENDING;
- NOT_REPRODUCIBLE_WITH_BOUNDED_EVIDENCE;
- OPEN_PRODUCT_DEFECT.

Target:

**0 unresolved repository-owned Critical/High/Medium correctness defects.**

Change 067 completion is not the end of the overnight work.

Immediately continue to Phase 2.

---

# 17. PHASE 2 — POST-067 FULL REPOSITORY HARDENING

After Change 067 is terminally complete, stop thinking in terms of numbered spec changes.

Do **not** create Change 068 merely to hold this phase.

This is a separate whole-repository hardening program.

Treat every executable subsystem as in scope, including code untouched by Changes 056–067.

The objective is:

> leave the repository in the strongest defensible production-ready state achievable with the available tools and environment.

---

# 18. PHASE 2 — MANDATORY HARDENING DOMAINS

Aggressively inspect and remediate:

- correctness bugs;
- hidden regressions;
- race conditions;
- concurrency/reentrancy problems;
- state-management flaws;
- data consistency;
- broken invariants;
- unsafe assumptions;
- null/undefined handling;
- malformed input;
- boundary values;
- exception paths;
- retry/recovery behavior;
- resource leaks;
- timer/listener cleanup;
- memory pressure;
- performance bottlenecks;
- unnecessary blocking work;
- security vulnerabilities;
- insecure defaults;
- input validation;
- injection/path risks;
- secret exposure;
- unsafe logging;
- dependency risk;
- API/contract inconsistency;
- frontend/storage integration;
- database integrity;
- transaction handling;
- cache/stale-state behavior;
- migrations;
- configuration;
- environment-specific failures;
- build/package/release problems;
- accessibility;
- responsiveness;
- UI consistency;
- error-state UX;
- loading-state UX;
- observability;
- diagnostics;
- brittle tests;
- missing critical-path tests;
- dead code;
- duplicated logic;
- architectural inconsistency;
- maintainability problems that create material regression risk;
- production-readiness gaps.

Do not limit this to obvious lints/TODOs.

Trace important flows deeply.

Challenge assumptions.

Search for failures happy-path tests would not expose.

---

# 19. PHASE 2 — MINIMUM HARDENING PASSES

Perform **at least three independent full-repository passes**, then continue if material issues remain.

## Pass A — Static / architecture / contract attack

Focus on:

- invariants;
- state ownership;
- shared abstractions;
- dead/duplicate code;
- error handling;
- unsafe assumptions;
- malformed input;
- security;
- dependencies;
- test blind spots.

Use multiple independent subagents.

## Pass B — Runtime / persistence / lifecycle attack

Focus on:

- startup/recovery;
- background/foreground;
- repeated navigation;
- repeated games;
- interrupted workouts;
- session identity;
- idempotency;
- SQLite;
- import/export;
- offline;
- long-running state;
- resource cleanup;
- log anomalies;
- performance.

## Pass C — Release / UX / accessibility / adversarial attack

Focus on:

- exact release artifact;
- build/package;
- visual matrices;
- responsive/font scale;
- dark mode;
- error/loading/empty states;
- accessibility;
- production diagnostics;
- hostile user sequences;
- final user-flow coherence.

After Pass C, run a **fresh independent residual census**.

If material executable issues remain:

repeat:

`inspect → identify → fix → validate → reassess`

until the residual census finds no material executable hardening work that can be closed in the current environment.

Do not stop merely because three passes occurred.

---

# 20. PHASE 2 — EVIDENCE AND DISPOSITION

Create a dedicated post-067 hardening evidence root following repository conventions, for example:

`docs/hardening/post067/`

Do not number it as Change 068.

Maintain:

- finding ledger;
- severity;
- reproduction;
- root cause;
- fix;
- tests;
- native evidence;
- disposition;
- exact commit;
- residual risk.

Every finding must end in one of:

- `CLOSED_VERIFIED`
- `ACCEPTED_TIME_BOUNDED_DEBT`
- `LOW_ACCEPTED_DEBT`
- `EXTERNAL_BLOCKER_VERIFIED`
- `MANUAL_PLATFORM_PENDING`
- `NOT_REPRODUCIBLE_WITH_BOUNDED_EVIDENCE`
- `OPEN_PRODUCT_DEFECT`

Do not hide open defects in prose.

---

# 21. PHASE 2 — FINAL CERTIFICATION AFTER HARDENING

After the last hardening repair:

re-freeze the product source and run the full final certification again.

At minimum:

- full Jest;
- console gate;
- all opt-in probes;
- typecheck;
- lint;
- Expo Doctor;
- all validators;
- security/secrets/dependency checks;
- web export;
- Android debug/release builds;
- exact final APK hash;
- native critical flows;
- full workout;
- SQLite audit;
- log scan;
- six-way pixel/a11y matrix if executable UI changed;
- OpenSpec strict consistency;
- governance/state consistency;
- Git cleanliness.

If hardening changed product source after Change 067's artifact, the Change 067 artifact becomes historical and the **post-hardening artifact** becomes the true current production candidate.

Record that distinction clearly.

---

# 22. EXTERNAL / MANUAL BOUNDARIES

Do not falsely claim validation for boundaries unavailable in the environment.

Existing known classes may include:

- human TalkBack/VoiceOver quality;
- physical/OEM Android;
- iOS runtime;
- production/store signing;
- store-install path;
- human system-provider usability;
- external CI/account-policy restrictions.

Attempt currently available boundaries when authorized and technically possible.

Otherwise classify them explicitly.

A manual/external boundary is not permission to leave a repository-owned defect open.

---

# 23. FINAL STOP CONDITION

You may stop only when **both** are true:

## A. Numbered program complete

- Changes 056 through 067 are all fully implemented, validated, reconciled, and terminal.

## B. Post-067 hardening converged

- multiple full-repository hardening passes completed;
- all substantiated material executable issues that can be fixed in the environment are fixed;
- final residual census contains no material executable work that remains safely actionable;
- final exact artifact is certified;
- repository/OpenSpec/governance state is truthful;
- Git is clean and synchronized.

Only then return the final report to the owner.

---

# 24. FINAL REPORT FORMAT

The final overnight report must include:

## Program

- initial program SHA;
- final repository SHA;
- completed changes 056–067 with slug + one-line purpose;
- each change's start/final SHA;
- each change's OpenSpec verdict;
- major defects/features/improvements landed;
- changes that required artifact recertification.

## Final product

- final product-source checkpoint;
- final APK SHA-256;
- APK size;
- package/version/signing;
- repository test counts;
- skip counts;
- snapshots;
- console result;
- probes;
- build results;
- OpenSpec strict result.

## Native

- runtime/AVD;
- critical-flow matrix;
- 4-game workout;
- offline/recovery;
- SQLite integrity/duplicates;
- log scan.

## Visual/accessibility

- six-way matrix result;
- valid capture count;
- accessibility findings;
- remaining visual debt;
- Refero research used by the changes that required visual work.

## Post-067 hardening

- number of full passes;
- findings by severity and disposition;
- issues fixed;
- tests added;
- architecture/security/performance/persistence improvements;
- residual census result.

## Remaining boundaries

Explicitly list:

- manual;
- external;
- time-bounded debt;
- low accepted debt;
- non-reproduced historical issues.

## Git

- `HEAD == origin/main`;
- tracked worktree clean;
- worktrees;
- branches;
- stashes;
- preserved unrelated user configuration.

## Final verdict

Use a precise terminal verdict that distinguishes:

- numbered Change 067 completion;
- post-067 repository-wide hardening convergence;
- any remaining external/manual boundaries.

Do not claim "production ready" without qualifying unvalidated external/manual boundaries.

---

# 25. CORE DIRECTIVE

**Continue autonomously through Change 067.**

**Do not stop after a single change.**

**Do not ask for permission between changes.**

**Derive each change from real evidence, not stale documentation or arbitrary numbering.**

**Use subagents aggressively but preserve ownership and Git safety.**

**Use Refero whenever material visual/UX work is selected, and validate actual rendered pixels.**

**After Change 067, immediately execute multiple repository-wide hardening passes.**

**Keep fixing and re-validating until no material executable hardening work remains in the available environment.**

The target is not:

> "Change 067 exists."

The target is:

> **Changes 056–067 are all terminally complete, followed by a separate aggressive full-repository hardening campaign that converges on the strongest defensible exact-artifact production candidate achievable on this host.**
