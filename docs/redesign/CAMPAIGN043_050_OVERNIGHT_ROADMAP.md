# Campaigns 043–050 — Overnight Release Hardening & Certification Roadmap

**Repository:** `quantdale/brain-training`  
**Starting product state:** Campaign 042 technically certified at validated product SHA `557c77606b94018afa119896d81a59e06fb220f1`; terminal repository tip before this roadmap: `d7b1cd5f85d610f03ff2f5e130732c92c5262447`  
**Mode:** sequential evidence-driven release hardening/certification packets; later packets may be PARTIAL  
**Primary rule:** current reproducible runtime/source/persisted-state evidence outranks historical documentation  
**Target horizon:** progress sequentially through Campaign 050 as far as safely possible in one overnight session

## Purpose

Campaign 042 closed the known technical blockers from Campaign 041. The product is now technically certified for the exercised Android/emulator scope, but important release boundaries remain external, manual, platform-specific, or infrastructure-related.

This roadmap exists so one long autonomous session can continue useful work without waiting for the operator after each campaign.

Campaign numbers are work packets, not promises. The goal is safe, validated progress, not reaching a number at any cost.

Preferred progression:

`043 → validate/checkpoint → 044 → validate/checkpoint → 045 → ... → 050`

A truthful `Campaign 047 PARTIAL` with strong evidence is better than superficial completion through 050.

---

## Evidence discipline — mandatory

Historical reports, README files, `.agent` state, OpenSpec status, previous screenshots, test summaries, prior PASS labels, and earlier root-cause claims are **leads, not current truth**.

For every material conclusion prefer:

1. current reproducible runtime observation;
2. current persisted-state/database evidence;
3. current executable tests/validators;
4. current source/configuration;
5. current build/package output;
6. current GitHub/CI/API evidence;
7. Git history;
8. historical documentation.

If evidence conflicts, investigate. Do not force current behavior to agree with old documentation.

Never invent:

- human usability findings;
- physical-device evidence;
- iOS evidence;
- TalkBack/VoiceOver quality;
- store/install/signing success;
- screenshots;
- accessibility passes;
- CI success;
- ARTEMIS success.

Unavailable evidence must remain explicitly unavailable.

---

## Common campaign loop

Each campaign should follow:

**Observe → reconstruct current state → define bounded risk → establish before evidence → implement only if justified → focused validation → native/runtime validation → persistence/log review → broader gates → evidence → commit/push → decide whether the next campaign is safe.**

At the start of every packet:

- fetch remote;
- inspect HEAD/origin/worktree/worktrees/stashes;
- preserve concurrent/user work;
- inspect the actual current runtime/source;
- identify protected contracts;
- decide whether the packet is independent of any unresolved prior blocker.

At the end of every coherent packet:

- review diff;
- run risk-appropriate tests;
- write evidence under `docs/redesign/evidence/campaign0XX/`;
- commit;
- re-fetch/reconcile safely;
- push if repository policy permits;
- verify local/remote relationship.

Never force-push or discard unknown work.

---

# Campaign 043 — Independent Platform & Release-Boundary Validation

## Objective

Validate the remaining release boundaries without reopening product design.

Primary areas:

- release APK independence from Metro/dev tooling;
- Android system document/share sheet and supported platform UI;
- physical Android if genuinely available and explicitly safe;
- iOS runtime only if a legitimate environment is available;
- TalkBack/VoiceOver only if actually executable;
- human usability/accessibility only if an independent human is genuinely available;
- signing/install path only with legitimate non-secret signing assets and repository policy.

## Rules

Do not block the entire overnight sequence on unavailable human/iOS/physical-device evidence.

If those boundaries are unavailable, create a precise PARTIAL/manual handoff and continue into technically independent Campaign 044.

Do not commandeer user-owned devices.

Do not copy secrets/signing material into Git.

## Exit

One of:

- `CAMPAIGN_043_COMPLETE`
- `CAMPAIGN_043_PARTIAL_MANUAL_PLATFORM_PENDING`
- `CAMPAIGN_043_BLOCKED`

Evidence must clearly separate executed automation from manual/platform pending work.

---

# Campaign 044 — External CI / Workflow Infrastructure Diagnosis

## Objective

Determine why Repository Integrity, App CI, Android Build Smoke, and iOS Build Smoke repeatedly fail before repository steps execute.

## Investigation

