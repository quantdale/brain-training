# Campaign 053 — Full-System Hardening Discovery & OpenSpec Proposal

**Status:** READY FOR EXECUTION  
**Repository:** `quantdale/brain-training`  
**Mode:** exhaustive discovery + adversarial hardening analysis + OpenSpec proposal only  
**Starting context:** Campaign 051 completed the visual reboot; Campaign 052 captured the current visual acceptance packet without changing product source  
**Implementation:** NOT AUTHORIZED in this campaign

---

## Mission

Perform a fresh, whole-repository hardening investigation of the current Brain Training product.

Do not assume the next problems are already known.

Do not begin from a prewritten defect list.

Do not trust campaign summaries, old TODOs, previous PASS labels, or existing OpenSpec changes as authoritative truth.

Explore the current product deeply, discover what is actually weak, risky, fragile, inconsistent, under-tested, stale, or insufficiently validated, and then turn the strongest findings into a rigorous OpenSpec proposal for the next implementation campaign.

The desired outcome is not a pile of speculative cleanup ideas.

The desired outcome is a prioritized, evidence-backed hardening proposal that makes the entire system safer, more reliable, more maintainable, and harder to regress.

---

## Use OpenSpec Explore first

Begin with the repository-supported OpenSpec **Explore** workflow.

Discover the exact OpenSpec instructions and command names available in this repository/environment rather than guessing them. If the environment exposes commands such as `/opsx:explore` / `/opsx:propose`, use those; otherwise use the repo-supported equivalent.

Use Explore as intended:

- investigate before deciding;
- read the codebase broadly;
- inspect architecture and subsystem boundaries;
- follow evidence;
- identify uncertainty;
- test assumptions;
- compare documentation against current source/runtime;
- inspect history when useful;
- do not prematurely collapse into a solution.

This should be a genuine exploratory hardening pass, not a disguised implementation session.

---

## Scope: harden everything that matters

Treat the whole current product as in scope for investigation.

The agent should decide where the risk actually is.

Potential areas include, but are not limited to:

- application architecture;
- startup/bootstrap;
- React/React Native lifecycle;
- navigation and route recovery;
- GameHost/shared game lifecycle;
- all 42 games;
- workout generation and progression;
- session identity and provenance;
- scoring and ratings;
- XP/currency/rewards/idempotency;
- SQLite connection lifecycle and concurrency;
- persistence integrity;
- migrations;
- backup/export/import/restore;
- offline behavior;
- state recovery after force-stop/background/relaunch;
- settings and sensory preferences;
- Favorites/tutorial persistence;
- async races;
- cancellation;
- timers/subscriptions/listeners;
- memory/resource leaks;
- performance hot paths;
- large-history behavior;
- generated content/registries;
- schemas and validation;
- error handling;
- empty/loading/degraded states;
- accessibility;
- responsive/large-text behavior;
- release-vs-debug differences;
- dependency health;
- Expo/React Native integration;
- Android native configuration;
- secrets/security/privacy boundaries;
- unsafe logging;
- debug/QA control isolation;
- test architecture;
- skipped/flaky/weak tests;
- false-positive tests;
- CI/workflow assumptions;
- build/release reproducibility;
- observability/diagnostics;
- dead code;
- duplicate abstractions;
- stale compatibility layers;
- fragile coupling;
- documentation/code drift;
- OpenSpec drift;
- maintainability hazards;
- visual-system implementation fragility introduced by the recent overhaul;
- any other area current evidence reveals.

This is intentionally broad.

Do not mechanically audit every bullet equally.

Find the highest-risk areas and go deep.

---

## Evidence discipline

Use current evidence in roughly this order:

1. reproducible runtime behavior;
2. persisted-state/database evidence;
3. executable tests and validators;
4. current source/configuration;
5. build/package behavior;
6. current CI/API evidence;
7. Git history;
8. campaign/docs/OpenSpec narratives.

Historical documentation is a map, not truth.

If current evidence contradicts an old campaign claim, record the contradiction.

Do not infer absence of defects merely because a prior campaign reported green tests.

