# Proposal — Campaign 015 Governance & Depth Convergence

**Change:** `015-governance-depth-convergence`  
**Status:** PROPOSED  
**Audited baseline:** `c8acadceb46ad6ba3f90b0c4222583a9a2912f49`  
**Predecessor:** `014-experience-depth-replayability`

## Summary

After Campaign 014, Brain Training is feature-rich and heavily tested, but the
autonomous campaign control plane has drifted away from its own OpenSpec
conventions, and a small set of verified depth defects remain.

Campaign 015 makes campaign state mechanically trustworthy and then converges
the remaining high-value depth/replayability gaps without expanding the
42-game catalog or launching a general hardening campaign.

## Why now

A green validator is useful only if it proves the plan actually being executed.

The audit found that:

- governance can name an active campaign without a matching OpenSpec change;
- task-ownership CI can validate an old campaign's packet map while a different
  campaign is active;
- durable state can contain contradictory active-campaign instructions and
  still pass repository validation;
- accidental zero-byte root files are tracked without a hygiene gate;
- Rule Grid still has one-step lookup mechanics;
- Word Chain and Context Fit remain content-starved;
- Transform Match carries a hidden-source ambiguity/invariant risk;
- Campaign 014 still owes dedicated-AVD device journeys and final docs closure.

These are convergence problems, not a reason to add more product breadth.

## Activation precondition

Campaign 015 MUST NOT become ACTIVE while Campaign 014 remains ACTIVE.

Before activation, the orchestrator MUST complete or honestly block Campaign
014's remaining required closure work. If a required predecessor gate is
externally unavailable, Campaign 015 remains PROPOSED.

The 014→015 transition MUST update the active-campaign pointers coherently in
one convergence step and MUST leave exactly one active campaign.

## Goals

This change MUST:

1. bind the active campaign to one complete OpenSpec execution package;
2. bind machine-readable swarm ownership to that same active change;
3. detect contradictory durable campaign state before autonomous work starts;
4. remove current root debris and add narrowly-scoped root hygiene checks;
5. extend affected-area validation to the repository's current subsystem map;
6. redesign Logic Rule Grid so higher difficulties require solver-proven
   chained deduction rather than one-cell lookup;
7. expand Language Word Chain to at least 90 validated chains with balanced tier
   coverage and diversity controls;
8. expand Language Context Fit to at least 60 validated items per tier, with
   mechanically and semantically defensible single-answer rounds;
9. harden Spatial Transform Match so every returned hidden-source round is
   semantically unambiguous and satisfies final generator invariants;
10. advance generator/content versions whenever challenge semantics change;
11. rerun targeted performance probes and record evidence for changed hot paths;
12. verify accessibility on changed interaction surfaces using existing shared
   primitives and honest device/manual evidence labels;
13. finish with coherent local gates, targeted Android journeys, and green
   GitHub App CI + Repository Integrity on the final pushed SHA.

## Non-goals

This change MUST NOT:

- add game modules beyond the current 42;
- start cloud sync/auth/social/leaderboards/AI/ads/payments/store work;
- reopen deferred product decisions;
- perform a broad visual redesign;
- rewrite persistence, progression, workout, or portability architecture without
  a concrete requirement and ADR;
- initiate a full hardening campaign unless the owner explicitly requests one;
- force dependency upgrades solely to reduce audit counts;
- claim unavailable iOS, Android, or manual validation as PASS.

## Success definition

Campaign 015 succeeds only when:

- Campaign 014 is durably closed first;
- all normative specs in this change are satisfied;
- every checked task has concrete evidence;
- active OpenSpec, governance, state, execution prompt, and ownership metadata
  agree;
- targeted generator/content property suites pass;
- required Android changed-surface journeys pass or an external blocker is
  honestly recorded without falsely completing the campaign;
- repository validators, typecheck, lint, Jest, registry/provenance/offline
  checks, web export, and Expo Doctor are green as required by impact;
- final GitHub App CI and Repository Integrity are green on the pushed final SHA;
- no unresolved Critical/High regression remains.