Inspect current workflow runs, jobs, step arrays, annotations, events, concurrency, workflow SHAs, runner labels, permissions/policies visible to the connected account, prior known-good runs, and repository workflow syntax.

Classify using current evidence:

- `PASS`
- `REPOSITORY_WORKFLOW_DEFECT`
- `RUNNER_INFRASTRUCTURE`
- `ACCOUNT_OR_POLICY`
- `GITHUB_TRANSIENT`
- `INDETERMINATE_EXTERNAL_PRE_STEP`

## Repair rule

Modify workflow files only if a repository-side workflow/configuration defect is actually proven.

Do not edit CI merely to make a red indicator disappear.

If external, document exact evidence and proceed.

---

# Campaign 045 — Expo SDK 57 Patch Alignment & Dependency Hygiene

## Objective

Revisit the known Expo Doctor patch drift as an isolated maintenance packet.

Campaign 042 reported five packages one patch behind manifest expectations:

- `expo`
- `expo-asset`
- `expo-constants`
- `expo-router`
- `expo-sharing`

First verify this is still current.

If safe, update the smallest coherent package set using supported Expo tooling and lockfile changes.

## Required validation

- Expo Doctor;
- dependency-policy validator;
- raw audit classification;
- full Jest;
- typecheck/lint;
- web export;
- Android debug/release builds;
- fresh native launch;
- golden path smoke;
- Games/Progress/Profile smoke;
- offline/relaunch;
- release independence from Metro.

Do not perform broad major-version upgrades.

Do not churn unrelated dependencies.

If patch alignment introduces instability, revert only the campaign-owned changes safely and leave the packet partial/blocked with evidence.

---

# Campaign 046 — Full Catalog Repeatability & Game-Lifecycle Soak

## Objective

Increase confidence beyond one lifecycle per game.

Campaign 042 closed the three missing result paths. Campaign 046 should now stress the **catalog as a system**.

## Coverage

For all 42 registered games:

- registry/detail/start;
- first interactive state;
- result lifecycle using legitimate QA support;
- result persistence;
- no fatal/RedBox/invariant error;
- navigation/return.

For a risk-weighted subset spanning all eight domains/mechanic families, repeat complete lifecycles multiple times and include real mechanic interaction.

Prioritize games with:

- timers;
- sequencing;
- drag/spatial interaction;
- generated content;
- multi-round state;
- previously incomplete result paths;
- historical defects.

Inspect SQLite after batch runs for duplicate sessions, ratings, reward/currency operations, or stale metadata.

Do not equate deterministic force-completion with mechanic correctness. Record the distinction.

---

# Campaign 047 — Persistence, Migration, Backup/Restore & Corruption Resilience

## Objective

Adversarially re-test durable state after the Campaign 042 database serialization repair.

## Coverage

- fresh DB initialization;
- existing v12 DB;
- supported historical migration fixtures through v12;
- repeated force-stop/relaunch;
- concurrent-looking settings/workout/result writes;
- backup/export/import round-trip;
- merge/replace modes if supported;
- duplicate import/replay behavior;
- invalid/corrupt backup input;
- interrupted/cancelled import paths where safely testable;
- integrity checks;
- unique-key/idempotency checks;
- workout/session identity;
- Favorites/tutorial/profile/reward/settings persistence.

All destructive cases must use disposable data.

A data-loss/idempotency/migration defect blocks progression until repaired or safely isolated.

---

# Campaign 048 — Startup, Performance, Resource & Reliability Soak

## Objective

Measure and harden runtime behavior without speculative optimization.

## Measure

Representative repeated runs for:

- cold start;
- warm start;
- force-stop/relaunch;
- offline start;
- Home;
- Games first load/search/catalog;
- Progress populated;
- Game Detail;
- Game start;
- result transition;
- workout leg transition;
- repeated navigation cycles.

Inspect:

- crashes/ANRs;
- SQLite startup behavior after Campaign 042;
- main/JS thread stalls where measurable;
- memory/RSS growth;
- timer/subscription leaks;
- repeated DB queries;
- log spam;
- lazy-load failures;
- rendering churn.

Use bounded soak loops. Record sample size.

Optimize only measured problems.

---

# Campaign 049 — Accessibility, Responsive, System-UI & State-Matrix Hardening

## Objective

Push beyond route-level automation into high-risk responsive/accessibility states.

## Coverage