---

## Tooling

Use all useful available tools for investigation.

This may include:

- repository search;
- Git history;
- GitHub;
- OpenSpec tooling;
- ARTEMIS;
- Android emulator;
- ADB;
- UIAutomator;
- Maestro;
- SQLite tooling;
- Gradle/Expo/Node;
- static analysis;
- profiling;
- targeted stress scripts;
- current test suites;
- dependency/security tooling;
- read-only parallel subagents;
- browser/research for framework/platform behavior when necessary.

Use tools to answer questions, not to create activity.

Do not alter user-owned devices.

Do not commit secrets or large transient artifacts.

---

## Adversarial mindset

Actively search for bugs that green happy-path tests can miss.

Examples of useful questions:

- What can race?
- What can execute twice?
- What can be partially committed?
- What can be interrupted?
- What breaks after process death?
- What assumptions only hold in debug?
- What behaves differently with an old database?
- What happens with large histories?
- What happens when data is malformed?
- Which code path silently catches errors?
- Which test mocks away the dangerous part?
- Which invariant is documented but not enforced?
- Which validation only proves shape, not semantics?
- Which game shares code that has never been stressed across all 42?
- Which listener/timer survives navigation unexpectedly?
- Which state can become stale?
- Which code depends on ordering?
- Which UI state can mask corrupted data?
- Which dependency/runtime patch changed behavior underneath us?
- Which recent visual-system refactor increased coupling or render work?
- Which “external” failure has never actually been separated from repository behavior?
- Which accepted debt has aged into real risk?

Do not manufacture findings.

A hardening proposal should be severe where evidence is severe and restrained where evidence is strong.

---

## Runtime investigation

Use a dedicated automation-owned runtime where native evidence materially improves the investigation.

You may reproduce suspicious behavior, stress current flows, inspect logcat, inspect SQLite, and perform read-only or disposable destructive experiments.

Do not modify production source in this campaign.

If a defect is reproduced, capture enough evidence that a later implementation agent can reproduce it again.

Do not “quick fix” it.

---

## Repository investigation

Inspect the current repository as it exists now, not only recent campaign files.

Reconstruct major subsystem ownership and test coverage.

Identify:

- critical paths;
- high fan-out modules;
- shared primitives;
- persistence boundaries;
- native boundaries;
- generated artifacts;
- risky asynchronous seams;
- modules with disproportionately high churn;
- modules with high complexity but weak tests;
- tests that appear broad but do not actually exercise production behavior.

Use Git history selectively to understand why fragile code exists.

Do not turn this into an archaeological report unless history explains current risk.

---

## OpenSpec Explore output

During Explore, maintain a concise durable investigation record under a new OpenSpec change or the repo-supported exploration location.

The exploration should converge on:

- verified strengths;
- concrete weaknesses;
- reproduced defects;
- suspected risks with confidence levels;
- evidence gaps;
- obsolete debt;
- newly discovered debt;
- cross-cutting hardening themes;
- candidate implementation slices;
- dependencies between slices;
- stop-the-line issues, if any.

Rank findings by something like:

- Critical;
- High;
- Medium;
- Low;
- Evidence gap / uncertain.

Avoid assigning severity from intuition alone.

---

## Then use OpenSpec Propose

After exploration is mature, use the repository-supported OpenSpec **Propose** workflow.

Create **one coherent hardening change proposal** for the next implementation campaign.

The proposal should be comprehensive enough to cover the real high-value findings, but not so broad that it becomes an unactionable “rewrite everything” plan.

Prefer a staged hardening program inside one OpenSpec change when findings are related.

If the evidence clearly requires multiple independent changes, document that reasoning and create the minimum clean set supported by the repo's OpenSpec conventions.

---

## Proposal requirements

The OpenSpec proposal should make clear:

### Why

What current risks justify the work?

Which are reproduced defects versus preventive hardening?

What evidence shows the current system is insufficient?

### What changes

Define concrete hardening outcomes, not vague intentions such as “improve reliability.”

Examples of good outcomes:

- enforce a specific exactly-once invariant;
- eliminate a reproduced connection race;
- add crash-safe transaction boundaries;
- make a lifecycle resumable after process death;
- replace a brittle shared primitive;
- add production-realistic regression coverage;
- remove an obsolete unsafe compatibility path;
- make failure state explicit instead of silently defaulting.

### What must not change

Protect stable product behavior unless evidence justifies changing it.

Preserve where applicable:

- user-visible game mechanics;
- scoring semantics;
- workout semantics;
- persisted identity/provenance;
- economy/reward meaning;
- visual direction from Campaign 051;
- stable semantic IDs;
- offline-first behavior;
- data compatibility.

### Acceptance criteria

Every meaningful proposal item should have evidence-based acceptance criteria.

Specify how the implementation agent will prove completion.

Prefer:

- reproducible regression tests;
- runtime evidence;
- persisted-state checks;
- stress/repetition thresholds;
- build/release validation;
- exact invariants.

Avoid acceptance criteria like:

- “code is cleaner”;
- “works correctly”;
- “improved performance” without measurement.

### Validation strategy

Define the minimum focused validation for each slice and the broad final matrix expected after implementation.

### Sequencing

Order work so the riskiest invariants and foundational issues happen before cosmetic/low-risk cleanup.

Identify which slices can be parallelized and which must be serialized.

### Rollback / containment

For risky persistence/native/dependency work, describe how implementation should remain recoverable and reviewable.

---

## OpenSpec quality bar

Before finalizing the proposal, challenge it.

Ask:

- Is this based on actual current evidence?
- Are we proposing speculative cleanup with no demonstrated value?
- Did we miss a more fundamental root cause?
- Are several “bugs” really the same architectural issue?
- Are we about to rewrite stable code unnecessarily?
- Are acceptance criteria executable?
- Does the proposal distinguish product defects from environment/tooling issues?
- Can an implementation agent execute this without guessing?
- Is the scope large because the risk is large, or because exploration was undisciplined?

Refine until the proposal is actionable.

Run the repository's OpenSpec validation on the resulting proposal.

Do not leave an invalid or half-generated change.

---

## Important: no implementation

This campaign stops after Explore + Propose.

Do NOT:

- apply the OpenSpec change;
- implement production fixes;
- refactor source;
- update dependencies;
- modify schema;
- rewrite tests except if the repo's OpenSpec tooling itself requires generated proposal artifacts;
- silently fix discovered defects.

The point is to give the next implementation session a trustworthy hardening plan.

If a Critical issue makes continued exploration unsafe, stop, document it clearly, and make that the proposal's first gate.

---

## Git behavior

Commit and push the exploration/proposal artifacts when complete.

Keep commits focused on OpenSpec/investigation documentation.

Before finishing:

- inspect diff;
- ensure no accidental product-source changes;
- remove transient artifacts;
- fetch remote;
- reconcile safely;
- push under repository policy;
- verify `HEAD == origin/main`;
- verify clean worktree except explicitly preserved pre-existing work.

---

## Final report

Report:

- starting SHA;
- final SHA;
- OpenSpec change name/path;
- Explore status;
- Propose status;
- OpenSpec validation result;
- whether product source changed;
- highest-severity reproduced defects;
- highest-severity preventive risks;
- major evidence gaps;
- number of proposed implementation slices;
- which slice should execute first;
- whether any issue blocks normal development;
- current external/manual boundaries;
- HEAD vs origin/main;
- worktree state;
- exact safest next action.

Use one final verdict:

- `CAMPAIGN_053_HARDENING_PROPOSAL_READY`
- `CAMPAIGN_053_HARDENING_EXPLORATION_PARTIAL`
- `CAMPAIGN_053_BLOCKED`

---

## Core directive

**Explore first. Propose second. Implement nothing.**

Do not let previous campaign success create complacency.

Do not let a broad mandate create meaningless cleanup.

Find what is actually fragile in the current product.

Understand it deeply.

Then create the strongest evidence-backed OpenSpec hardening proposal for the next campaign.