- light/dark;
- compact viewport;
- large font scale;
- representative tall/short devices;
- reduced motion/sensory toggles where supported;
- modal/overlay focus behavior;
- 44dp targets;
- scroll reachability;
- bottom-tab/safe-area overlap;
- text truncation;
- keyboard/input overlap;
- system document/share surfaces where technically accessible;
- technical TalkBack traversal if available;
- state matrix across fresh/active/completed/empty/error/offline/search/filter/result/settings/data states.

Human screen-reader quality remains manual unless actually performed by a human.

Repair only reproduced issues, then rerun affected matrix.

---

# Campaign 050 — Integrated Release Candidate Certification

## Objective

Treat the post-043–049 product as the integrated release candidate and determine what is actually certifiable.

Campaign 050 is primarily certification and convergence, not feature work.

## Required current-state validation

At minimum:

- full Jest and all authoritative validators;
- typecheck/lint;
- Expo Doctor;
- dependency policy + raw audit classification;
- web export;
- Android debug/release build;
- release launch without Metro;
- full four-game workout;
- representative standalone games;
- all-42 registry/lifecycle summary from current SHA;
- result persistence;
- force-stop/relaunch;
- backup/import smoke;
- offline;
- Home/Games/Progress/Profile/Rewards/Data;
- invalid-route/recovery;
- current accessibility/state matrix;
- current performance/reliability summary;
- current external CI status;
- copy/medical-claim review;
- Git cleanliness/provenance.

## Possible verdicts

- `CAMPAIGN_050_RELEASE_TECHNICALLY_CERTIFIED`
- `CAMPAIGN_050_RELEASE_CONDITIONAL`
- `CAMPAIGN_050_BLOCKED`

Technical certification must not be worded as human/iOS/store certification unless those were genuinely executed.

---

## Progression rules

### Advance when

The current packet has:

- coherent validated work;
- no unresolved severe regression in protected contracts;
- evidence written;
- a reviewable checkpoint committed/pushed;
- remaining gaps either closed or proven independent of the next packet.

### Partial is valid

Manual/platform/external constraints may leave Campaign 043 or 044 partial while later independent technical packets continue.

A campaign may remain PARTIAL if session context/time runs low. Commit only coherent validated work.

### Do not advance past

- data corruption;
- duplicate irreversible writes;
- broken migrations;
- broken backup/restore;
- broken session/workout identity;
- reproducible unresolved SQLite startup failure;
- severe navigation trap;
- release build unable to start;
- current campaign regression affecting core flows.

---

## Tool authorization

Use available tools when they materially improve evidence or velocity:

- ARTEMIS;
- computer use;
- Android emulator/ADB/UIAutomator/Maestro;
- SQLite tooling;
- repository QA scripts;
- Gradle/Expo/Node;
- Git/GitHub;
- browser/research;
- Refero only if a genuine product-design question unexpectedly arises;
- parallel read-only/sub-agent investigations where ownership is clear.

ARTEMIS and subagents are helpers, not authorities. Cross-check important findings.

Never commit secrets, credentials, signing material, browser profiles, private traces, emulator images, APKs unless repository policy explicitly requires a small artifact, or giant raw evidence dumps.

---

## Long-session context discipline

Maintain durable evidence as the session grows.

Prefer reading current source/evidence over relying on compressed memory.

Periodically re-check:

- `git status`;
- HEAD/origin relationship;
- current campaign scope;
- uncommitted changes;
- whether previous evidence still matches current SHA.

If reasoning/context quality degrades, checkpoint and write a precise handoff before adding more scope.

---

## Required overnight handoff

Before ending for any reason, create/update:

`docs/redesign/evidence/overnight-043-050/OVERNIGHT_HANDOFF.md`

Include:

- starting SHA;
- final SHA;
- validated product SHA(s);
- HEAD vs origin/main;
- worktree status;
- Campaign 043–050 status table: COMPLETE / PARTIAL / CONDITIONAL / BLOCKED / NOT STARTED;
- exact product/source changes per campaign;
- validation actually run;
- native runtime(s) actually used;
- ARTEMIS/computer-use/tool usage;
- external CI state;
- human/platform state;
- unresolved defects/debt by severity;
- uncommitted work;
- safest next action.

## Success definition

The overnight session succeeds if it produces substantial, validated release-hardening progress beyond Campaign 042 while preserving the technically certified product core.

Reaching Campaign 050 is desirable, not mandatory.

Truthful evidence outranks campaign-number velocity.
